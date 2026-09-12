import { connectSlackCredentials } from "@vercel/connect/eve";
import { callSlackApi } from "eve/channels/slack";
import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Post a Slack message under a villager's own name and icon.
 *
 * This is how a villager "speaks in its own voice": one Slack app posts with a
 * per-message `username` + `icon_emoji` (Slack's `chat:write.customize`), into a
 * channel it is not a member of (`chat:write.public`). Both were proven live in
 * the Sep 12 spike — see docs/eve-verification.md. We mint the bot token through
 * Vercel Connect (authenticated by VERCEL_OIDC_TOKEN), not a pasted xoxb- secret,
 * because the managed Slack app exposes no static token.
 */

// Fallback workspace id (the hackathon Slack team). Prefer the inbound event's
// teamId, then SLACK_TEAM_ID; this constant only covers turns with neither.
const DEFAULT_TEAM_ID = "T0C28HCG1R6";
const DEFAULT_CONNECTOR = "slack/it-takes-a-village";

export default defineTool({
  description:
    "Post a message to a Slack channel under a villager's own name and icon (not the midwife's). Use this for every villager message so the villager speaks in its own voice. The channel must already exist; the app posts in without being invited.",
  inputSchema: z.object({
    channel: z
      .string()
      .min(1)
      .describe("Slack channel id (e.g. C0123ABCD) or name (e.g. #village-exa-researcher)."),
    villagerName: z
      .string()
      .min(1)
      .describe("Display name to post under, e.g. 'Exa Researcher'."),
    text: z
      .string()
      .min(1)
      .describe(
        "Message body, written in Markdown (GitHub-flavored: **bold**, [label](url), - lists, headings). Rendered natively in Slack via the markdown_text field.",
      ),
    iconEmoji: z
      .string()
      .optional()
      .describe("Villager face as a Slack emoji in colon form, e.g. ':mag:'. Optional."),
    threadTs: z
      .string()
      .optional()
      .describe("Reply in this thread (a Slack message ts). Omit to post a top-level message."),
  }),
  label: {
    start: ({ villagerName, channel }) => `Post as ${villagerName} in ${channel}`,
  },
  async execute({ channel, villagerName, text, iconEmoji, threadTs }, ctx) {
    const connector = process.env.SLACK_CONNECTOR ?? DEFAULT_CONNECTOR;
    const credentials = connectSlackCredentials(connector);

    // teamId picks the workspace whose app installation mints the token.
    const teamId =
      (ctx as { slack?: { teamId?: string } }).slack?.teamId ??
      process.env.SLACK_TEAM_ID ??
      DEFAULT_TEAM_ID;

    const response = await callSlackApi({
      botToken: credentials.botToken,
      context: { teamId },
      operation: "chat.postMessage",
      // Slack's `markdown_text` field renders GitHub-flavored Markdown
      // (bold, links, lists, headings) natively. It is mutually exclusive
      // with `text` and `blocks` on chat.postMessage (confirmed in Eve's
      // bundled Slack adapter types), so we send markdown_text only.
      body: {
        channel,
        markdown_text: text,
        username: villagerName,
        ...(iconEmoji ? { icon_emoji: iconEmoji } : {}),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Slack chat.postMessage failed: ${response.error ?? "unknown_error"} (channel=${channel}, villager=${villagerName})`,
      );
    }

    return {
      ok: true,
      channel: (response.channel as string | undefined) ?? channel,
      ts: (response.ts as string | undefined) ?? "",
      villagerName,
    };
  },
});
