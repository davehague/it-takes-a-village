/**
 * Slack from an app-runtime tool. A tool's execute() runs outside every Slack
 * handler, so there is no `ctx.slack` handle — the token is minted through
 * Vercel Connect (VERCEL_OIDC_TOKEN) and the workspace comes from SLACK_TEAM_ID
 * (docs: channels/slack.mdx). The defaults keep the hackathon workspace working
 * with no env file; another workspace sets the env vars. `callSlackApi` here is
 * the same request path as the live-proven `ctx.slack.request("users.info")`.
 */

import { connectSlackCredentials } from "@vercel/connect/eve";
import { callSlackApi } from "eve/channels/slack";
import { CHANNEL_ID_RE, normalizeChannelName, pickChannel, type SlackChannelSummary } from "./slack-channels.ts";

export const DEFAULT_TEAM_ID = "T0C28HCG1R6";
export const DEFAULT_CONNECTOR = "slack/it-takes-a-village";

/** Bot token (via Vercel Connect) + the workspace whose installation mints it. */
export function slackAuth() {
  const connector = process.env.SLACK_CONNECTOR ?? DEFAULT_CONNECTOR;
  const credentials = connectSlackCredentials(connector);
  const teamId = process.env.SLACK_TEAM_ID ?? DEFAULT_TEAM_ID;
  return { botToken: credentials.botToken, teamId };
}

/** All non-archived public channels the app can see (paginated). */
export async function listPublicChannels(): Promise<SlackChannelSummary[]> {
  const { botToken, teamId } = slackAuth();
  const out: SlackChannelSummary[] = [];
  let cursor: string | undefined;
  do {
    const res = await callSlackApi({
      botToken,
      context: { teamId },
      operation: "conversations.list",
      body: { types: "public_channel", exclude_archived: true, limit: 200, ...(cursor ? { cursor } : {}) },
    });
    if (!res.ok) throw new Error(`Slack conversations.list failed: ${res.error ?? "unknown_error"}`);
    const channels = (res.channels as { id?: unknown; name?: unknown }[] | undefined) ?? [];
    for (const c of channels) {
      if (typeof c.id === "string" && typeof c.name === "string") out.push({ id: c.id, name: c.name });
    }
    const meta = res.response_metadata as { next_cursor?: string } | undefined;
    cursor = meta?.next_cursor || undefined;
  } while (cursor);
  return out;
}

/**
 * Channel id -> name via conversations.info. Best-effort: returns "" when the
 * lookup fails (the id is still a valid label; a name is only nicer).
 */
export async function lookupChannelName(channelId: string): Promise<string> {
  try {
    const { botToken, teamId } = slackAuth();
    const res = await callSlackApi({ botToken, context: { teamId }, operation: "conversations.info", body: { channel: channelId } });
    const name = (res.channel as { name?: unknown } | undefined)?.name;
    return res.ok && typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}

/** Slack's link form for a channel: `<#C0…|name>` renders as a clickable #name. */
export function channelRef(channelId: string, name: string): string {
  return name ? `<#${channelId}|${name}>` : `<#${channelId}>`;
}

/** "#village-copywriter" or "C0…" -> { id, name }. Throws a human-relayable error when not found. */
export async function resolveChannelId(channel: string): Promise<SlackChannelSummary> {
  const trimmed = channel.trim();
  if (CHANNEL_ID_RE.test(trimmed)) return { id: trimmed, name: await lookupChannelName(trimmed) };
  const { match, suggestions } = pickChannel(await listPublicChannels(), trimmed);
  if (match) return match;
  const hint = suggestions.length ? ` — did you mean: ${suggestions.map((s) => `#${s}`).join(", ")}?` : ".";
  throw new Error(
    `No public channel named '#${normalizeChannelName(trimmed)}'${hint} Ask the human to check the channel exists and is public.`,
  );
}
