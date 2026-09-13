# 0003 — Memory substrate: Blob live, git snapshot

**Status:** Accepted (2026-09-12)
**Related:** [0001](0001-knowledge-ingestion-model.md) (ingestion pipeline — this ADR decides where its "store" stage writes), `eve-verification.md` (sandbox not durable; sandbox firewall allows only `api.exa.ai`; `fileMemory`/Blob notes at line ~100), `plan.md` (learning loop, "git is the source of truth" — this ADR revises that for the *runtime memory store* specifically)

## Context

Learned atoms need to survive across threads and redeploys. They currently live only in a thread's sandbox `/workspace`, which persists across turns *within one thread* but is lost on a new thread or a redeploy. Making them permanent forced a hard question we had deferred: **where does villager memory actually live?**

The premise carried since the start was "git is the source of truth" — the villager is a folder anyone can open and read, and its `memory/atoms/` are git-tracked, human-readable, and reviewable (the "learn in public" story, stated in `CLAUDE.md` and the midwife's own instructions). We deliberately rejected Eve's Blob-backed `fileMemory()` once for this reason (`eve-verification.md` ~line 100: "a hidden Blob doc is not the learn-in-public story").

But making git the *runtime write target* is expensive and awkward, and that cost is what reopened the premise. Neither actor that runs during a turn can `git push`: the **sandbox** firewall allows only `api.exa.ai` (no git, no GitHub, no creds), and the **app runtime** is serverless with no repo checkout. The only automated path to git is the **GitHub REST API from an authored tool** (tools run in the app runtime with full `process.env` and normal network egress — `tools/overview.mdx:7`). That path carries real friction: a repo-scoped write token in app env, the Contents/Git-Data API sha-dance, and — worst — **every push to `main` auto-redeploys production** (GitHub↔Vercel is wired), so a naive per-atom commit means a redeploy per thing learned.

The two hard requirements pull in opposite directions: *"public + readable folder"* wants git; *"cheap runtime writes with no redeploy"* wants a runtime store. We are already on Vercel, so **Vercel Blob** is the natural runtime store — trivial writes from the app runtime (`put(key, content)`), durable, no GitHub token, no branch, no redeploy — but opaque, which by itself would gut "learn in public."

## Decision

**Two stores, each doing what it is good at — Blob is the live memory store, git is the public snapshot.**

1. **Blob = live runtime memory.** Every atom write goes to Vercel Blob. Keys mirror the folder path (`village/villagers/<slug>/memory/atoms/<id>.md`, plus generated `index.md`, `themes/`, `graph.json`) so Ren's file-based compiler (`agent/lib/memory.ts`) stays usable and the git snapshot is a trivial file copy. Writes are fast, durable across threads and redeploys, and never trigger a deploy.

2. **git = public snapshot.** A tool reads a villager's memory from Blob and commits the readable folder to the repo via the GitHub API — at **birth**, **on demand** (a midwife command), and optionally **periodically**. Because this is deliberate and infrequent, the redeploy-churn problem largely dissolves; the repo keeps the browsable, reviewable "learn in public" record.

3. **Write mechanism = C1: an app-runtime `record_atom` tool, not an in-sandbox script.** The sandbox firewall blocks Blob exactly as it blocks git, and cross-thread freshness forces app-side hydration regardless, so the sandbox cannot own memory. The villager calls a `record_atom` tool (app runtime) with the same arguments the old script took (`kind`, `author`, `text`, `citation`, `supersedes`); the tool reads current atoms from Blob, applies dedup + supersession + `index.md` rebuild (reusing `memory.ts`), and writes back to Blob. The **read side** is injected into the turn as `context` framing fetched from Blob (exactly as the speaker-map already is), so the sandbox never reads memory either. The **sandbox returns to pure compute** — it only runs `search.sh`. The in-sandbox `record-atom.mjs` is retired (kept in git history as the reference implementation of the logic).

This supersedes, for the runtime memory store only, the blanket "git is the source of truth." Git remains the source of truth for **code** (villager folders, `villages.ts`, the app) and for the **published record** of memory; Blob is the source of truth for **live, in-flight memory** between snapshots.

## Consequences

**Positive.** Runtime writes are trivial and never redeploy production (the sharpest cost of the git-primary path is gone). Cross-thread and cross-redeploy durability is real. The "learn in public" story survives — the readable folder is still in the repo, refreshed by snapshot. One implementation of the atom logic (the tool, reusing Ren's compiler), one clear separation of concerns: **sandbox = deterministic compute, Blob = live memory, git = public record, app tools = the bridge.** The same git-write tool powers **birth** (write folder + append `villages.ts`).

**Costs / tradeoffs.** Two stores instead of one, and a sync step between them (Blob → git). Memory can be *ahead* of git between snapshots — the repo shows the last-snapshotted state, not the live state (accepted: the live state is always in Blob; the snapshot is the published record, like a release). The atom-write **logic leaves the portable folder** and becomes an Eve-specific tool — a real, accepted departure from "a villager is a fully lift-and-shift folder": the folder still declares *what* to learn (`instructions.md`) and does its own compute (`search.sh`), but *where memory is stored* is now a harness responsibility. This was the explicit tradeoff chosen (C1 over C2, which would have kept the script plus hydrate/sync tools).

**Prerequisites / follow-ups.** Provision a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN` in the Vercel Production env and `.env.local` (verify early — this is load-bearing and unbuilt). A repo-scoped `GITHUB_TOKEN` for the snapshot/birth tool, in app env only, never in the folder/repo. Decide snapshot cadence (start with birth + on-demand; periodic later). Ren's `memory.ts` still doesn't honor `superseded_by` in a canonical recompile (pre-existing follow-up, now more relevant since the tool leans on the compiler).

**Not changed.** The ingestion *model* (ADR 0001) — end-of-turn, human-only sourcing, judgment, supersession — is unchanged; this ADR only relocates its "store" stage from sandbox-files to Blob-with-git-snapshot. Scope stays thread-based (ADR 0002).
