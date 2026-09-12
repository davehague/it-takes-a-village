/**
 * Village registry — the routing backbone.
 *
 * Maps a Slack channel to the villager that lives there. This is the index of
 * the git-tracked villager tree under `agent/sandbox/workspace/village/`: it is
 * tiny, changes only at birth (a deliberate commit that also redeploys), and
 * stays in the repo so it is readable, versioned, and reviewable alongside the
 * folders it points at. The birth/commit tool appends entries here.
 *
 * It is NOT runtime memory — the community brain (accumulating atoms) belongs in
 * Eve's fileMemory (Vercel Blob). This is birth-time config, so it lives in git.
 *
 * The Slack handler (which has `message.channelId`) reads this to decide whether
 * a turn should act as the midwife or as a specific villager.
 */

export interface Villager {
  /** Folder slug under village/villagers/. */
  readonly slug: string;
  /** Display name the villager posts under (post_as_villager username). */
  readonly name: string;
  /** Slack emoji face, colon form, e.g. ":mag:". */
  readonly icon: string;
  /** Path to the villager folder inside the sandbox workspace (cwd /workspace). */
  readonly dir: string;
}

/**
 * Channels where the midwife herself lives — birth interviews and village
 * management happen here, so a mention acts as the midwife, not a villager.
 * (DMs and any unlisted channel also default to the midwife.)
 */
export const MIDWIFE_CHANNELS: ReadonlySet<string> = new Set([
  "C0C0YRB5M47", // #villager-management
]);

/** Slack channel id -> the villager born into it. */
export const VILLAGES: Readonly<Record<string, Villager>> = {
  // #village-exa-researcher
  C0C1GK8SGKT: {
    slug: "exa-researcher",
    name: "Exa Researcher",
    icon: ":mag:",
    dir: "village/villagers/exa-researcher",
  },
};

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
