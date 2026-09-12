# Room memory format — the community brain of a research villager

A villager researches a question for the humans in its channel, and this is what it remembers. Everything is markdown on disk, and the room only ever grows: each search adds a trace, each sourced result adds a finding, each correction in the channel adds a rule. Implemented in `agent/lib/memory.ts`; seed a demo room with `node agent/lib/memory-demo.ts`.

## Structure

```
rooms/<channel_id>/
  raw/<YYYY-MM-DD>.md   # append-only trace: queries, results kept, run output
  atoms/<id>.md         # one file per finding, question, or rule
  themes/<name>.md      # GENERATED — one file per theme
  index.md              # GENERATED — the research map
  graph.json            # GENERATED — theme → atom edges
```

Atoms are append-only. `themes/`, `index.md` and `graph.json` are derived and rewritten on every compile, so they always describe every atom present — a theme no atom claims any more is deleted.

## The three kinds of atom

Research memory is not one undifferentiated pile. An atom is one of:

- **`finding`** — a sourced claim. It should carry a `citation` (URL, DOI, arXiv id); `index.md` lists findings that still lack one, because an uncited finding is hearsay.
- **`question`** — something the room wants chased down and cannot answer yet. These accumulate as the investigation develops and are the villager's agenda.
- **`rule`** — how *these humans* want research done ("prefer primary sources", "last 24 months unless foundational"). This is what a correction in the channel becomes once a human confirms it, and it is why the next run is better than the last.

Every atom records its `author`, so the wiki doubles as a map of who taught the room what. The kind is inferred from how people write (`inferKind`) and can be set explicitly — inference is a stopgap until the midwife's maintainer classifies with a model.

```markdown
---
id: atom-1
kind: finding
author: ren
source: exa
citation: arXiv:2608.27454
created_at: 2026-09-12T18:00:00.000Z
themes:
  - findings
---

Skills evolved against a 4B model improved a 9B model without retraining, which is
evidence that the maintained text carries the capability rather than the weights.
```

## Themes

A research vocabulary rather than a workflow one: `sources`, `findings`, `methods`, `open_questions`, `contradictions`, `terminology`, `scope`, `quality`. Themes are small and few enough to keep always-loaded; the atoms beneath them are the detail.

## Progressive disclosure

The villager reads in layers, so context stays small and every claim stays traceable:

1. the theme list, plus **every rule the room has taught** — rules apply to every run, not only to a query that happens to match them
2. atom summaries ranked against the question
3. the exact evidence, its citation, and the raw trace it came from

## Growing the room

- `recordAtom(roomPath, entry)` — add one atom and rebuild the derived files. This is the call a run step makes per finding, and the call the learning loop makes when a human's correction is confirmed as a rule.
- `appendRawTrace(roomPath, label, text)` — append a search's results or a run's output to today's raw file. Never edited, never summarized in place; it is the evidence trail an atom points back to.
- `compileRoomMemory(roomPath, entries)` — add several at once and recompile.

## Where this file lives

In `docs/`, not `agent/lib/`. Eve compiles everything under `agent/lib/` as an authored module and fails the build on a markdown file there (`discover/lib-entry-unsupported`). The room format is documentation, so it belongs with the other docs, which Eve ignores.
