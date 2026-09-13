/**
 * Village registry — the routing backbone.
 *
 * Maps a Slack channel to the villager that lives there. The DATA lives in
 * `villages.json` at the repo root (Eve's discovery rejects JSON under agent/);
 * this module loads it and keeps the types + lookup. It is tiny, changes only at
 * birth (the `birth_villager` tool appends one key and commits — a deliberate
 * commit to main that also redeploys), and stays in git so it is readable,
 * versioned, and reviewable alongside the folders it points at.
 *
 * It is NOT runtime memory — the community brain (accumulating atoms) lives in
 * the memory store (Vercel Blob, ADR 0003). This is birth-time config.
 *
 * The Slack handler (which has `message.channelId`) reads this to decide whether
 * a turn should act as the midwife or as a specific villager.
 */

import registry from "../../villages.json" with { type: "json" };

export interface Villager {
  /** Folder slug under village/villagers/. */
  readonly slug: string;
  /** Display name the villager posts under (post_as_villager username). */
  readonly name: string;
  /** Slack emoji face, colon form, e.g. ":mag:". */
  readonly icon: string;
  /** Path to the villager folder inside the sandbox workspace (cwd /workspace). */
  readonly dir: string;
  /** One line, third person: what this villager does (shown by list_villagers). */
  readonly description?: string;
  /**
   * Optional villager-specific framing appended to the generic base the Slack
   * handler builds (see agent/channels/slack.ts). Use it for operational glue the
   * model can't infer from instructions.md alone — the exact script invocation, or
   * a hard output contract. Omit it for a prose-only villager whose whole behavior
   * lives in its instructions.md.
   */
  readonly framing?: string;
}

/** One entry of villages.json. `framing` is an array of lines for readability. */
export interface VillagerRecord {
  slug: string;
  name: string;
  icon: string;
  dir: string;
  description?: string;
  framing?: string[];
}

/**
 * Channels where the midwife herself lives — birth interviews and village
 * management happen here, so a mention acts as the midwife, not a villager.
 * (DMs and any unlisted channel also default to the midwife.)
 */
export const MIDWIFE_CHANNELS: ReadonlySet<string> = new Set([
  "C0C0YRB5M47", // #villager-management
]);

/** Turn the JSON records into runtime Villagers (framing lines -> one string). */
export function registryFromJson(json: Record<string, VillagerRecord>): Record<string, Villager> {
  const out: Record<string, Villager> = {};
  for (const [channelId, r] of Object.entries(json)) {
    out[channelId] = {
      slug: r.slug,
      name: r.name,
      icon: r.icon,
      dir: r.dir,
      ...(r.description ? { description: r.description } : {}),
      ...(r.framing && r.framing.length > 0 ? { framing: r.framing.join("\n") } : {}),
    };
  }
  return out;
}

/** Slack channel id -> the villager born into it. */
export const VILLAGES: Readonly<Record<string, Villager>> = registryFromJson(
  registry as Record<string, VillagerRecord>,
);

/**
 * Resolve which villager owns a channel. Returns `null` when the channel is a
 * midwife channel, a DM, or simply has no villager yet — in every such case the
 * turn should behave as the midwife.
 */
export function villagerForChannel(channelId: string | undefined): Villager | null {
  if (!channelId) return null;
  if (MIDWIFE_CHANNELS.has(channelId)) return null;
  return VILLAGES[channelId] ?? null;
}
