# Stage 01 — research

**Reads:** a research question from a human in the channel.

**Does:**
1. `scripts/search.sh "<question>"` → a cited source list (and `output/results.json`).
2. Synthesize the sources into a short brief — 3–6 bullets that answer the question, each ending with its source link.
3. Append a `Confidence:` line (high / medium / low) with a one-clause reason.

**Produces:** the brief, posted to the channel under the villager's own name (`post_as_villager`), plus `output/results.json` as the run trace.

**Determinism boundary:** `search.sh` is deterministic (same query → same cached sources, same exit code). Only the brief itself is prose the model writes — that is the one judgment step, because the output is prose.

Single stage today. Later stages would read this stage's `output/`.
