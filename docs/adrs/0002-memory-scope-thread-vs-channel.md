# 0002 — Memory & interaction scope: thread vs channel

**Status:** Deferred (2026-09-12) — staying thread-based for now, revisit intentionally
**Related:** [0001](0001-knowledge-ingestion-model.md) (ingestion), `eve-verification.md` (`threadContext` is thread-scoped; run loop is mention-only)

## Context

Several axes are currently thread-centric, and David has flagged that the thread-based interaction model "isn't my favorite." We are deferring the discussion but recording it so we come back to it deliberately rather than by default. The axes, kept distinct because they can move independently:

- **Memory storage scope** — already **channel-scoped** (one channel = one villager; the brain lives at `villagers/<slug>/memory/`). This is settled and is *not* what's in question.
- **Extraction window** — thread-scoped ([0001] mines the current thread since a watermark).
- **Context recall** — thread-scoped (`threadContext` feeds the current thread's transcript; loose channel chatter is not seen).
- **Interaction / trigger** — mention-per-thread (the villager acts only on an explicit `@mention`, which anchors work to a thread). This is the anti-loop model and the part of the UX David finds awkward.

## Decision

**Deferred.** Stay thread-based for extraction, recall, and interaction for now. Do not build a channel-wide sweep, channel-wide context fetch, or an alternative trigger model yet.

## Consequences

- The villager learns and reasons only within threads it participates in; conversation it never joined is invisible to it (accepted for now).
- When we revisit, the open questions are: should the villager consider whole-channel context (via `conversations.history` + persistence)? should learning include a scheduled channel sweep? and is there a less thread-bound interaction model than mention-per-thread that stays safe against the runaway-loop failure (see `eve-verification.md`)? David's preference to move away from thread-based tagging is the trigger to reopen this.
