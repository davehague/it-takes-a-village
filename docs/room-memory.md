# Room memory format

This directory is the community-brain memory for a villager room.

## Structure

- raw/ — append-only trace, channel history, and run logs
- atoms/ — one markdown file per fact or rule
- themes/ — one markdown file per theme
- index.md — generated theme map
- graph.json — lightweight graph of theme → atom relationships

## Progressive disclosure

The villager reads in layers:

1. theme list
2. atom summaries
3. exact evidence only when needed

This keeps context small and preserves traceability.

## Where this file lives

In `docs/`, not `agent/lib/`. Eve compiles everything under `agent/lib/` as an authored module and fails the build on a markdown file there (`discover/lib-entry-unsupported`). The room format is documentation, so it belongs with the other docs, which Eve ignores.
