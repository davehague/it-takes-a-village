# 0004 — Channel-scoped interaction: ingest everything, act only on an explicit mention

**Status:** Accepted (2026-09-13) — supersedes [0002](0002-memory-scope-thread-vs-channel.md)
**Related:** [0001](0001-knowledge-ingestion-model.md) (ingestion), `eve-verification.md` (the runaway-loop post-mortem; why the run loop is mention-only)

## Context

ADR 0002 deferred the thread-vs-channel question until David's stated dislike of thread-based tagging triggered a deliberate revisit. The Sep 13 roadmap triage reopened it as item 5: the intended model is channel-scoped, where everything said in a village channel is available to the villager as context and the villager chimes in only when asked. The open question was what "asked" means. Three candidates were weighed: an explicit `@villager` mention; a mention or being addressed by name ("Researcher, what about…"); any top-level human question in the channel. The constraint is the runaway loop recorded in `eve-verification.md`: mention-only exists because a loop happened, and any looser trigger needs a bot-author guard and rate limiting the project does not have.

## Decision

**"Asked" means an explicit human `@villager` mention, and nothing else.** The villager acts only on a mention; it never acts on being named, on a question, or on a bot-authored message. Everything else said in the village channel, top-level messages and unmentioned thread replies alike, is **ingested as context only**: the villager may read it and learn from it (under the human-only sourcing rule in ADR 0001) but never responds to it. The cheap enabler is a config toggle, not code: enabling `message.channels` on the Vercel Connect trigger so those messages reach `onMessage` at all. David is flipping it.

Memory storage scope was already channel-scoped (one channel = one villager) and is unchanged.

## Consequences

- The anti-loop guarantee is preserved unchanged: the only thing that starts a villager turn is a human mention.
- Channel-wide context becomes possible once `message.channels` is on. The build that follows is the ingestion side: unmentioned channel messages feed the villager's context and extraction window, so a correction typed in-thread without a re-mention still lands as an atom. `ingestForMemory()` in `agent/lib/memory-ingest.ts` is the seam and is a no-op today.
- Addressed-by-name and any-question triggers are closed, not deferred. Reopen only with a concrete loop-safe design.
- The mention-per-thread UX David dislikes is mitigated, not removed: he no longer has to re-mention inside a thread for the villager to see a correction, but still mentions it to get a reply.
