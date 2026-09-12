/**
 * Memory-ingestion hook for the listen loop.
 *
 * NO-OP today, on purpose. This is the single seam where channel chatter turns
 * into community-brain memory. The Slack `onMessage` handler calls it for EVERY
 * human message in a village channel — whether or not the villager replies. That
 * is the "listen always, act only when asked" split: acting is gated on a
 * mention; ingestion is not. Keep this signature stable so wiring memory in
 * later does not touch the call site.
 *
 * ── How to integrate memory later (community brain = per-channel scope) ───────
 *
 * The community brain is keyed by Slack channel id. There are three layers; add
 * them in this order.
 *
 * 1. RAW TRACE (cheapest, do first). Append a pointer — not a copy — for this
 *    message into the room's raw pool at
 *    `village/rooms/<channelId>/raw/`. Slack history IS the transcript, so store
 *    `{ channelId, ts, userId }`, not the text. Batch the commit (e.g. flush on
 *    a schedule or at the next birth/commit), never one git write per message.
 *    Use `ensureRoomStructure()` from `agent/lib/memory.ts`, which already lays
 *    out raw/ atoms/ themes/ index.md.
 *
 * 2. fileMemory (Eve built-in, Vercel Blob — runtime-mutable, survives between
 *    deploys). Declare a channel-scoped slot on the agent:
 *      import { fileMemory } from "eve/memory/file";
 *      fileMemory({ scope: (ctx) => slackChannelIdFrom(ctx) })
 *    Eve then recalls a small per-channel document each turn and maintains it via
 *    the save_memory / remove_memory tools. This — NOT the villages registry —
 *    is the right home for accumulating brain state, because it changes at
 *    runtime, not at birth. (The registry is birth-time config and stays in git.)
 *
 * 3. ATOMS (the learning loop; runs on human CONFIRMATION, not from here).
 *    A confirmed correction becomes an attributed atom via `createAtom` /
 *    `compileRoomMemory` in `agent/lib/memory.ts`, written under
 *    `village/rooms/<channelId>/atoms/` and committed with the author's name.
 *    Passive ingest (this function) only accumulates candidate context; a later
 *    "mine" step (on demand, or a scheduled batch) proposes atoms from it, and a
 *    human confirms before anything sticks.
 *
 * Do the model-cheap work here (append a pointer); never make a model call per
 * message — that is what makes always-on listening affordable.
 */
export interface IngestMessage {
  readonly channelId: string;
  readonly userId: string | undefined;
  readonly text: string;
  /** Thread root ts (equals the message ts for non-thread messages). */
  readonly threadTs: string;
  /** This message's ts. */
  readonly ts: string;
}

export async function ingestForMemory(_message: IngestMessage): Promise<void> {
  // Intentionally a no-op. See the module doc for how to wire memory in.
  // When implemented, this must stay cheap and never throw into the listen loop
  // — wrap real work in try/catch so ingestion can never block a reply.
}
