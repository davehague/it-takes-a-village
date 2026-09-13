import { callSlackApi } from "eve/channels/slack";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { slackAuth } from "../lib/slack-client";

/**
 * Post a Slack message under a villager's own name and icon.
 *
 * This is how a villager "speaks in its own voice": one Slack app posts with a
 * per-message `username` + `icon_emoji` (Slack's `chat:write.customize`), into a
 * channel it is not a member of (`chat:write.public`). Both were proven live in
 * the Sep 12 spike — see docs/eve-verification.md. The bot token is minted
 * through Vercel Connect (see agent/lib/slack-client.ts), not a pasted secret.
 */

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
  async execute({ channel, villagerName, text, iconEmoji, threadTs }) {
    const { botToken, teamId } = slackAuth();

    const response = await callSlackApi({
      botToken,
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
