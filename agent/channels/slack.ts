import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";
import type {
  SlackInboundMessageContext,
  SlackMessage,
} from "eve/channels/slack";
import { ingestForMemory } from "../lib/memory-ingest";
import { villagerForChannel, type Villager } from "../lib/villages";

/**
 * Slack channel for It Takes a Village. One app (named "villager"), many roles:
 *
 * - In a village channel, a mention acts AS that channel's villager (custom name
 *   + face via post_as_villager), not as the midwife.
 * - In #villager-management, a DM, or any unmapped channel, it acts as the
 *   midwife (birth interviews, management).
 *
 * Routing is by channel id (see agent/lib/villages.ts). The handler has the
 * channel id; the model turn does not, so the handler resolves the villager and
 * injects a framing message via the mention result's `context` field (Eve
 * appends those strings to session history before the human's message).
 *
 * Listen vs act: `onMessage` sees every channel message and calls the memory
 * hook, but only dispatches a turn when the villager is addressed (mention) or
 * the message continues an active thread. Un-addressed chatter is dropped
 * (no reply) — it still lives in Slack history as raw context to read on demand.
 */

/**
 * Build the framing that makes a turn act as a villager. Injected as `context`
 * so the model reads it as a leading instruction before the human's message.
 */
function villagerFraming(
  villager: Villager,
  channelId: string,
  replyThreadTs: string,
): string {
  return [
    `You are acting AS the villager "${villager.name}" (${villager.icon}) — not as the midwife. This channel is its village.`,
    `Its folder is at ${villager.dir} in the sandbox (bash runs with cwd /workspace).`,
    `To answer: read ${villager.dir}/instructions.md with read_file and follow it, then run its scripts with the bash tool, e.g.:`,
    `  cd ${villager.dir} && mkdir -p stages/01-research/output && SEARCH_OUT_DIR="$(pwd)/stages/01-research/output" scripts/search.sh "<the question>"`,
    `Deliver your ENTIRE reply by calling the post_as_villager tool with channel="${channelId}", villagerName="${villager.name}", iconEmoji="${villager.icon}", threadTs="${replyThreadTs}". Put the whole brief in that tool's text.`,
    `After the post_as_villager call, end your turn with NO further assistant text — the villager speaks only through post_as_villager, so a second plain reply would double-post as the app.`,
    `Never answer from memory or as the midwife: every claim in the brief cites a source, and the brief ends with a "Confidence:" line.`,
  ].join("\n");
}

export default slackChannel({
  credentials: connectSlackCredentials(
    process.env.SLACK_CONNECTOR ?? "slack/it-takes-a-village",
  ),

  // Give each turn the recent thread transcript with speaker attribution, so a
  // villager can use channel context (and later mine it for knowledge atoms).
  threadContext: {},

  async onAppMention(ctx: SlackInboundMessageContext, message: SlackMessage) {
    // Passive ingest: record the addressing message too (listen always).
    await ingestForMemory({
      channelId: message.channelId,
      userId: message.author?.userId,
      text: message.text,
      threadTs: message.threadTs,
      ts: message.ts,
    });

    const villager = villagerForChannel(message.channelId);
    if (!villager) {
      // Midwife channel / DM / unmapped → run the turn as the midwife.
      return { auth: null };
    }

    const replyThreadTs = message.threadTs || message.ts;
    return {
      auth: null,
      context: [villagerFraming(villager, message.channelId, replyThreadTs)],
      title: `${villager.name}: ${message.text.slice(0, 60)}`,
    };
  },

  async onMessage(ctx: SlackInboundMessageContext, message: SlackMessage) {
    // Listen: every human message is a memory-ingest opportunity, whether or not
    // we reply. (Eve already drops the app's own messages before this runs.)
    await ingestForMemory({
      channelId: message.channelId,
      userId: message.author?.userId,
      text: message.text,
      threadTs: message.threadTs,
      ts: message.ts,
    });

    // Act only when addressed: an explicit mention, an active thread this
    // session already owns, or a DM/private channel. Otherwise drop (no reply);
    // the message stays in Slack history as raw context to read on demand.
    const addressed =
      ctx.isBotMentioned() ||
      (await ctx.isSubscribed()) ||
      (await ctx.isDMOrPrivateChannel());
    if (!addressed) return null;

    // Keep acting as the channel's villager on thread continuations (e.g. a
    // correction typed in-thread without a re-mention).
    const villager = villagerForChannel(message.channelId);
    if (!villager) return { auth: null };

    const replyThreadTs = message.threadTs || message.ts;
    return {
      auth: null,
      context: [villagerFraming(villager, message.channelId, replyThreadTs)],
    };
  },
});
