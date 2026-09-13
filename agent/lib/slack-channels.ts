/**
 * Pure helpers for turning a human-typed "#channel-name" into a Slack channel
 * match. No Eve or network imports so this stays unit-testable; the network
 * half (listing channels) lives in slack-client.ts.
 */

export type SlackChannelSummary = { id: string; name: string };

/** Slack public/private channel ids: C… or G…, uppercase alphanumerics. */
export const CHANNEL_ID_RE = /^[CG][A-Z0-9]{8,}$/;

/** "  #Village-Copywriter " -> "village-copywriter". */
export function normalizeChannelName(input: string): string {
  return input.trim().replace(/^#/, "").trim().toLowerCase();
}

/**
 * Exact (normalized) name match, else up to three suggestions: names that
 * contain the request or share its first four characters.
 */
export function pickChannel(
  channels: SlackChannelSummary[],
  wanted: string,
): { match: SlackChannelSummary | null; suggestions: string[] } {
  const name = normalizeChannelName(wanted);
  const match = channels.find((c) => c.name.toLowerCase() === name) ?? null;
  if (match) return { match, suggestions: [] };
  const prefix = name.slice(0, 4);
  const suggestions = channels
    .map((c) => c.name)
    .filter((n) => n.toLowerCase().includes(name) || (prefix.length === 4 && n.toLowerCase().startsWith(prefix)))
    .slice(0, 3);
  return { match: null, suggestions };
}
