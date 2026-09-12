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
  /**
   * Optional villager-specific framing appended to the generic base the Slack
   * handler builds (see agent/channels/slack.ts). Use it for operational glue the
   * model can't infer from instructions.md alone — the exact script invocation, or
   * a hard output contract. Omit it for a prose-only villager whose whole behavior
   * lives in its instructions.md.
   */
  readonly framing?: string;
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
    // Exa is script-driven: the model must run search.sh and answer only from its
    // results. This is the operational contract the base framing can't infer.
    framing: [
      "To answer: read the instructions, then cd into the folder and (a) read your brain, (b) run the search, e.g.:",
      "  cd village/villagers/exa-researcher",
      "  cat memory/index.md   # the rules this channel has taught you; obey any under 'How this room wants research done'",
      '  mkdir -p stages/01-research/output && SEARCH_OUT_DIR="$(pwd)/stages/01-research/output" scripts/search.sh "<the question>"',
      'Answer only from the search results, never from prior knowledge or as the midwife: every claim cites a source, and the brief ends with a "Confidence:" line. If a taught rule shaped the answer, say so briefly.',
    ].join("\n"),
  },
  // #new-project-ideas — advisory, prose-only villager (no scripts).
  C0C1A8TE605: {
    slug: "enterprise-architect",
    name: "Enterprise Architect",
    icon: ":triangular_ruler:",
    dir: "village/villagers/enterprise-architect",
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
