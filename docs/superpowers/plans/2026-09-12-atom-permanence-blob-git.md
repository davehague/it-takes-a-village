# Atom Permanence — Blob Live Store + Git Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a villager's learned knowledge atoms durable across threads and redeploys by storing them in Vercel Blob at runtime and snapshotting them to git as the public "learn in public" record.

**Architecture:** Vercel Blob is the live memory store (cheap writes, no redeploy). An app-runtime `record_atom` tool reads/writes Blob via a small `MemoryStore` abstraction (Blob in prod, local filesystem in dev/test). The atom-write logic (dedup + supersession + lightweight index rebuild) is a pure TypeScript function over a directory, ported from the retired `record-atom.mjs`. The read side injects the current `index.md` from the store into the Slack turn as `context` (alongside the existing speaker-map). A separate `snapshot_memory` tool reads the store, runs Ren's canonical compiler, and commits the readable folder to a non-deploying git branch via the GitHub Git Data API. The sandbox returns to pure compute (`search.sh` only).

**Tech Stack:** TypeScript (ESM, `.ts` imports), Node 24 (type-stripping; tests via `node --test`), Eve v0.54.3 (`defineTool` from `eve/tools`), `@vercel/blob`, GitHub REST (Git Data API) via `fetch`, `zod` for tool schemas, `node:test` + `node:assert/strict`.

**Spec:** `docs/adrs/0003-memory-substrate-blob-live-git-snapshot.md` (substrate + write-mechanism decision). Supporting: `docs/adrs/0001-knowledge-ingestion-model.md` (ingestion model — unchanged, this plan only relocates its "store" stage), `docs/eve-verification.md` (sandbox/firewall facts, Blob notes ~line 100).

## Global Constraints

- **Node >= 24 required.** Resolve it in a non-interactive shell before any `node`/`npx`/`npm`: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"`. Do not hardcode a patch version.
- **Secrets never go in the villager folder or the repo.** `BLOB_READ_WRITE_TOKEN` and `GITHUB_TOKEN` live only in `.env.local` (gitignored) and the Vercel Production env. Document them in `.env.example` with empty values.
- **Synthetic/fictional data only** — repo, video, and post are public.
- **Commit/push to git only when the user (David) asks.** Tasks include `git commit` steps for the *local* repo history of this build; do not `git push` unless asked. (This is distinct from the `snapshot_memory` tool, which writes villager *memory* to a branch via the GitHub API — that is a runtime feature, not this plan's dev commits.)
- **Markdown: no hard-wrapped prose** — one paragraph per line.
- **Test command:** `node --test <path>.test.ts` (Node 24 strips types; imports use explicit `.ts` extensions, matching `agent/lib/memory.test.ts`). There is no `npm test` script; invoke `node --test` directly.
- **Tools are auto-discovered** from `agent/tools/*.ts` (a default-exported `defineTool(...)`); no registration in `agent.ts` is needed (see `agent/tools/post_as_villager.ts`).
- **Deploy** by pushing `main` (auto-redeploy) or `vercel deploy --prod --yes`; **never `eve deploy`** (broken in v0.54.3).
- **Typecheck** with `tsc` (the `typecheck` script) after TypeScript changes; it must pass with 0 errors.
- Git commit trailers (when David asks to commit):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EKnTJWT79h8SynSLc4uhWq
  ```

## Out of scope (separate plans)

- **Birth pipeline** (interview → template-fill a new villager folder → append `villages.ts` → land in git). It reuses this plan's `snapshot_memory` git-write path but is its own subsystem; plan it separately after this ships.
- **Channel-wide ingestion sweep** (`ingestForMemory` stays a no-op) — deferred by ADR 0002.

## File Structure

- **Create `agent/lib/record-atom.ts`** — pure async function `recordAtomInDir(memoryDir, entry)` that writes one atom (Ren's frontmatter), applies dedup + supersession, and rebuilds the lightweight live `index.md`. Ported from `record-atom.mjs`. Reuses `normalizeText`/`summarizeText` from `memory.ts`.
- **Create `agent/lib/record-atom.test.ts`** — unit tests for the above (create / dedup no-op / supersession / index rebuild), over a tmpdir.
- **Create `agent/lib/memory-store.ts`** — `MemoryStore` interface + `localFsStore(root)` + `blobStore(token)` + `getMemoryStore()` selector (Blob when `BLOB_READ_WRITE_TOKEN` set, else local fs at `agent/sandbox/workspace`). Also `memoryPrefix(slug)`.
- **Create `agent/lib/memory-store.test.ts`** — unit tests for `localFsStore` round-trip (pull/push/readIndex) over a tmpdir.
- **Create `agent/tools/record_atom.ts`** — the Eve tool: pull memory → `recordAtomInDir` → push changed files.
- **Create `agent/tools/snapshot_memory.ts`** — the Eve tool: pull a villager's memory from the store → run Ren's `compileRoomMemory` (canonical map) → commit the folder to a git branch via GitHub Git Data API.
- **Create `agent/lib/github-commit.ts`** — `commitFilesToBranch({ repo, branch, files, message, token })` using the Git Data API (`fetch`). Pure of Blob; unit-testable at the file-collection boundary, wire verified manually.
- **Modify `agent/lib/memory.ts`** — teach `readAtoms` to drop atoms carrying `superseded_by` (so the canonical snapshot matches the villager's live index). One-line filter + parse of the field.
- **Modify `agent/channels/slack.ts`** — `villagerContext` fetches the villager's `index.md` from the store and injects it, replacing the sandbox `cat memory/index.md` step.
- **Modify `agent/lib/villages.ts`** — rewrite the `exa-researcher` `framing`: drop the `cat memory/index.md` and `record-atom.mjs` bash lines; the brain now arrives as context and learning is via the `record_atom` tool.
- **Modify `agent/sandbox/workspace/village/villagers/exa-researcher/instructions.md`** — "What I do" step 1 and "How I learn" point at the injected brain + the `record_atom` tool, not sandbox files/scripts.
- **Delete `agent/sandbox/workspace/village/villagers/exa-researcher/scripts/record-atom.mjs`** — retired (its logic now lives in `record-atom.ts`; kept in git history).
- **Modify `.env.example`** — document `BLOB_READ_WRITE_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_MEMORY_BRANCH`.
- **Modify `package.json`** — add `@vercel/blob` dependency.
- **Modify docs** — `plan.md`, `status.md`, `eve-verification.md`, and the project memory file: reconcile "git is source of truth" with ADR 0003.

---

### Task 1: Prerequisites — install `@vercel/blob`, provision the Blob store, wire tokens

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `.env.example`
- Modify: `.env.local` (gitignored — local only)

**Interfaces:**
- Produces: `BLOB_READ_WRITE_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPO` (default `davehague/it-takes-a-village`), `GITHUB_MEMORY_BRANCH` (default `village-memory`) available in `.env.local` and documented in `.env.example`. `@vercel/blob` importable.

> **David-gated:** creating a Vercel Blob store and minting a GitHub token need dashboard/CLI access. Later offline-testable tasks (2, 3, 4, 5 partial, 6 file-collection) do NOT depend on this task completing; the Blob wire (Task 4 live check) and the snapshot wire (Task 6 live check) do. Do this task first if access is available; otherwise proceed to Task 2 and return.

- [ ] **Step 1: Install the Blob client**

Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
npm install @vercel/blob
```
Expected: `@vercel/blob` added to `package.json` dependencies; `node_modules/@vercel/blob` present.

- [ ] **Step 2: Create a Blob store and pull its token (David-gated)**

Run (needs Vercel auth + project linked):
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
npx vercel blob store add village-memory        # create the store (idempotent name)
npx vercel env pull .env.local                    # pulls BLOB_READ_WRITE_TOKEN into .env.local
```
If `vercel env pull` overwrites `.env.local`, re-add any local-only vars afterward. Confirm `.env.local` now contains a non-empty `BLOB_READ_WRITE_TOKEN=`.

- [ ] **Step 3: Mint a repo-scoped GitHub token (David-gated)**

Create a fine-grained personal access token scoped to `davehague/it-takes-a-village` with **Contents: read and write** permission. Add to `.env.local`:
```
GITHUB_TOKEN=github_pat_...
GITHUB_REPO=davehague/it-takes-a-village
GITHUB_MEMORY_BRANCH=village-memory
```

- [ ] **Step 4: Document the vars in `.env.example`**

Append to `.env.example`:
```
# --- Memory permanence (ADR 0003) ---
# Vercel Blob store token — the live memory store. Auto-pulled by `vercel env pull`
# after `vercel blob store add`. Must also be set in the Vercel Production env.
BLOB_READ_WRITE_TOKEN=

# GitHub token for the snapshot_memory tool (commits the readable memory folder to
# a non-deploying branch via the Git Data API). Fine-grained, repo-scoped, Contents:rw.
# App env only — NEVER commit a real value.
GITHUB_TOKEN=
GITHUB_REPO=davehague/it-takes-a-village
GITHUB_MEMORY_BRANCH=village-memory
```

- [ ] **Step 5: Verify the Blob round-trip (only if Step 2 done)**

Write a throwaway script **inside the project tree** (ESM ignores paths outside it) at `./_blob-check.mjs`:
```js
import { put, list } from "@vercel/blob";
const token = process.env.BLOB_READ_WRITE_TOKEN;
const key = "village/villagers/_check/memory/index.md";
const { url } = await put(key, "# hello\n", { access: "public", addRandomSuffix: false, allowOverwrite: true, token });
const text = await (await fetch(url)).text();
const { blobs } = await list({ prefix: "village/villagers/_check/", token });
console.log("wrote:", url, "| read:", JSON.stringify(text), "| listed:", blobs.map((b) => b.pathname));
```
Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
set -a; . ./.env.local; set +a
node ./_blob-check.mjs && rm ./_blob-check.mjs
```
Expected: prints the written URL, `"# hello\n"`, and a listing including `.../index.md`. Confirms `put`/`fetch`/`list` shapes for Task 2. Delete the script after.

- [ ] **Step 6: Commit (dependency + docs only; no secrets)**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add @vercel/blob + document memory-permanence env vars (ADR 0003)"
```

---

### Task 2: `memory-store.ts` — the store abstraction (fs impl TDD, Blob impl)

**Files:**
- Create: `agent/lib/memory-store.ts`
- Test: `agent/lib/memory-store.test.ts`

**Interfaces:**
- Consumes: `@vercel/blob` (`put`, `list`).
- Produces:
  - `memoryPrefix(slug: string): string` → `village/villagers/<slug>/memory/`
  - `interface MemoryStore { pull(slug: string, destDir: string): Promise<void>; push(slug: string, files: { path: string; content: string }[]): Promise<void>; readIndex(slug: string): Promise<string | null>; }`
    - `pull` writes every stored memory file for `slug` into `destDir` at its relative path (e.g. `atoms/x.md`, `index.md`). Empty store → writes nothing (dir stays empty).
    - `push` writes each `{ path, content }` (path relative to the memory root, e.g. `atoms/x.md`) to the store.
    - `readIndex` returns the text of `index.md` or `null` if absent.
  - `localFsStore(root: string): MemoryStore` — root is the workspace base (memory lives at `<root>/village/villagers/<slug>/memory`).
  - `blobStore(token: string): MemoryStore`
  - `getMemoryStore(): MemoryStore` — `blobStore(process.env.BLOB_READ_WRITE_TOKEN)` when that env var is set, else `localFsStore(<repo>/agent/sandbox/workspace)`.

- [ ] **Step 1: Write failing tests for `localFsStore`**

Create `agent/lib/memory-store.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { localFsStore, memoryPrefix } from "./memory-store.ts";

test("memoryPrefix builds the villager memory path", () => {
  assert.equal(memoryPrefix("exa-researcher"), "village/villagers/exa-researcher/memory/");
});

test("localFsStore round-trips push -> pull -> readIndex", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-root-"));
  const store = localFsStore(root);

  await store.push("demo", [
    { path: "index.md", content: "# Research map\n\nhello\n" },
    { path: "atoms/rule-x.md", content: "---\nid: rule-x\n---\n\nbody\n" },
  ]);

  assert.equal(await store.readIndex("demo"), "# Research map\n\nhello\n");

  const dest = await mkdtemp(join(tmpdir(), "store-dest-"));
  await store.pull("demo", dest);
  assert.equal(await readFile(join(dest, "index.md"), "utf8"), "# Research map\n\nhello\n");
  assert.equal(await readFile(join(dest, "atoms", "rule-x.md"), "utf8"), "---\nid: rule-x\n---\n\nbody\n");

  await rm(root, { recursive: true, force: true });
  await rm(dest, { recursive: true, force: true });
});

test("readIndex returns null when the store has no memory for a slug", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-empty-"));
  assert.equal(await localFsStore(root).readIndex("nobody"), null);
  await rm(root, { recursive: true, force: true });
});

test("pull into a dir for an empty slug writes nothing and does not throw", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-empty2-"));
  const dest = await mkdtemp(join(tmpdir(), "store-dest2-"));
  await localFsStore(root).pull("nobody", dest);
  await rm(root, { recursive: true, force: true });
  await rm(dest, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/memory-store.test.ts`
Expected: FAIL — cannot find module `./memory-store.ts`.

- [ ] **Step 3: Implement `memory-store.ts`**

Create `agent/lib/memory-store.ts`:
```ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { list, put } from "@vercel/blob";

/**
 * Where memory lives, and how it moves between the runtime store and a local
 * directory. Per ADR 0003: Vercel Blob is the live store in production; a local
 * filesystem store backs dev/test. Callers work in a local dir (so Ren's
 * file-based compiler in memory.ts applies unchanged) and pull/push around it.
 */

export function memoryPrefix(slug: string): string {
  return `village/villagers/${slug}/memory/`;
}

export interface MemoryStore {
  /** Write every stored memory file for `slug` into `destDir` at its relative path. */
  pull(slug: string, destDir: string): Promise<void>;
  /** Persist each file (path relative to the memory root, e.g. "atoms/x.md"). */
  push(slug: string, files: { path: string; content: string }[]): Promise<void>;
  /** The current index.md text, or null if the villager has no memory yet. */
  readIndex(slug: string): Promise<string | null>;
}

/** Recursively list files under a dir as paths relative to it (posix-style). */
async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

export function localFsStore(root: string): MemoryStore {
  const memRoot = (slug: string) => join(root, "village", "villagers", slug, "memory");
  return {
    async pull(slug, destDir) {
      const src = memRoot(slug);
      for (const rel of await walk(src)) {
        const content = await readFile(join(src, rel), "utf8");
        const target = join(destDir, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
    },
    async push(slug, files) {
      for (const f of files) {
        const target = join(memRoot(slug), f.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, f.content, "utf8");
      }
    },
    async readIndex(slug) {
      return readFile(join(memRoot(slug), "index.md"), "utf8").catch(() => null);
    },
  };
}

export function blobStore(token: string): MemoryStore {
  const prefix = memoryPrefix;
  return {
    async pull(slug, destDir) {
      const { blobs } = await list({ prefix: prefix(slug), token });
      for (const b of blobs) {
        const rel = b.pathname.slice(prefix(slug).length);
        if (!rel) continue;
        const content = await (await fetch(b.url)).text();
        const target = join(destDir, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
    },
    async push(slug, files) {
      for (const f of files) {
        await put(prefix(slug) + f.path, f.content, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
      }
    },
    async readIndex(slug) {
      const { blobs } = await list({ prefix: prefix(slug) + "index.md", token });
      const hit = blobs.find((b) => b.pathname === prefix(slug) + "index.md");
      return hit ? await (await fetch(hit.url)).text() : null;
    },
  };
}

/** Blob in production (token set), local filesystem otherwise. */
export function getMemoryStore(): MemoryStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return blobStore(token);
  const workspace = join(dirname(fileURLToPath(import.meta.url)), "..", "sandbox", "workspace");
  return localFsStore(workspace);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/memory-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; npx tsc`
Expected: 0 errors. (If `@vercel/blob` types are missing because Task 1 Step 1 was skipped, complete that install first.)

- [ ] **Step 6: Commit**

```bash
git add agent/lib/memory-store.ts agent/lib/memory-store.test.ts
git commit -m "feat: MemoryStore abstraction (Blob + local fs) for atom permanence"
```

---

### Task 3: `record-atom.ts` — port the atom-write logic to a pure TS function

**Files:**
- Create: `agent/lib/record-atom.ts`
- Test: `agent/lib/record-atom.test.ts`

**Interfaces:**
- Consumes: `normalizeText`, `summarizeText` from `./memory.ts`; `AtomKind` type from `./memory.ts`.
- Produces:
  - `type RecordAtomInput = { kind: AtomKind; author: string; text: string; citation?: string | null; source?: string; themes?: string[]; supersedes?: string | null }`
  - `type RecordAtomResult = { status: "recorded" | "duplicate"; id: string; changedFiles: string[] }`
  - `async function recordAtomInDir(memoryDir: string, input: RecordAtomInput): Promise<RecordAtomResult>` — writes `atoms/<id>.md` in `memory.ts` frontmatter, applies dedup (active atom, same kind + normalized text → no write, `status: "duplicate"`) and supersession (`supersedes` marks the target `superseded_by: <id>`), and rebuilds the lightweight live `index.md` (rules + open questions, superseded atoms excluded). `changedFiles` are paths relative to `memoryDir` that were written (for the store push).

This is a direct port of the retired `record-atom.mjs` (same id scheme, same guards, same index text), made async and returning changed files instead of writing a fixed dir.

- [ ] **Step 1: Write failing tests**

Create `agent/lib/record-atom.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordAtomInDir } from "./record-atom.ts";

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "record-atom-"));
}

test("records a rule, writes an atom file and a rules section", async () => {
  const d = await dir();
  const r = await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Exclude vendor blogs." });
  assert.equal(r.status, "recorded");
  assert.ok(r.id.startsWith("rule-"));
  assert.ok(r.changedFiles.includes("index.md"));
  assert.ok(r.changedFiles.some((f) => f.startsWith("atoms/")));

  const files = await readdir(join(d, "atoms"));
  assert.equal(files.length, 1);
  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /How this room wants research done/);
  assert.match(index, /Exclude vendor blogs\. — \*David Hague\*/);
  await rm(d, { recursive: true, force: true });
});

test("dedup: same kind + same text is a no-op", async () => {
  const d = await dir();
  await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Only the last 12 months." });
  const again = await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Only the last 12 months." });
  assert.equal(again.status, "duplicate");
  assert.deepEqual(again.changedFiles, []);
  assert.equal((await readdir(join(d, "atoms"))).length, 1);
  await rm(d, { recursive: true, force: true });
});

test("supersession: superseded atom drops out of the index", async () => {
  const d = await dir();
  const first = await recordAtomInDir(d, { kind: "rule", author: "Ren", text: "Only the last 12 months." });
  const second = await recordAtomInDir(d, {
    kind: "rule", author: "Ren", text: "Only the last 18 months.", supersedes: first.id,
  });
  assert.equal(second.status, "recorded");

  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /18 months/);
  assert.doesNotMatch(index, /12 months/);

  const oldFile = await readFile(join(d, "atoms", `${first.id}.md`), "utf8");
  assert.match(oldFile, new RegExp(`superseded_by: ${second.id}`));
  await rm(d, { recursive: true, force: true });
});

test("findings and questions land in their sections", async () => {
  const d = await dir();
  await recordAtomInDir(d, { kind: "question", author: "David Hague", text: "Does this replicate across harnesses?" });
  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /Open questions/);
  assert.match(index, /replicate across harnesses/);
  await rm(d, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/record-atom.test.ts`
Expected: FAIL — cannot find module `./record-atom.ts`.

- [ ] **Step 3: Implement `record-atom.ts`** (port of `record-atom.mjs`)

Create `agent/lib/record-atom.ts`:
```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeText, summarizeText, type AtomKind } from "./memory.ts";

/**
 * Deterministic write side of the learning loop (ADR 0001 store stage, ADR 0003
 * substrate). Ported from the retired scripts/record-atom.mjs so the logic lives
 * in the app runtime where the memory store (Blob) is reachable. Pure over a
 * directory: the caller hydrates `memoryDir` from the store, calls this, then
 * pushes `changedFiles` back. Atom files use memory.ts frontmatter so the
 * canonical compiler (compileRoomMemory) can regenerate the full map at snapshot.
 *
 * Guards (so autonomous calls stay safe):
 *  - DEDUP: an active atom with the same kind and same normalized text → no-op.
 *  - SUPERSESSION: `supersedes` marks the older atom superseded_by the new one;
 *    superseded atoms drop out of the active set and the index.
 */

export type RecordAtomInput = {
  kind: AtomKind;
  author: string;
  text: string;
  citation?: string | null;
  source?: string;
  themes?: string[];
  supersedes?: string | null;
};

export type RecordAtomResult = {
  status: "recorded" | "duplicate";
  id: string;
  changedFiles: string[];
};

function safeName(value: string, fallback: string): string {
  const safe = String(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/, "");
  return safe.length > 0 ? safe : fallback;
}

type LoadedAtom = {
  file: string;
  id: string;
  kind: string;
  author: string;
  supersededBy: string | null;
  body: string;
};

async function loadAtoms(atomsDir: string): Promise<LoadedAtom[]> {
  const files = (await readdir(atomsDir).catch(() => [])).filter((f) => f.endsWith(".md"));
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(atomsDir, file), "utf8");
      const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      const frontmatter = match ? match[1] : "";
      const body = normalizeText(match ? match[2] : raw);
      const scalars: Record<string, string> = {};
      for (const line of frontmatter.split("\n")) {
        const field = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
        if (field) scalars[field[1]] = field[2].trim();
      }
      return {
        file,
        id: scalars.id ?? file.replace(/\.md$/, ""),
        kind: scalars.kind ?? "finding",
        author: scalars.author ?? "unknown",
        supersededBy: scalars.superseded_by ?? null,
        body,
      };
    }),
  );
}

function buildIndex(active: LoadedAtom[]): string {
  if (active.length === 0) {
    return "# Research map\n\n0 atoms — the channel hasn't taught me anything yet.\n";
  }
  const rules = active.filter((a) => a.kind === "rule");
  const questions = active.filter((a) => a.kind === "question");
  const findings = active.filter((a) => a.kind === "finding");
  const out = [
    "# Research map",
    "",
    `${active.length} atoms — ${findings.length} findings, ${questions.length} open questions, ${rules.length} rules taught by the room.`,
    "",
    "_Live view of the active atoms; the midwife recompiles the full map (themes, graph) at snapshot._",
    "",
    "## How this room wants research done",
    "",
    rules.length ? rules.map((a) => `- ${summarizeText(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_",
    "",
    "## Open questions",
    "",
    questions.length ? questions.map((a) => `- ${summarizeText(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_",
    "",
  ];
  return out.join("\n");
}

export async function recordAtomInDir(
  memoryDir: string,
  input: RecordAtomInput,
): Promise<RecordAtomResult> {
  const atomsDir = join(memoryDir, "atoms");
  await mkdir(atomsDir, { recursive: true });

  const text = normalizeText(input.text);
  const kind = input.kind;
  const citation = input.citation ? normalizeText(input.citation) : null;
  const source = input.source ? safeName(input.source, "slack") : "slack";
  const themes = input.themes && input.themes.length
    ? input.themes.map((t) => safeName(t, "general")).filter(Boolean)
    : ["general"];

  const atoms = await loadAtoms(atomsDir);
  const active = atoms.filter((a) => !a.supersededBy);

  const dup = active.find((a) => a.kind === kind && a.body === text);
  if (dup) return { status: "duplicate", id: dup.id, changedFiles: [] };

  const now = new Date().toISOString();
  const id = `${kind}-${safeName(text, "atom")}-${createHash("sha256").update(`${text}|${now}`).digest("hex").slice(0, 6)}`;
  const changed: string[] = [];

  if (input.supersedes) {
    const target = atoms.find((a) => a.id === input.supersedes);
    if (!target) throw new Error(`supersedes: atom ${input.supersedes} not found`);
    const path = join(atomsDir, target.file);
    let content = await readFile(path, "utf8");
    content = content.replace(/^superseded_by:.*\n/m, "");
    content = content.replace(/^(---\n[\s\S]*?)(\n---)/m, `$1\nsuperseded_by: ${id}$2`);
    await writeFile(path, content, "utf8");
    changed.push(`atoms/${target.file}`);
  }

  const lines = ["---", `id: ${id}`, `kind: ${kind}`, `author: ${input.author}`, `source: ${source}`];
  if (citation) lines.push(`citation: ${citation}`);
  if (input.supersedes) lines.push(`supersedes: ${input.supersedes}`);
  lines.push(`created_at: ${now}`, "themes:");
  for (const theme of themes) lines.push(`  - ${theme}`);
  lines.push("---", "", text, "");
  await writeFile(join(atomsDir, `${id}.md`), lines.join("\n"), "utf8");
  changed.push(`atoms/${id}.md`);

  const updated = (await loadAtoms(atomsDir)).filter((a) => !a.supersededBy);
  await writeFile(join(memoryDir, "index.md"), buildIndex(updated), "utf8");
  changed.push("index.md");

  return { status: "recorded", id, changedFiles: changed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/record-atom.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; npx tsc`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add agent/lib/record-atom.ts agent/lib/record-atom.test.ts
git commit -m "feat: port record-atom logic to a pure TS function (dedup + supersession)"
```

---

### Task 4: `record_atom` tool — wire store + record-atom together

**Files:**
- Create: `agent/tools/record_atom.ts`

**Interfaces:**
- Consumes: `getMemoryStore` from `../lib/memory-store.ts`; `recordAtomInDir`, `RecordAtomInput` from `../lib/record-atom.ts`; `VILLAGES` from `../lib/villages.ts` (to validate `villagerSlug`); `defineTool` from `eve/tools`; `z` from `zod`.
- Produces: a default-exported Eve tool named by filename (`record_atom`). Args: `villagerSlug`, `kind`, `author`, `text`, `citation?`, `source?`, `themes?`, `supersedes?`. Returns `{ status, id }`.

The tool flow: resolve slug → `mkdtemp` scratch dir → `store.pull(slug, dir)` → `recordAtomInDir(join(dir, ...nothing... dir is the memory root))` → `store.push(slug, changedFiles.map(read))`. Note: `pull`/`push` operate on the memory root directly, so the scratch dir *is* the memory dir.

- [ ] **Step 1: Implement the tool**

Create `agent/tools/record_atom.ts`:
```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getMemoryStore } from "../lib/memory-store";
import { recordAtomInDir } from "../lib/record-atom";
import { VILLAGES } from "../lib/villages";

const slugs = new Set(Object.values(VILLAGES).map((v) => v.slug));

/**
 * Record one knowledge atom into a villager's live memory (Vercel Blob in prod,
 * local fs in dev — ADR 0003). The villager calls this at end of turn when a
 * HUMAN taught it something durable. Dedup + supersession are enforced in
 * recordAtomInDir; the caller (framing/instructions) enforces human-only sourcing.
 */
export default defineTool({
  description:
    "Record ONE durable knowledge atom you learned from a HUMAN in this channel (a research rule, a settled fact/finding, or an open question). Never record your own words. Dedups exact repeats and supersedes an older atom when a human changes a rule. Recording nothing is normal.",
  inputSchema: z.object({
    villagerSlug: z.string().min(1).describe("This villager's folder slug, e.g. 'exa-researcher' (given in your framing)."),
    kind: z.enum(["rule", "finding", "question"]).describe("rule = how to research; finding = a sourced fact (needs citation); question = something to chase."),
    author: z.string().min(1).describe("The readable NAME of the human who taught this (from the Speaker names list), never a raw Slack id."),
    text: z.string().min(1).describe("The rule/fact/question in one clear sentence."),
    citation: z.string().optional().describe("For a finding: the URL/DOI/arXiv id it came from. Required for findings."),
    source: z.string().optional().describe("Where it came from: 'slack' (a human said it) or 'exa' (a cited web result). Default slack."),
    themes: z.array(z.string()).optional().describe("Optional theme tags, e.g. ['scope','sources']."),
    supersedes: z.string().optional().describe("The id of an existing atom this replaces, when a human changed a prior rule."),
  }),
  label: {
    start: ({ kind, author }) => `Record ${kind} atom (taught by ${author})`,
  },
  async execute(input) {
    if (!slugs.has(input.villagerSlug)) {
      throw new Error(`Unknown villagerSlug '${input.villagerSlug}'`);
    }
    const store = getMemoryStore();
    const dir = await mkdtemp(join(tmpdir(), "village-mem-"));
    try {
      await store.pull(input.villagerSlug, dir);
      const result = await recordAtomInDir(dir, {
        kind: input.kind,
        author: input.author,
        text: input.text,
        citation: input.citation ?? null,
        source: input.source,
        themes: input.themes,
        supersedes: input.supersedes ?? null,
      });
      if (result.status === "recorded") {
        const files = await Promise.all(
          result.changedFiles.map(async (path) => ({ path, content: await readFile(join(dir, path), "utf8") })),
        );
        await store.push(input.villagerSlug, files);
      }
      return { status: result.status, id: result.id };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; npx tsc`
Expected: 0 errors.

- [ ] **Step 3: Verify Eve sees the tool**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; npx eve info`
Expected: "Compile ready", 0 errors, tool count increased (was 10; now includes `record_atom`).

- [ ] **Step 4: Live integration check against the store (local fs; Blob if Task 1 done)**

Write `./_record-atom-check.mjs` (inside the tree):
```js
import { getMemoryStore } from "./agent/lib/memory-store.ts";
import { recordAtomInDir } from "./agent/lib/record-atom.ts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const store = getMemoryStore();
const dir = await mkdtemp(join(tmpdir(), "check-"));
await store.pull("exa-researcher", dir);
const r = await recordAtomInDir(dir, { kind: "rule", author: "David Hague", text: "TEST: prefer primary sources over blog summaries." });
if (r.status === "recorded") {
  const files = await Promise.all(r.changedFiles.map(async (p) => ({ path: p, content: await readFile(join(dir, p), "utf8") })));
  await store.push("exa-researcher", files);
}
console.log("result:", r, "| index now:", (await store.readIndex("exa-researcher"))?.slice(0, 200));
await rm(dir, { recursive: true, force: true });
```
Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
set -a; . ./.env.local 2>/dev/null; set +a
node ./_record-atom-check.mjs && rm ./_record-atom-check.mjs
```
Expected: prints `status: 'recorded'` and an index.md preview containing the TEST rule. In local-fs mode this writes into `agent/sandbox/workspace/village/villagers/exa-researcher/memory/` — **revert that test write** afterward: `git checkout agent/sandbox/workspace/village/villagers/exa-researcher/memory/`. In Blob mode, remove the TEST atom via a quick `del` or leave for the live Slack test to supersede.

- [ ] **Step 5: Commit**

```bash
git add agent/tools/record_atom.ts
git commit -m "feat: record_atom tool — persist atoms to the memory store (Blob/fs)"
```

---

### Task 5: Read-side rewiring — inject the brain from the store; retire the sandbox script

**Files:**
- Modify: `agent/channels/slack.ts` (`villagerContext`)
- Modify: `agent/lib/villages.ts` (`exa-researcher` `framing`)
- Modify: `agent/sandbox/workspace/village/villagers/exa-researcher/instructions.md`
- Delete: `agent/sandbox/workspace/village/villagers/exa-researcher/scripts/record-atom.mjs`

**Interfaces:**
- Consumes: `getMemoryStore` from `../lib/memory-store.ts`.
- Produces: villager turns receive their current `index.md` as a `context` message; the villager learns via the `record_atom` tool (no sandbox memory read/write).

- [ ] **Step 1: Inject the brain in `slack.ts`**

In `agent/channels/slack.ts`, add the import at the top (after the villages import):
```ts
import { getMemoryStore } from "../lib/memory-store";
```
Add a helper above `villagerContext`:
```ts
/**
 * Fetch the villager's current brain (index.md) from the memory store and frame
 * it for the turn. Replaces the old sandbox `cat memory/index.md` step: memory
 * now lives in Blob (ADR 0003), which the sandbox can't reach, so the app runtime
 * reads it and injects it — like the speaker map. Best-effort: no brain yet or a
 * store error yields no line rather than breaking the reply.
 */
async function brainFraming(villager: Villager): Promise<string | null> {
  try {
    const index = await getMemoryStore().readIndex(villager.slug);
    if (!index || !index.trim()) return null;
    return [
      "Your brain — the rules and open questions this channel has taught you (from memory/index.md). Obey any rule under 'How this room wants research done' and say which shaped your answer:",
      "",
      index.trim(),
    ].join("\n");
  } catch {
    return null;
  }
}
```
Rewrite `villagerContext` to include it:
```ts
async function villagerContext(
  ctx: SlackInboundMessageContext,
  message: SlackMessage,
  villager: Villager,
): Promise<string[]> {
  const [brain, speakers] = await Promise.all([
    brainFraming(villager),
    speakerMapFraming(ctx, message),
  ]);
  return [villagerFraming(villager), brain, speakers].filter((s): s is string => s !== null);
}
```

- [ ] **Step 2: Rewrite the `exa-researcher` framing in `villages.ts`**

Replace the `framing` array (lines ~55-65) with:
```ts
    framing: [
      "Your brain (the rules and open questions this channel has taught you) is provided to you in this turn's context — read it and obey any rule under 'How this room wants research done'.",
      "To research: cd into your folder and run the search, e.g.:",
      "  cd village/villagers/exa-researcher",
      '  mkdir -p stages/01-research/output && SEARCH_OUT_DIR="$(pwd)/stages/01-research/output" scripts/search.sh "<the question>"',
      'Answer only from the search results, never from prior knowledge or as the midwife: every claim cites a source, and the brief ends with a "Confidence:" line. If a taught rule shaped the answer, say so briefly.',
      "AFTER you answer, manage your memory: look back at what the HUMANS in this thread said and decide if they taught you something durable (a research rule, a settled fact, or an open question). If so — and only from a human, never from your own words — record it with the record_atom tool:",
      "  record_atom(villagerSlug: 'exa-researcher', kind: 'rule'|'finding'|'question', author: '<the human's readable NAME from the Speaker names list>', text: '<one sentence>', citation?: '<url for a finding>', supersedes?: '<old atom id>')",
      "Do NOT record your own briefs, small talk, a question you just answered, or anything already in your brain (recording nothing is the normal case). If a human changes an existing rule, pass supersedes with the old atom's id (ids appear in your brain / index) so rules never contradict.",
    ].join("\n"),
```

- [ ] **Step 3: Update the villager's `instructions.md`**

In `agent/sandbox/workspace/village/villagers/exa-researcher/instructions.md`:
- "What I do" step 1 — replace the `memory/index.md` read line with:
  ```
  1. Read my brain first — it's given to me in this turn's context (the rules this channel has taught me and its open questions). If there are rules under "How this room wants research done", I obey them for this search and say which ones shaped the answer. If there are none yet, I just do my normal sourced search.
  ```
- "How I learn" — replace the script code block and its intro with:
  ```
  I record an atom with the record_atom tool — it persists the atom to my memory and updates my brain:

  record_atom(villagerSlug: "exa-researcher", kind: "rule"|"finding"|"question", author: "<the human who said it>", text: "<one sentence>", citation?: "<url|doi>", supersedes?: "<atom-id>")
  ```
- In the same "Don't repeat myself" bullet, change "check `memory/index.md`" to "check my brain (given in context)" and "the script also refuses exact duplicates" to "the tool also refuses exact duplicates".
- "Supersede, don't pile up" bullet — change "(I can see the ids in `memory/atoms/`)" to "(I can see the ids in my brain)".
- "Rules I've been taught" section — change "read `memory/index.md`" to "read my brain (provided in each turn's context)".

- [ ] **Step 4: Delete the retired script**

```bash
git rm agent/sandbox/workspace/village/villagers/exa-researcher/scripts/record-atom.mjs
```

- [ ] **Step 5: Typecheck + Eve compile**

Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
npx tsc && npx eve info
```
Expected: `tsc` 0 errors; `eve info` "Compile ready", 0 errors.

- [ ] **Step 6: Commit**

```bash
git add agent/channels/slack.ts agent/lib/villages.ts agent/sandbox/workspace/village/villagers/exa-researcher/instructions.md
git commit -m "feat: read brain from the memory store; learn via record_atom tool; retire sandbox script"
```

---

### Task 6: `snapshot_memory` tool — commit the readable folder to git via the GitHub API

**Files:**
- Create: `agent/lib/github-commit.ts`
- Create: `agent/lib/github-commit.test.ts`
- Create: `agent/tools/snapshot_memory.ts`
- Modify: `agent/lib/memory.ts` (`readAtoms` honors `superseded_by`)

**Interfaces:**
- Produces:
  - `agent/lib/github-commit.ts`: `async function commitFilesToBranch(opts: { repo: string; branch: string; files: { path: string; content: string }[]; message: string; token: string }): Promise<{ commitSha: string; url: string }>` — creates blobs, a tree (based on the branch head), a commit, and moves the ref, via the GitHub Git Data API. `path` is repo-relative.
  - `agent/tools/snapshot_memory.ts`: default-exported Eve tool `snapshot_memory`. Args: `villagerSlug`. Pulls memory from the store, runs Ren's `compileRoomMemory` for the canonical map, collects the folder's files, and commits them under `agent/sandbox/workspace/village/villagers/<slug>/memory/` to `GITHUB_MEMORY_BRANCH`. Returns `{ commitSha, url, fileCount }`.
- Consumes: `getMemoryStore`, `compileRoomMemory`/`readAtoms` from `memory.ts`.

- [ ] **Step 1: Teach `readAtoms` to honor `superseded_by` (Ren's `memory.ts`)**

In `agent/lib/memory.ts`, in `readAtoms`, after parsing frontmatter, skip superseded atoms. Change the per-file mapper: after `const { scalars, lists } = parseFrontmatter(frontmatter);` add:
```ts
      if (scalars.superseded_by) return null;
```
This makes the canonical compile match the villager's live index (superseded rules don't reappear). The existing `.filter((atom): atom is MemoryAtom => atom !== null)` already drops the nulls.

- [ ] **Step 2: Write a failing test for the superseded_by filter**

Add to `agent/lib/memory.test.ts`:
```ts
test("readAtoms drops atoms marked superseded_by", async () => {
  const roomPath = await room();
  await compileRoomMemory(roomPath, [
    { id: "old", author: "ren", source: "slack", kind: "rule", text: "Only the last 12 months." },
  ]);
  // Manually mark it superseded, as record-atom does.
  const p = join(roomPath, "atoms", "old.md");
  const raw = await readFile(p, "utf8");
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(p, raw.replace(/^(---\n[\s\S]*?)(\n---)/m, "$1\nsuperseded_by: new$2"), "utf8"),
  );
  const atoms = await readAtoms(roomPath);
  assert.equal(atoms.find((a) => a.id === "old"), undefined);
  await rm(roomPath, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run memory tests (fail then pass)**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/memory.test.ts`
Expected: the new test FAILS before Step 1's edit, PASSES after. (Do Step 1 first, then this passes; if you did Step 1 already, confirm all 10 pass.)

- [ ] **Step 4: Write failing test for `commitFilesToBranch` input shaping**

`commitFilesToBranch` itself calls GitHub and is verified live (Step 8). Its testable seam is the file collection in the tool; to keep this task's unit test meaningful, test that `github-commit.ts` exports the function and rejects a missing token early. Create `agent/lib/github-commit.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { commitFilesToBranch } from "./github-commit.ts";

test("commitFilesToBranch rejects an empty token", async () => {
  await assert.rejects(
    () => commitFilesToBranch({ repo: "a/b", branch: "x", files: [], message: "m", token: "" }),
    /token/i,
  );
});

test("commitFilesToBranch rejects when no files are given", async () => {
  await assert.rejects(
    () => commitFilesToBranch({ repo: "a/b", branch: "x", files: [], message: "m", token: "t" }),
    /no files/i,
  );
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/github-commit.test.ts`
Expected: FAIL — cannot find module `./github-commit.ts`.

- [ ] **Step 6: Implement `github-commit.ts`**

Create `agent/lib/github-commit.ts`:
```ts
/**
 * Commit a set of files to a branch via the GitHub Git Data API. This is how
 * runtime-learned memory reaches git (ADR 0003): neither the sandbox (firewall)
 * nor the plain app runtime has a repo checkout, so we write through the API with
 * a repo-scoped token. Multi-file atomic: blobs -> tree (on the branch head) ->
 * commit -> move ref.
 */

const API = "https://api.github.com";

async function gh(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function commitFilesToBranch(opts: {
  repo: string;
  branch: string;
  files: { path: string; content: string }[];
  message: string;
  token: string;
}): Promise<{ commitSha: string; url: string }> {
  const { repo, branch, files, message, token } = opts;
  if (!token) throw new Error("commitFilesToBranch: a GitHub token is required");
  if (files.length === 0) throw new Error("commitFilesToBranch: no files to commit");

  // Resolve the branch head (create the branch off the default branch if missing).
  let headSha: string;
  try {
    const ref = await gh(token, `/repos/${repo}/git/ref/heads/${branch}`);
    headSha = ref.object.sha;
  } catch {
    const repoInfo = await gh(token, `/repos/${repo}`);
    const base = await gh(token, `/repos/${repo}/git/ref/heads/${repoInfo.default_branch}`);
    headSha = base.object.sha;
    await gh(token, `/repos/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: headSha }),
    });
  }

  const baseCommit = await gh(token, `/repos/${repo}/git/commits/${headSha}`);

  const treeItems = await Promise.all(
    files.map(async (f) => {
      const blob = await gh(token, `/repos/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const tree = await gh(token, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }),
  });

  const commit = await gh(token, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });

  await gh(token, `/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: commit.sha, url: commit.html_url };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"; node --test agent/lib/github-commit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Implement the `snapshot_memory` tool**

Create `agent/tools/snapshot_memory.ts`:
```ts
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getMemoryStore } from "../lib/memory-store";
import { commitFilesToBranch } from "../lib/github-commit";
import { compileRoomMemory, readAtoms } from "../lib/memory";
import { VILLAGES } from "../lib/villages";

const slugs = new Set(Object.values(VILLAGES).map((v) => v.slug));

async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

/**
 * Snapshot a villager's live memory (from the store) to git — the public
 * "learn in public" record (ADR 0003). Runs Ren's canonical compiler so the
 * committed index/themes/graph match the atoms, then commits the folder to the
 * non-deploying GITHUB_MEMORY_BRANCH via the Git Data API.
 */
export default defineTool({
  description:
    "Snapshot a villager's learned memory (atoms) to git as the public record. Reads the live memory store, recompiles the canonical map, and commits the memory folder to the memory branch. Use when asked to make a villager's learning permanent/public.",
  inputSchema: z.object({
    villagerSlug: z.string().min(1).describe("The villager whose memory to snapshot, e.g. 'exa-researcher'."),
  }),
  label: { start: ({ villagerSlug }) => `Snapshot ${villagerSlug} memory to git` },
  async execute({ villagerSlug }) {
    if (!slugs.has(villagerSlug)) throw new Error(`Unknown villagerSlug '${villagerSlug}'`);
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MEMORY_BRANCH ?? "village-memory";

    const store = getMemoryStore();
    const dir = await mkdtemp(join(tmpdir(), "village-snap-"));
    try {
      await store.pull(villagerSlug, dir);
      // Canonical recompile: regenerate index/themes/graph from the atoms on disk.
      await compileRoomMemory(dir, []);

      const repoPrefix = `agent/sandbox/workspace/village/villagers/${villagerSlug}/memory/`;
      const files = await Promise.all(
        (await walk(dir)).map(async (rel) => ({
          path: repoPrefix + rel,
          content: await readFile(join(dir, rel), "utf8"),
        })),
      );
      if (files.length === 0) throw new Error(`No memory to snapshot for '${villagerSlug}'`);

      const atomCount = (await readAtoms(dir)).length;
      const result = await commitFilesToBranch({
        repo,
        branch,
        files,
        message: `memory: snapshot ${villagerSlug} (${atomCount} atoms)`,
        token,
      });
      return { ...result, fileCount: files.length, branch };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
```

- [ ] **Step 9: Typecheck + Eve compile**

Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
npx tsc && npx eve info
```
Expected: `tsc` 0 errors; `eve info` "Compile ready", 0 errors, `snapshot_memory` in the tool list.

- [ ] **Step 10: Live check the git write (David-gated — needs GITHUB_TOKEN)**

Write `./_snapshot-check.mjs`:
```js
import { commitFilesToBranch } from "./agent/lib/github-commit.ts";
const r = await commitFilesToBranch({
  repo: process.env.GITHUB_REPO ?? "davehague/it-takes-a-village",
  branch: process.env.GITHUB_MEMORY_BRANCH ?? "village-memory",
  files: [{ path: "agent/sandbox/workspace/village/villagers/exa-researcher/memory/_snapshot-check.md", content: "snapshot wire OK\n" }],
  message: "test: snapshot wire check",
  token: process.env.GITHUB_TOKEN,
});
console.log(r);
```
Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
set -a; . ./.env.local; set +a
node ./_snapshot-check.mjs && rm ./_snapshot-check.mjs
```
Expected: prints a commit sha + `html_url` on the `village-memory` branch (created if absent). Verify the branch got the file on GitHub, then delete the test file in a follow-up snapshot or manually. Confirms the branch is non-deploying (Vercel builds `main` only — check the Vercel dashboard shows no deploy triggered).

- [ ] **Step 11: Commit**

```bash
git add agent/lib/github-commit.ts agent/lib/github-commit.test.ts agent/tools/snapshot_memory.ts agent/lib/memory.ts agent/lib/memory.test.ts
git commit -m "feat: snapshot_memory tool — commit learned atoms to git via GitHub API; honor superseded_by"
```

---

### Task 7: End-to-end verification + doc reconciliation

**Files:**
- Modify: `docs/plan.md`, `docs/status.md`, `docs/eve-verification.md`
- Modify: `~/.claude/projects/-Users-davidhague-source-it-takes-a-village/memory/it-takes-a-village-hackathon.md`

**Interfaces:** none (verification + docs).

- [ ] **Step 1: Full test + typecheck sweep**

Run:
```bash
export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"
node --test agent/lib/*.test.ts && npx tsc && npx eve info
```
Expected: all tests pass, `tsc` 0 errors, `eve info` clean.

- [ ] **Step 2: Deploy and live-test the loop in Slack (David-gated)**

Deploy: `git push` (auto) or `vercel deploy --prod --yes`. Then in `#village-exa-researcher`:
1. `@villager <a research question>` → sourced brief.
2. `@villager from now on, exclude vendor blogs` → villager records a rule (check `record_atom` ran; a later mention shows the rule shaping the answer).
3. Start a **new thread** and ask again → the villager still obeys the rule (proves cross-thread durability via Blob — the win this plan delivers).
4. `@villager please snapshot your memory` (or invoke `snapshot_memory` via the midwife) → check the `village-memory` branch on GitHub shows the atoms.
Record results; if anything misbehaves, fix before doc updates.

- [ ] **Step 3: Reconcile the docs with ADR 0003**

- `docs/status.md`: update Next item 3 — the memory substrate is now Blob-live + git-snapshot (link ADR 0003); mark the atom-permanence work built; note the `record_atom` and `snapshot_memory` tools.
- `docs/plan.md`: where it says "git is the source of truth" for memory, add the ADR 0003 nuance (git is truth for code + the published memory record; Blob is truth for live memory between snapshots).
- `docs/eve-verification.md`: in the "Learning-loop mechanics" section, note the pivot from in-sandbox `record-atom.mjs` to the app-runtime `record_atom` tool over Blob, and that the read side is injected from the store (sandbox no longer reads/writes memory).
- Project memory file: update the "NEXT TASK" paragraph — atom permanence resolved via ADR 0003 (Blob live + git snapshot, C1 tool); set the next task to the birth pipeline (reuses `snapshot_memory`'s git-write path).

- [ ] **Step 4: Commit**

```bash
git add docs/plan.md docs/status.md docs/eve-verification.md
git commit -m "docs: reconcile memory model with ADR 0003 (Blob live + git snapshot); loop verified"
```

---

## Self-Review

**1. Spec coverage (ADR 0003):**
- "Blob = live runtime memory, keys mirror folder" → Task 2 (`blobStore`, `memoryPrefix`). ✓
- "git = public snapshot via a tool, at birth/on-demand/periodically" → Task 6 (`snapshot_memory`, on-demand; birth is a separate plan; periodic deferred). ✓ (periodic explicitly deferred — acceptable, ADR says "optionally periodically").
- "C1: app-runtime `record_atom` tool, not a sandbox script; read side injected as context; sandbox = pure compute; retire record-atom.mjs" → Tasks 4 + 5. ✓
- "reuse memory.ts compiler; honor superseded_by follow-up" → Task 6 Steps 1-3. ✓
- "prereqs: Blob store + BLOB_READ_WRITE_TOKEN; repo-scoped GITHUB_TOKEN; snapshot cadence birth+on-demand" → Task 1. ✓
- "supersedes runtime 'git is source of truth' for the live store only" → Task 7 doc reconciliation. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has real code; the two GitHub/Blob live checks are explicitly labeled David-gated wire checks with concrete throwaway scripts, not placeholders. ✓

**3. Type consistency:** `MemoryStore` methods (`pull`/`push`/`readIndex`) used identically in Tasks 2, 4, 5, 6. `recordAtomInDir(memoryDir, input) → { status, id, changedFiles }` defined in Task 3, consumed in Task 4. `commitFilesToBranch(opts) → { commitSha, url }` defined in Task 6 Step 6, consumed Step 8. `getMemoryStore()` defined Task 2, consumed Tasks 4/5/6. `memoryPrefix(slug)` defined and tested Task 2. Slug validation via `VILLAGES` in Tasks 4 and 6. ✓

**Note on dev-mode writes:** In local-fs mode (`BLOB_READ_WRITE_TOKEN` unset), `record_atom` writes into the git-tracked `agent/sandbox/workspace/.../memory/` folder. That is intended for dev/demo visibility, but means local runs mutate tracked files — revert with `git checkout` after local tests (called out in Task 4 Step 4). In production the token is set, so writes go to Blob and never touch the checkout.
