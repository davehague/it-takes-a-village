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
 *
 * The base is villager-agnostic — "you are this villager, read its
 * instructions.md and follow it, reply once in Markdown." Per-villager operational
 * glue (a script invocation, a hard output contract) is appended from the
 * registry's optional `framing` field, so a prose-only villager needs nothing
 * beyond its instructions.md.
 */
function villagerFraming(villager: Villager): string {
  const base = [
    `You are acting AS the villager "${villager.name}" (${villager.icon}) — not as the midwife. This channel is its village.`,
    `Its folder is at ${villager.dir} in the sandbox (bash runs with cwd /workspace).`,
    `First read ${villager.dir}/instructions.md with read_file and follow it — it is the source of truth for how this villager behaves.`,
    `Then reply as your normal assistant message, written in GitHub-flavored Markdown (bold, [label](url) links, - lists); it renders natively in Slack. Reply exactly once and then stop; do NOT call post_as_villager, and do NOT re-post or revise a previous answer.`,
  ];
  return (villager.framing ? [...base, villager.framing] : base).join("\n");
}

export default slackChannel({
  credentials: connectSlackCredentials(
    process.env.SLACK_CONNECTOR ?? "slack/it-takes-a-village",
  ),

  // Give each turn the recent thread transcript with speaker attribution, so a
  // villager can use channel context (and later mine it for knowledge atoms).
  threadContext: {},

  async onAppMention(ctx: SlackInboundMessageContext, message: SlackMessage) {
    // Never let a bot (including our own villager posts) trigger a turn.
    const rawMention = message.raw as { bot_id?: unknown; subtype?: unknown };
    if (
      message.author?.isBot ||
      typeof rawMention.bot_id === "string" ||
      rawMention.subtype === "bot_message"
    ) {
      return null;
    }

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

    return {
      auth: null,
      context: [villagerFraming(villager)],
      title: `${villager.name}: ${message.text.slice(0, 60)}`,
    };
  },

  async onMessage(ctx: SlackInboundMessageContext, message: SlackMessage) {
    // CRITICAL: never react to bot-authored messages — including this app's own
    // villager posts. `post_as_villager` posts with a custom username, which
    // Eve's built-in self-message filter does NOT recognize as the app's own, so
    // without this guard every villager reply re-triggers onMessage on the
    // subscribed thread and the villager posts in a runaway loop. Humans are not
    // bots, so this only silences bot/self chatter. Belt-and-suspenders: a
    // username-customized post arrives as a `bot_message` with a `bot_id`, so we
    // check the raw event too in case `author.isBot` is not set on that subtype.
    const raw = message.raw as { bot_id?: unknown; subtype?: unknown };
    if (
      message.author?.isBot ||
      typeof raw.bot_id === "string" ||
      raw.subtype === "bot_message"
    ) {
      return null;
    }

    // Listen: every human message is a memory-ingest opportunity, whether or not
    // we reply.
    await ingestForMemory({
      channelId: message.channelId,
      userId: message.author?.userId,
      text: message.text,
      threadTs: message.threadTs,
      ts: message.ts,
    });

    // Act ONLY on an explicit human @mention. We deliberately do NOT auto-continue
    // on subscribed threads or DMs here: auto-continue is what let a villager's own
    // posts (or any follow-up) re-trigger turns and spiral into a runaway loop.
    // The trade-off — a correction must re-mention @villager — is worth the safety.
    // (app_mention normally routes to onAppMention; this covers mentions that
    // arrive as a plain `message` event.)
    if (!ctx.isBotMentioned()) return null;

    const villager = villagerForChannel(message.channelId);
    if (!villager) return { auth: null };

    return {
      auth: null,
      context: [villagerFraming(villager)],
    };
  },
});
