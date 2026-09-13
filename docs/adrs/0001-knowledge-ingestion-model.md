# 0001 — Knowledge ingestion model

**Status:** Accepted (2026-09-12)
**Related:** `plan.md` (learning loop), `eve-verification.md` (Learning-loop mechanics), `room-memory.md` (atom format), [0002](0002-memory-scope-thread-vs-channel.md) (deferred scope question)

## Context

A villager learns in public: the channel conversation should turn into attributed knowledge atoms that improve the next run. The hard part is not the mechanics of writing a file — it is getting *collection and non-collection* right. We must not collect an atom from every message (noise, contradictions, junk), we must not miss a real correction or preference, and — most importantly — the villager must never learn from its own unverified output, or it will bootstrap false beliefs.

Constraints that shape the design (verified, see `eve-verification.md`): Eve's memory lifecycle is turn-tied (a villager only "wakes" when mentioned); the sandbox `/workspace` persists across turns within one durable session (a Slack thread) but not across threads or redeploys; the transcript is attributed per speaker (`threadContext` carries Slack IDs, and we know our own bot id); and Ren's atom store (`agent/lib/memory.ts`) is append-only with generated `index.md`/`themes/`/`graph.json`. This ADR also assumes the Sep-12 pivot to autonomous memory (no human confirmation gate).

## Decision

Knowledge ingestion is a five-stage pipeline — **context → capture → extract → store → recall** — with the human-only safety line drawn between capture and extract.

1. **Trigger and window.** Extraction runs **at the end of each turn the villager takes**, over only the messages **new since the last one it processed** (a per-thread watermark = last-processed message `ts`, stored in the villager's `memory/` in the sandbox). This is timely, nearly free (already in a turn), idempotent (never re-mines a message, so it never double-collects), and **thread-scoped**. It learns from **all human parties in the thread**, not only whoever mentioned it.

2. **Human-only sourcing, with a web-findings exception.** An atom's source is only ever a **human statement** or a **cited web-search result**. The villager's own prose is **context, never a source**. The extractor hard-filters by author (our bot id is known); agent messages inform *understanding* (what a human is correcting or confirming) but can never become an atom. Sourced findings from a real search enter as findings *sourced from the web* (recorded in `raw/` with their citation), not as "the agent said so."

3. **Judgment over keywords.** The villager judges atom-worthiness against explicit criteria rather than firing on keywords. Atom-worthy = a **durable, general** instruction, preference, or fact ("exclude vendor blogs", "only EU regulation", "always name the primary source"). Not atom-worthy = a one-off question already answered, social chatter, a restatement of an existing rule, or anything ephemeral. **"Nothing here is worth saving" is an explicit, valid outcome** — the guardrail against over-collection.

4. **Supersession.** Atoms are append-only, so a new human statement that updates an existing rule records `supersedes: <id>`; `index.md` surfaces only *active* atoms. Without this, contradictory rules pile up and the brain rots — this is where "get it right" bites hardest.

5. **Idempotency.** The watermark plus an existence/dedup check prevents duplicate atoms across turns.

## Consequences

**Positive.** Timely and cheap (extraction rides the turn we're already in). Safe (no self-learning; agent output can never become knowledge). Bounded (won't collect every message; "nothing worth saving" is normal). Consistent (supersession keeps rules non-contradictory). Learns from the whole conversation, not just the mentioner.

**Limits / deferred.** Only threads the villager was in are mined — loose top-level channel chatter it never joined is not captured. Catching that needs a scheduled `conversations.history` sweep feeding a batch miner (the `ingestForMemory()` seam, still a no-op); deferred as out of scope for now (learning from conversations the villager participates in is a clean boundary and covers the demo). See [0002](0002-memory-scope-thread-vs-channel.md).

**Permanence is separate.** Atoms written during a turn persist within the thread's sandbox but not across threads or redeploys; making them permanent is a git commit by the midwife (the `birth`/`commit` pipeline), distinct from the write itself.

**State to persist.** The per-thread watermark must live somewhere durable-within-the-thread — the villager's `memory/` in the sandbox (e.g. a small state file). It is naturally per-thread because each thread is its own session/sandbox.
