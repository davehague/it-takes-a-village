# Future — deferred scope

Ideas intentionally cut from the hackathon version to keep it focused on one thing: a villager that lives in a channel with multiple humans, plus the midwife and the **community brain**. Captured here so we can pick them up later. `plan.md` is the source of truth for what we're building today; this file is the parking lot.

## Personal brain (DM / per-user pool)

From the deploy-and-brains whiteboard (`docs/architecture-deploy-and-brains.md`). A human can DM the villager and see a private pool — that user's own pool plus the villager's own knowledge — never anyone else's private pool. The rule is read up, promote up, never read down: a DM turn reads its own pool plus the community brain; a channel turn never mounts a DM pool; promotion ("share this with the team") copies a personal atom up into the community brain, explicit and attributed. **For this version, only the community brain exists** — there is no DM/personal pool and no promotion step yet. The `dm/` path stays gitignored so private pools never land in the public repo when we do build this.

## Org-wide brain

A workspace-wide pool above the community brain — the institution learning across channels. Read up / promote up applies here too. Named as the extension, not built.

## Graduation (`eve deploy` per villager)

Each villager folder is a valid Eve agent directory from day one, so it can graduate to its own deployment with `eve deploy` — same artifact, two execution modes (interpreted while young, compiled when graduated). ~20-minute beat; a stretch goal, not core.

## Multi-stage villagers

A stage is a folder with its own `CONTEXT.md` and `output/`; stage 2 reads stage 1's `output/`. Single stage for the hackathon; multi-stage when a workflow earns it. When a stage needs isolation or a narrower tool set, it becomes a declared Eve subagent under `agent/subagents/`.

## Novel script generation

For the hackathon the midwife composes scripts from a small pre-written library (selected scripts can't hallucinate). Generating brand-new scripts from the interview is v2.

## Generated memory internals

Sliding-window context, `themes/` and `index.md` generated from atom frontmatter, compile-atoms-to-`skills/` at graduation, and a standalone compaction routine that takes a pool path. The hackathon keeps the community brain simple; these are the fuller memory architecture.

## UI visualization / read-only viz layer

Git stays the source of truth; a read-only UI over the villager folders and the community brain (to browse instructions, atoms, and who taught what) could come later. David's note.
