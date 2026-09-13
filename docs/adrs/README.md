# Architecture Decision Records

Short, dated records of decisions that shape the system, in [Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Context → Decision → Consequences). One decision per file, numbered. `Accepted` means we're building on it; `Deferred`/`Proposed` means we've parked it deliberately and captured the context so we can pick it up later. `plan.md` remains the source of truth for the design as a whole; ADRs record *why* a specific choice was made.

- [0001 — Knowledge ingestion model](0001-knowledge-ingestion-model.md) — Accepted. How channel conversation becomes attributed memory atoms: end-of-turn extraction over a watermark window, human-only sourcing, supersession.
- [0002 — Memory & interaction scope: thread vs channel](0002-memory-scope-thread-vs-channel.md) — Deferred. Whether the villager should see/learn at channel scope and whether mention-per-thread is the right interaction model.
