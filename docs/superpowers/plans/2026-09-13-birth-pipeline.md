# Birth Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The midwife births a prose-only villager from a Slack interview with one tool call that commits the villager folder + registry entry to `main` (auto-redeploy), after which the villager routes in its channel and learns via the existing memory loop.

**Architecture:** The registry data moves out of TypeScript into `villages.json` at the repo root (Eve's discovery rejects JSON under `agent/`); `agent/lib/villages.ts` loads it. A pure `agent/lib/birth.ts` renders the villager's `instructions.md` from a template (model-written prose + a canonical, tool-written "How I learn" contract) and builds the exact file set. A thin `birth_villager` tool resolves the Slack channel name to an ID, reads the current registry from `main` via the GitHub contents API, builds the files, and commits them with the existing `commitFilesToBranch`.

**Tech Stack:** Eve v0.54.3 (`defineTool`, `callSlackApi` from `eve/channels/slack`, `connectSlackCredentials` from `@vercel/connect/eve`), zod, Node 24 `node:test`, GitHub Git Data + contents APIs, TypeScript 7.0.2.

**Spec:** `docs/superpowers/specs/2026-09-13-birth-pipeline-design.md`

## Global Constraints

- Node 24 is required and is NOT on the default PATH. Every shell that runs `node`, `npx`, or `tsc` starts with: `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"`.
- Tests: `node --test <file>.test.ts` (Node strips types). Test files and any file a test imports use explicit `.ts` import extensions; app-only files use extensionless imports. Framework: `node:test` + `node:assert/strict`.
- Typecheck: `npx tsc --noEmit` must stay clean. Eve build check: `npx eve build` must succeed and `npx eve info` must list the expected tool count (13 today → 14 after Task 6).
- Deploy = push `main` (auto) or `vercel deploy --prod --yes`. NEVER `eve deploy`.
- Secrets never in the repo or a villager folder. `GITHUB_TOKEN`, `BLOB_READ_WRITE_TOKEN` live only in `.env.local` + Vercel Production env. Synthetic data only.
- Markdown: no hard-wrapped prose; one paragraph per line.
- Commits: David's standing rule is commit only when asked. Each task ends with a commit step; execute it only if David has authorized per-task commits for this plan, otherwise stage and stop. Commit trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01EKnTJWT79h8SynSLc4uhWq`.
- Repo paths: villager folders live at `agent/sandbox/workspace/village/villagers/<slug>/`; inside the sandbox that is `village/villagers/<slug>` (cwd `/workspace`).

---

### Task 1: Registry data → `villages.json` + loader

**Files:**
- Create: `villages.json` (repo root)
- Modify: `agent/lib/villages.ts` (replace the `VILLAGES` literal with a JSON loader; keep exports)
- Modify: `tsconfig.json` (add `resolveJsonModule`)
- Test: `agent/lib/villages.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export interface VillagerRecord { slug: string; name: string; icon: string; dir: string; framing?: string[] }`, `export function registryFromJson(json: Record<string, VillagerRecord>): Record<string, Villager>`, plus the unchanged `Villager`, `MIDWIFE_CHANNELS`, `VILLAGES`, `villagerForChannel`.

- [ ] **Step 1: Write the failing test**

```ts
// agent/lib/villages.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  MIDWIFE_CHANNELS,
  VILLAGES,
  registryFromJson,
  villagerForChannel,
} from "./villages.ts";

test("registry loads both existing villagers from villages.json", () => {
  assert.equal(villagerForChannel("C0C1GK8SGKT")?.slug, "exa-researcher");
  assert.equal(villagerForChannel("C0C1A8TE605")?.slug, "enterprise-architect");
  assert.equal(VILLAGES["C0C1GK8SGKT"].dir, "village/villagers/exa-researcher");
});

test("framing lines join into one string; missing framing stays undefined", () => {
  const exa = VILLAGES["C0C1GK8SGKT"];
  assert.ok(exa.framing?.startsWith("Your brain (the rules and open questions"));
  assert.ok(exa.framing?.includes("\n  cd village/villagers/exa-researcher\n"));
  assert.equal(VILLAGES["C0C1A8TE605"].framing, undefined);
});

test("midwife channels and unknown channels resolve to null", () => {
  assert.ok(MIDWIFE_CHANNELS.has("C0C0YRB5M47"));
  assert.equal(villagerForChannel("C0C0YRB5M47"), null);
  assert.equal(villagerForChannel("C0NOPE0000"), null);
  assert.equal(villagerForChannel(undefined), null);
});

test("registryFromJson maps records without mutating input", () => {
  const json = { C1: { slug: "a", name: "A", icon: ":a:", dir: "village/villagers/a", framing: ["x", "y"] } };
  const out = registryFromJson(json);
  assert.equal(out.C1.framing, "x\ny");
  assert.deepEqual(json.C1.framing, ["x", "y"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test agent/lib/villages.test.ts`
Expected: FAIL — `registryFromJson` is not exported (SyntaxError on import).

- [ ] **Step 3: Create `villages.json` at the repo root**

Copy the two entries verbatim from the current `agent/lib/villages.ts` (the framing lines are the exact strings from that file, one array element per line):

```json
{
  "C0C1GK8SGKT": {
    "slug": "exa-researcher",
    "name": "Exa Researcher",
    "icon": ":mag:",
    "dir": "village/villagers/exa-researcher",
    "framing": [
      "Your brain (the rules and open questions this channel has taught you) is provided to you in this turn's context — read it and obey any rule under 'How this room wants research done'.",
      "To research: cd into your folder and run the search, e.g.:",
      "  cd village/villagers/exa-researcher",
      "  mkdir -p stages/01-research/output && SEARCH_OUT_DIR=\"$(pwd)/stages/01-research/output\" scripts/search.sh \"<the question>\"",
      "Answer only from the search results, never from prior knowledge or as the midwife: every claim cites a source, and the brief ends with a \"Confidence:\" line. If a taught rule shaped the answer, say so briefly.",
      "AFTER you answer, manage your memory (learning loop): look back at what the HUMANS in this thread said and decide if they taught you something durable (a research rule, a settled fact, or an open question). If so — and only from a human, never from your own words — record it with the record_atom tool:",
      "  record_atom(villagerSlug: \"exa-researcher\", kind: \"rule\"|\"finding\"|\"question\", author: \"<the human's readable NAME>\", text: \"<one sentence>\", citation?: \"<url for a finding>\", supersedes?: \"<old atom id>\")",
      "For author use the readable NAME from the \"Speaker names in this thread\" list you were given, not the raw Slack id.",
      "Do NOT record your own briefs, small talk, a question you just answered, or anything already in your brain (recording nothing is the normal case). If a human changes an existing rule, pass supersedes with the old atom's id (ids appear in your brain) so rules never contradict."
    ]
  },
  "C0C1A8TE605": {
    "slug": "enterprise-architect",
    "name": "Enterprise Architect",
    "icon": ":triangular_ruler:",
    "dir": "village/villagers/enterprise-architect"
  }
}
```

- [ ] **Step 4: Add `resolveJsonModule` to `tsconfig.json`**

In `compilerOptions`, after `"allowImportingTsExtensions": true,` add `"resolveJsonModule": true,`.

- [ ] **Step 5: Rewrite `agent/lib/villages.ts` to load the JSON**

Replace the whole file with:

```ts
/**
 * Village registry — the routing backbone.
 *
 * Maps a Slack channel to the villager that lives there. The DATA lives in
 * `villages.json` at the repo root (Eve's discovery rejects JSON under agent/);
 * this module loads it and keeps the types + lookup. It is tiny, changes only at
 * birth (the `birth_villager` tool appends one key and commits — a deliberate
 * commit to main that also redeploys), and stays in git so it is readable,
 * versioned, and reviewable alongside the folders it points at.
 *
 * It is NOT runtime memory — the community brain (accumulating atoms) lives in
 * the memory store (Vercel Blob, ADR 0003). This is birth-time config.
 *
 * The Slack handler (which has `message.channelId`) reads this to decide whether
 * a turn should act as the midwife or as a specific villager.
 */

import registry from "../../villages.json" with { type: "json" };

export interface Villager {
  /** Folder slug under village/villagers/. */
  readonly slug: string;
  /** Display name the villager posts under (post_as_villager username). */
  readonly name: string;
  /** Slack emoji face, colon form, e.g. ":mag:". */
  readonly icon: string;
  /** Path to the villager folder inside the sandbox workspace (cwd /workspace). */
  readonly dir: string;
  /**
   * Optional villager-specific framing appended to the generic base the Slack
   * handler builds (see agent/channels/slack.ts). Use it for operational glue the
   * model can't infer from instructions.md alone — the exact script invocation, or
   * a hard output contract. Omit it for a prose-only villager whose whole behavior
   * lives in its instructions.md.
   */
  readonly framing?: string;
}

/** One entry of villages.json. `framing` is an array of lines for readability. */
export interface VillagerRecord {
  slug: string;
  name: string;
  icon: string;
  dir: string;
  framing?: string[];
}

/**
 * Channels where the midwife herself lives — birth interviews and village
 * management happen here, so a mention acts as the midwife, not a villager.
 * (DMs and any unlisted channel also default to the midwife.)
 */
export const MIDWIFE_CHANNELS: ReadonlySet<string> = new Set([
  "C0C0YRB5M47", // #villager-management
]);

/** Turn the JSON records into runtime Villagers (framing lines -> one string). */
export function registryFromJson(json: Record<string, VillagerRecord>): Record<string, Villager> {
  const out: Record<string, Villager> = {};
  for (const [channelId, r] of Object.entries(json)) {
    out[channelId] = {
      slug: r.slug,
      name: r.name,
      icon: r.icon,
      dir: r.dir,
      ...(r.framing && r.framing.length > 0 ? { framing: r.framing.join("\n") } : {}),
    };
  }
  return out;
}

/** Slack channel id -> the villager born into it. */
export const VILLAGES: Readonly<Record<string, Villager>> = registryFromJson(
  registry as Record<string, VillagerRecord>,
);

/**
 * Resolve which villager owns a channel. Returns `null` when the channel is a
 * midwife channel, a DM, or simply has no villager yet — in every such case the
 * turn should behave as the midwife.
 */
export function villagerForChannel(channelId: string | undefined): Villager | null {
  if (!channelId) return null;
  if (MIDWIFE_CHANNELS.has(channelId)) return null;
  return VILLAGES[channelId] ?? null;
}
```

- [ ] **Step 6: Run the tests and the full check**

Run: `node --test agent/lib/villages.test.ts && node --test agent/lib/*.test.ts && npx tsc --noEmit && npx eve build > /dev/null && npx eve info | grep -i tools`
Expected: villages tests PASS (4), all lib tests PASS (24 total), tsc clean, build OK, `Tools 13 tools`.

- [ ] **Step 7: Commit**

```bash
git add villages.json agent/lib/villages.ts agent/lib/villages.test.ts tsconfig.json
git commit -m "refactor: village registry data -> villages.json (birth tool writes data, not code)"
```

---

### Task 2: `birth.ts` — slug derivation + the instructions template

**Files:**
- Create: `agent/lib/birth.ts`
- Test: `agent/lib/birth.test.ts`

**Interfaces:**
- Consumes: `MIDWIFE_CHANNELS`, `VillagerRecord` from `./villages.ts` (Task 1).
- Produces: `export type BirthInput = { name: string; icon: string; slug?: string; intro: string; whatIDo: string; voice?: string }`, `export function deriveSlug(name: string): string`, `export function learningSection(slug: string): string`, `export function renderInstructions(input: BirthInput, slug?: string): string`, `export function emptyBrain(name: string): string`, `export const REGISTRY_PATH = "villages.json"`, `export const VILLAGERS_ROOT = "agent/sandbox/workspace/village/villagers"`.

- [ ] **Step 1: Write the failing tests**

```ts
// agent/lib/birth.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { deriveSlug, learningSection, renderInstructions } from "./birth.ts";

test("deriveSlug lowercases, dashes punctuation and spaces, trims dashes", () => {
  assert.equal(deriveSlug("Copywriter"), "copywriter");
  assert.equal(deriveSlug("  Meeting  Notes Bot! "), "meeting-notes-bot");
  assert.equal(deriveSlug("Café Critic"), "cafe-critic");
  assert.throws(() => deriveSlug("!!!"), /Cannot derive a slug/);
});

test("learningSection carries the slug into the record_atom line", () => {
  const s = learningSection("copywriter");
  assert.ok(s.startsWith("## How I learn\n"));
  assert.ok(s.includes('record_atom(villagerSlug: "copywriter", kind: "rule"|"finding"|"question"'));
  assert.ok(s.includes("## Rules I've been taught"));
  assert.ok(!s.endsWith("\n"));
});

test("renderInstructions assembles heading, intro, what-i-do, and the learning contract", () => {
  const md = renderInstructions({
    name: "Copywriter",
    icon: ":pencil:",
    intro: "I am **Copywriter** ✏️, a villager. I turn rough notes into tight copy.",
    whatIDo: "1. Read the notes.\n2. Draft.\n3. Tighten.",
  });
  assert.ok(md.startsWith("# Copywriter\n\nI am **Copywriter**"));
  assert.ok(md.includes("\n## What I do\n\n1. Read the notes.\n2. Draft.\n3. Tighten.\n"));
  assert.ok(!md.includes("## How I sound"));
  assert.ok(md.includes('villagerSlug: "copywriter"'));
  assert.ok(md.endsWith("who taught it and when.\n"));
});

test("renderInstructions includes 'How I sound' only when voice is given", () => {
  const md = renderInstructions({
    name: "Copywriter",
    icon: ":pencil:",
    intro: "I am Copywriter.",
    whatIDo: "Draft copy.",
    voice: "Dry, short sentences.",
  });
  assert.ok(md.includes("\n## How I sound\n\nDry, short sentences.\n\n## How I learn\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test agent/lib/birth.test.ts`
Expected: FAIL — cannot find module `./birth.ts`.

- [ ] **Step 3: Write `agent/lib/birth.ts` (template + rendering; `buildBirthFiles` comes in Task 3)**

```ts
/**
 * Birth — the pure half of the birth pipeline (spec: docs/superpowers/specs/
 * 2026-09-13-birth-pipeline-design.md). Renders a prose-only villager's
 * instructions.md and the exact file set a birth commits. No I/O: the
 * birth_villager tool supplies the registry and the channel id and does the
 * Slack/GitHub work.
 *
 * Division of labour: the model (midwife) writes the prose that makes the
 * villager itself (intro, what it does, voice); this module appends the
 * canonical "How I learn" contract so every villager records atoms correctly.
 */

import { MIDWIFE_CHANNELS, type VillagerRecord } from "./villages.ts";

/** Repo-relative path of the registry data file (see agent/lib/villages.ts). */
export const REGISTRY_PATH = "villages.json";
/** Repo-relative root of villager folders. In the sandbox it is village/villagers. */
export const VILLAGERS_ROOT = "agent/sandbox/workspace/village/villagers";

export type BirthInput = {
  /** Display name, e.g. "Copywriter". */
  name: string;
  /** Slack emoji face in colon form, e.g. ":pencil:". */
  icon: string;
  /** Optional slug override; otherwise derived from name. */
  slug?: string;
  /** One paragraph: "I am **Copywriter** ✏️, a villager. I ...". */
  intro: string;
  /** Markdown body of the "What I do" section. */
  whatIDo: string;
  /** Optional short paragraph on tone, rendered as "How I sound". */
  voice?: string;
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ICON_RE = /^:[a-z0-9_+-]+:$/;

/** "Meeting Notes Bot!" -> "meeting-notes-bot". Throws when nothing survives. */
export function deriveSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Cannot derive a slug from name '${name}' — pass an explicit slug.`);
  return slug;
}

// Byte-identical for every villager except {{slug}}. Kept as lines so the
// fenced record_atom block needs no backtick escaping.
const LEARNING_SECTION_LINES = [
  "## How I learn",
  "",
  "I manage my own memory. After I answer, I look back at what the **humans** in this thread said and decide for myself whether they taught me something durable — a standing rule about how to do my job, a settled fact worth keeping, or an open question worth tracking. If so, I record it as a knowledge atom, then and there, with the teacher's name on it. No one needs to approve it; if I get it wrong, someone will correct me and that correction becomes a new atom.",
  "",
  "I record an atom with the `record_atom` tool — it persists the atom to my memory and updates my brain:",
  "",
  "```",
  'record_atom(villagerSlug: "{{slug}}", kind: "rule"|"finding"|"question", author: "<the human who said it>", text: "<the rule/fact/question, in one sentence>", citation?: "<url|doi>", supersedes?: "<atom-id>")',
  "```",
  "",
  "Rules for what I do and don't record:",
  "",
  "- **Only from humans.** I never record my own words as knowledge. My replies are not facts to learn from — only what a person in the channel tells me is. (A finding must carry a `citation` to a real source, never \"because I said so\".)",
  "- **Attribute by name.** I'm given a \"Speaker names in this thread\" list mapping Slack ids to readable names. I set `author` to the person's name, never the raw `U…` id.",
  "- **Only durable, general things.** A correction, a standing preference, a settled fact, a real open question. Not one-off small talk, not a question I just answered, not a restatement of something already in my brain.",
  "- **Don't repeat myself.** Before recording, I check my brain (given in my context). If the rule is already there, I don't add it again (the tool also refuses exact duplicates). \"Nothing here is worth saving\" is a perfectly normal outcome.",
  "- **Supersede, don't pile up.** If a human *changes* an existing rule, I record the new rule with `supersedes: <the old atom's id>` (ids appear in my brain), so my brain never holds two rules that contradict each other.",
  "",
  "I never rewrite my own instructions or scripts — only my memory. Changing what I *am* stays a deliberate act by a human and the midwife.",
  "",
  "## Rules I've been taught",
  "",
  "These live in my brain, not here — read my brain (provided in each turn's context) for the current list. It starts empty and grows as the channel teaches me; each rule records who taught it and when.",
];

/** The canonical learning contract for a villager (no trailing newline). */
export function learningSection(slug: string): string {
  return LEARNING_SECTION_LINES.join("\n").replaceAll("{{slug}}", slug);
}

/** Render a prose-only villager's instructions.md. */
export function renderInstructions(input: BirthInput, slug: string = input.slug ?? deriveSlug(input.name)): string {
  const parts = [`# ${input.name.trim()}`, "", input.intro.trim(), "", "## What I do", "", input.whatIDo.trim(), ""];
  if (input.voice && input.voice.trim()) parts.push("## How I sound", "", input.voice.trim(), "");
  parts.push(learningSection(slug));
  return parts.join("\n") + "\n";
}

/** The public snapshot of a brain that has not learned anything yet. */
export function emptyBrain(name: string): string {
  return `# ${name.trim()} — brain\n\nThis brain starts empty and grows as the channel teaches me. Live memory lives in the memory store (ADR 0003); this file is the public snapshot and is rewritten by \`snapshot_memory\`.\n`;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test agent/lib/birth.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add agent/lib/birth.ts agent/lib/birth.test.ts
git commit -m "feat: birth template — slug derivation + instructions.md renderer with canonical learning contract"
```

---

### Task 3: `birth.ts` — `buildBirthFiles` (validation + exact file set)

**Files:**
- Modify: `agent/lib/birth.ts` (append `buildBirthFiles`)
- Test: `agent/lib/birth.test.ts` (append tests)

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: `export function buildBirthFiles(args: { registry: Record<string, VillagerRecord>; channelId: string; input: BirthInput }): { files: { path: string; content: string }[]; registry: Record<string, VillagerRecord>; slug: string; dir: string }`.

- [ ] **Step 1: Append the failing tests**

```ts
// append to agent/lib/birth.test.ts
import { buildBirthFiles, REGISTRY_PATH } from "./birth.ts";

const registry = {
  C0C1GK8SGKT: { slug: "exa-researcher", name: "Exa Researcher", icon: ":mag:", dir: "village/villagers/exa-researcher" },
};
const input = {
  name: "Copywriter",
  icon: ":pencil:",
  intro: "I am **Copywriter** ✏️, a villager.",
  whatIDo: "Draft copy.",
};

test("buildBirthFiles returns the four repo files and a registry with exactly one new key", () => {
  const out = buildBirthFiles({ registry, channelId: "C0NEW00001", input });
  assert.equal(out.slug, "copywriter");
  assert.equal(out.dir, "village/villagers/copywriter");
  assert.deepEqual(
    out.files.map((f) => f.path),
    [
      "agent/sandbox/workspace/village/villagers/copywriter/instructions.md",
      "agent/sandbox/workspace/village/villagers/copywriter/memory/index.md",
      "agent/sandbox/workspace/village/villagers/copywriter/memory/atoms/.gitkeep",
      REGISTRY_PATH,
    ],
  );
  const written = JSON.parse(out.files[3].content);
  assert.deepEqual(Object.keys(written), ["C0C1GK8SGKT", "C0NEW00001"]);
  assert.deepEqual(written.C0NEW00001, {
    slug: "copywriter",
    name: "Copywriter",
    icon: ":pencil:",
    dir: "village/villagers/copywriter",
  });
  assert.ok(out.files[3].content.endsWith("}\n"));
  assert.equal(out.files[2].content, "");
  assert.ok(out.files[0].content.includes('villagerSlug: "copywriter"'));
  // input registry untouched
  assert.deepEqual(Object.keys(registry), ["C0C1GK8SGKT"]);
});

test("buildBirthFiles honours an explicit slug", () => {
  const out = buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, slug: "copy-bot" } });
  assert.equal(out.slug, "copy-bot");
  assert.ok(out.files[0].path.includes("/copy-bot/"));
});

test("buildBirthFiles rejects a slug already in use", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, name: "Exa Researcher" } }),
    /Slug 'exa-researcher' is already used/,
  );
});

test("buildBirthFiles rejects a channel that already has a villager", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0C1GK8SGKT", input }),
    /Channel C0C1GK8SGKT already has a villager \('Exa Researcher'/,
  );
});

test("buildBirthFiles rejects a midwife channel", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0C0YRB5M47", input }),
    /is a midwife channel/,
  );
});

test("buildBirthFiles rejects a bad icon, a bad slug, and empty prose", () => {
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, icon: "pencil" } }), /colon form/);
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, slug: "Copy Bot" } }), /Slug 'Copy Bot' is invalid/);
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, whatIDo: "  " } }), /non-empty whatIDo/);
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node --test agent/lib/birth.test.ts`
Expected: FAIL — `buildBirthFiles` is not exported.

- [ ] **Step 3: Append `buildBirthFiles` to `agent/lib/birth.ts`**

```ts
export type BirthFile = { path: string; content: string };

export type BirthFiles = {
  /** Repo-relative files to commit, in order: instructions, brain, .gitkeep, registry. */
  files: BirthFile[];
  /** The registry after the birth (input is not mutated). */
  registry: Record<string, VillagerRecord>;
  slug: string;
  /** Sandbox-relative villager dir, e.g. village/villagers/copywriter. */
  dir: string;
};

function requireText(input: BirthInput, field: "name" | "icon" | "intro" | "whatIDo"): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Birth needs a non-empty ${field}.`);
  }
  return value.trim();
}

/**
 * Validate a birth and build the exact file set to commit. Pure: the caller
 * supplies the current registry (read from git) and the resolved channel id.
 */
export function buildBirthFiles(args: {
  registry: Record<string, VillagerRecord>;
  channelId: string;
  input: BirthInput;
}): BirthFiles {
  const { registry, channelId, input } = args;
  const name = requireText(input, "name");
  const icon = requireText(input, "icon");
  requireText(input, "intro");
  requireText(input, "whatIDo");

  if (!ICON_RE.test(icon)) {
    throw new Error(`Icon '${icon}' must be a Slack emoji in colon form, e.g. ':pencil:'.`);
  }
  const slug = input.slug?.trim() || deriveSlug(name);
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Slug '${slug}' is invalid — use lowercase letters, digits, and single dashes (e.g. 'copywriter').`);
  }
  if (MIDWIFE_CHANNELS.has(channelId)) {
    throw new Error(`Channel ${channelId} is a midwife channel — villagers can't be born there.`);
  }
  const occupant = registry[channelId];
  if (occupant) {
    throw new Error(`Channel ${channelId} already has a villager ('${occupant.name}', slug '${occupant.slug}').`);
  }
  for (const [otherChannel, r] of Object.entries(registry)) {
    if (r.slug === slug) {
      throw new Error(`Slug '${slug}' is already used by villager '${r.name}' in channel ${otherChannel}.`);
    }
  }

  const dir = `village/villagers/${slug}`;
  const record: VillagerRecord = { slug, name, icon, dir };
  const next: Record<string, VillagerRecord> = { ...registry, [channelId]: record };
  const base = `${VILLAGERS_ROOT}/${slug}`;

  const files: BirthFile[] = [
    { path: `${base}/instructions.md`, content: renderInstructions({ ...input, name, icon }, slug) },
    { path: `${base}/memory/index.md`, content: emptyBrain(name) },
    { path: `${base}/memory/atoms/.gitkeep`, content: "" },
    { path: REGISTRY_PATH, content: JSON.stringify(next, null, 2) + "\n" },
  ];
  return { files, registry: next, slug, dir };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test agent/lib/birth.test.ts && npx tsc --noEmit`
Expected: PASS (10 tests), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add agent/lib/birth.ts agent/lib/birth.test.ts
git commit -m "feat: buildBirthFiles — validated villager folder + registry update as one file set"
```

---

### Task 4: Slack channel resolution (`slack-channels.ts` pure + `slack-client.ts` network)

**Files:**
- Create: `agent/lib/slack-channels.ts` (pure)
- Create: `agent/lib/slack-client.ts` (network; shared auth defaults)
- Modify: `agent/tools/post_as_villager.ts` (use `slackAuth()`; behavior unchanged)
- Test: `agent/lib/slack-channels.test.ts`

**Interfaces:**
- Consumes: `callSlackApi` from `eve/channels/slack`; `connectSlackCredentials` from `@vercel/connect/eve`.
- Produces: `export const CHANNEL_ID_RE`, `export function normalizeChannelName(input: string): string`, `export type SlackChannelSummary = { id: string; name: string }`, `export function pickChannel(channels: SlackChannelSummary[], wanted: string): { match: SlackChannelSummary | null; suggestions: string[] }` (pure); `export function slackAuth(): { botToken: SlackBotToken; teamId: string }`, `export async function listPublicChannels(): Promise<SlackChannelSummary[]>`, `export async function resolveChannelId(channel: string): Promise<SlackChannelSummary>` (network).

- [ ] **Step 1: Write the failing test (pure helpers only — no network in unit tests)**

```ts
// agent/lib/slack-channels.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { CHANNEL_ID_RE, normalizeChannelName, pickChannel } from "./slack-channels.ts";

const channels = [
  { id: "C1", name: "village-exa-researcher" },
  { id: "C2", name: "village-copywriter" },
  { id: "C3", name: "general" },
  { id: "C4", name: "villager-management" },
];

test("CHANNEL_ID_RE accepts Slack channel ids and rejects names", () => {
  assert.ok(CHANNEL_ID_RE.test("C0C1GK8SGKT"));
  assert.ok(CHANNEL_ID_RE.test("G0ABCDEFGH"));
  assert.ok(!CHANNEL_ID_RE.test("#village-copywriter"));
  assert.ok(!CHANNEL_ID_RE.test("c0c1gk8sgkt"));
});

test("normalizeChannelName strips # and whitespace and lowercases", () => {
  assert.equal(normalizeChannelName("  #Village-Copywriter "), "village-copywriter");
  assert.equal(normalizeChannelName("general"), "general");
});

test("pickChannel finds an exact (normalized) match with no suggestions", () => {
  const { match, suggestions } = pickChannel(channels, "#Village-Copywriter");
  assert.equal(match?.id, "C2");
  assert.deepEqual(suggestions, []);
});

test("pickChannel suggests up to three near names when nothing matches", () => {
  const { match, suggestions } = pickChannel(channels, "#village-copy");
  assert.equal(match, null);
  assert.deepEqual(suggestions, ["village-exa-researcher", "village-copywriter", "villager-management"]);
});

test("pickChannel returns no suggestions for a totally unrelated name", () => {
  assert.deepEqual(pickChannel(channels, "zzz").suggestions, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test agent/lib/slack-channels.test.ts`
Expected: FAIL — cannot find module `./slack-channels.ts`.

- [ ] **Step 3: Write `agent/lib/slack-channels.ts` (pure)**

```ts
/**
 * Pure helpers for turning a human-typed "#channel-name" into a Slack channel
 * match. No Eve or network imports so this stays unit-testable; the network
 * half (listing channels) lives in slack-client.ts.
 */

export type SlackChannelSummary = { id: string; name: string };

/** Slack public/private channel ids: C… or G…, uppercase alphanumerics. */
export const CHANNEL_ID_RE = /^[CG][A-Z0-9]{8,}$/;

/** "  #Village-Copywriter " -> "village-copywriter". */
export function normalizeChannelName(input: string): string {
  return input.trim().replace(/^#/, "").trim().toLowerCase();
}

/**
 * Exact (normalized) name match, else up to three suggestions: names that
 * contain the request or share its first four characters.
 */
export function pickChannel(
  channels: SlackChannelSummary[],
  wanted: string,
): { match: SlackChannelSummary | null; suggestions: string[] } {
  const name = normalizeChannelName(wanted);
  const match = channels.find((c) => c.name.toLowerCase() === name) ?? null;
  if (match) return { match, suggestions: [] };
  const prefix = name.slice(0, 4);
  const suggestions = channels
    .map((c) => c.name)
    .filter((n) => n.toLowerCase().includes(name) || (prefix.length === 4 && n.toLowerCase().startsWith(prefix)))
    .slice(0, 3);
  return { match: null, suggestions };
}
```

- [ ] **Step 4: Write `agent/lib/slack-client.ts` (network)**

```ts
/**
 * Slack from an app-runtime tool. A tool's execute() runs outside every Slack
 * handler, so there is no `ctx.slack` handle — the token is minted through
 * Vercel Connect (VERCEL_OIDC_TOKEN) and the workspace comes from SLACK_TEAM_ID
 * (docs: channels/slack.mdx). The defaults keep the hackathon workspace working
 * with no env file; another workspace sets the env vars. `callSlackApi` here is
 * the same request path as the live-proven `ctx.slack.request("users.info")`.
 */

import { connectSlackCredentials } from "@vercel/connect/eve";
import { callSlackApi } from "eve/channels/slack";
import { CHANNEL_ID_RE, normalizeChannelName, pickChannel, type SlackChannelSummary } from "./slack-channels.ts";

export const DEFAULT_TEAM_ID = "T0C28HCG1R6";
export const DEFAULT_CONNECTOR = "slack/it-takes-a-village";

/** Bot token (via Vercel Connect) + the workspace whose installation mints it. */
export function slackAuth() {
  const connector = process.env.SLACK_CONNECTOR ?? DEFAULT_CONNECTOR;
  const credentials = connectSlackCredentials(connector);
  const teamId = process.env.SLACK_TEAM_ID ?? DEFAULT_TEAM_ID;
  return { botToken: credentials.botToken, teamId };
}

/** All non-archived public channels the app can see (paginated). */
export async function listPublicChannels(): Promise<SlackChannelSummary[]> {
  const { botToken, teamId } = slackAuth();
  const out: SlackChannelSummary[] = [];
  let cursor: string | undefined;
  do {
    const res = await callSlackApi({
      botToken,
      context: { teamId },
      operation: "conversations.list",
      body: { types: "public_channel", exclude_archived: true, limit: 200, ...(cursor ? { cursor } : {}) },
    });
    if (!res.ok) throw new Error(`Slack conversations.list failed: ${res.error ?? "unknown_error"}`);
    const channels = (res.channels as { id?: unknown; name?: unknown }[] | undefined) ?? [];
    for (const c of channels) {
      if (typeof c.id === "string" && typeof c.name === "string") out.push({ id: c.id, name: c.name });
    }
    const meta = res.response_metadata as { next_cursor?: string } | undefined;
    cursor = meta?.next_cursor || undefined;
  } while (cursor);
  return out;
}

/** "#village-copywriter" or "C0…" -> { id, name }. Throws a human-relayable error when not found. */
export async function resolveChannelId(channel: string): Promise<SlackChannelSummary> {
  const trimmed = channel.trim();
  if (CHANNEL_ID_RE.test(trimmed)) return { id: trimmed, name: "" };
  const { match, suggestions } = pickChannel(await listPublicChannels(), trimmed);
  if (match) return match;
  const hint = suggestions.length ? ` — did you mean: ${suggestions.map((s) => `#${s}`).join(", ")}?` : "";
  throw new Error(
    `No public channel named '#${normalizeChannelName(trimmed)}'${hint} Ask the human to check the channel exists and is public.`,
  );
}
```

- [ ] **Step 5: Switch `agent/tools/post_as_villager.ts` to `slackAuth()`**

Replace the import of `connectSlackCredentials`, the two `DEFAULT_*` constants (and their comment block), and the first four lines of `execute` so the file reads:

```ts
import { callSlackApi } from "eve/channels/slack";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { slackAuth } from "../lib/slack-client";

/**
 * Post a Slack message under a villager's own name and icon.
 *
 * This is how a villager "speaks in its own voice": one Slack app posts with a
 * per-message `username` + `icon_emoji` (Slack's `chat:write.customize`), into a
 * channel it is not a member of (`chat:write.public`). Both were proven live in
 * the Sep 12 spike — see docs/eve-verification.md. The bot token is minted
 * through Vercel Connect (see agent/lib/slack-client.ts), not a pasted secret.
 */

export default defineTool({
  // ...description + inputSchema + label unchanged...
  async execute({ channel, villagerName, text, iconEmoji, threadTs }) {
    const { botToken, teamId } = slackAuth();

    const response = await callSlackApi({
      botToken,
      context: { teamId },
      operation: "chat.postMessage",
      // ...body and the rest unchanged...
```

(Keep `description`, `inputSchema`, `label`, the `body`, the error, and the return exactly as they are.)

- [ ] **Step 6: Run the tests and checks**

Run: `node --test agent/lib/slack-channels.test.ts && npx tsc --noEmit && npx eve build > /dev/null && npx eve info | grep -i tools`
Expected: PASS (5), tsc clean, build OK, `Tools 13 tools`.

- [ ] **Step 7: Commit**

```bash
git add agent/lib/slack-channels.ts agent/lib/slack-channels.test.ts agent/lib/slack-client.ts agent/tools/post_as_villager.ts
git commit -m "feat: resolve Slack channel name -> id from a tool; share Connect auth defaults"
```

---

### Task 5: `github-read.ts` — read a file from a branch

**Files:**
- Modify: `agent/lib/github-commit.ts` (export `GITHUB_API` and `ghHeaders`)
- Create: `agent/lib/github-read.ts`
- Test: `agent/lib/github-read.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export const GITHUB_API = "https://api.github.com"`, `export function ghHeaders(token: string): Record<string, string>` (from `github-commit.ts`); `export async function readFileFromBranch(opts: { repo: string; branch: string; path: string; token: string }): Promise<string | null>`.

- [ ] **Step 1: Write the failing test**

```ts
// agent/lib/github-read.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { readFileFromBranch } from "./github-read.ts";

test("readFileFromBranch rejects an empty token before any network call", async () => {
  await assert.rejects(
    readFileFromBranch({ repo: "x/y", branch: "main", path: "villages.json", token: "" }),
    /GitHub token is required/,
  );
});

test("readFileFromBranch rejects an empty path", async () => {
  await assert.rejects(
    readFileFromBranch({ repo: "x/y", branch: "main", path: "", token: "t" }),
    /path is required/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test agent/lib/github-read.test.ts`
Expected: FAIL — cannot find module `./github-read.ts`.

- [ ] **Step 3: Export the API base + headers from `agent/lib/github-commit.ts`**

Replace the top of the file (the `API` constant and the `gh` helper's header literal) with:

```ts
export const GITHUB_API = "https://api.github.com";

/** Standard headers for the GitHub REST API with a repo-scoped token. */
export function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function gh(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
```

Leave `commitFilesToBranch` unchanged.

- [ ] **Step 4: Write `agent/lib/github-read.ts`**

```ts
/**
 * Read one file from a branch via the GitHub contents API. The birth tool uses
 * it to load the CURRENT registry from main (never the possibly-stale copy
 * bundled into the running deployment) before adding a villager to it.
 */

import { GITHUB_API, ghHeaders } from "./github-commit.ts";

export async function readFileFromBranch(opts: {
  repo: string;
  branch: string;
  path: string;
  token: string;
}): Promise<string | null> {
  const { repo, branch, path, token } = opts;
  if (!token) throw new Error("readFileFromBranch: a GitHub token is required");
  if (!path) throw new Error("readFileFromBranch: a path is required");

  const url = `${GITHUB_API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET contents/${path}@${branch} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { encoding?: string; content?: string };
  if (json.encoding !== "base64" || typeof json.content !== "string") {
    throw new Error(`GitHub contents/${path}@${branch}: unexpected response shape`);
  }
  return Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test agent/lib/github-read.test.ts agent/lib/github-commit.test.ts && npx tsc --noEmit`
Expected: PASS (4), tsc clean.

- [ ] **Step 6: Live check of the read path (needs `.env.local`; no writes)**

Run:

```bash
set -a; source .env.local; set +a
node --input-type=module -e '
const { readFileFromBranch } = await import("./agent/lib/github-read.ts");
const s = await readFileFromBranch({ repo: process.env.GITHUB_REPO ?? "davehague/it-takes-a-village", branch: "main", path: "README.md", token: process.env.GITHUB_TOKEN });
console.log("README first line:", s?.split("\n")[0]);
console.log("missing ->", await readFileFromBranch({ repo: "davehague/it-takes-a-village", branch: "main", path: "does-not-exist.txt", token: process.env.GITHUB_TOKEN }));
'
```

Expected: prints the README's first heading, then `missing -> null`. (`villages.json` itself is not on `main` until Task 1's commit is pushed — that's fine here.)

- [ ] **Step 7: Commit**

```bash
git add agent/lib/github-commit.ts agent/lib/github-read.ts agent/lib/github-read.test.ts
git commit -m "feat: readFileFromBranch via GitHub contents API (birth reads the live registry)"
```

---

### Task 6: The `birth_villager` tool

**Files:**
- Create: `agent/tools/birth_villager.ts`

**Interfaces:**
- Consumes: `buildBirthFiles`, `REGISTRY_PATH`, `BirthInput` (`../lib/birth`); `commitFilesToBranch` (`../lib/github-commit`); `readFileFromBranch` (`../lib/github-read`); `resolveChannelId` (`../lib/slack-client`); `VillagerRecord` (`../lib/villages`).
- Produces: the tool `birth_villager` returning `{ commitSha, url, slug, dir, channelId, channelName, branch, fileCount, note }`.

- [ ] **Step 1: Write the tool**

```ts
// agent/tools/birth_villager.ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildBirthFiles, REGISTRY_PATH } from "../lib/birth";
import { commitFilesToBranch } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { resolveChannelId } from "../lib/slack-client";
import type { VillagerRecord } from "../lib/villages";

/**
 * Birth a prose-only villager: resolve its channel, read the CURRENT registry
 * from main, build the folder + registry files, and land them in one commit on
 * main (spec: docs/superpowers/specs/2026-09-13-birth-pipeline-design.md).
 * main auto-redeploys, so the villager answers in its channel after ~1–2 min.
 * Memory needs no setup — Blob memory is created on the first record_atom.
 */
export default defineTool({
  description:
    "Birth a new prose-only villager into a Slack channel a human has already created. Commits the villager folder (instructions.md + empty memory) and its registry entry to main in one commit, which redeploys the app; the villager answers in its channel after the redeploy (~1–2 min). Call only after the human has confirmed your reflected summary. You write the prose (intro, whatIDo, voice); the tool appends the standard learning contract.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Display name, e.g. 'Copywriter'."),
    icon: z.string().min(1).describe("Slack emoji face in colon form, e.g. ':pencil:'."),
    channel: z
      .string()
      .min(1)
      .describe("The pre-created Slack channel: '#village-copywriter' or a channel id like C0123ABCD."),
    intro: z
      .string()
      .min(1)
      .describe("One paragraph in the villager's voice: 'I am **Copywriter** ✏️, a villager. I ...'."),
    whatIDo: z
      .string()
      .min(1)
      .describe("Markdown body of the 'What I do' section — what happens when someone tags it, step by step."),
    voice: z.string().optional().describe("Optional short paragraph on tone, rendered as 'How I sound'."),
    slug: z
      .string()
      .optional()
      .describe("Optional folder slug (lowercase-dashed). Defaults to one derived from the name."),
  }),
  label: { start: ({ name, channel }) => `Birth ${name} into ${channel}` },
  async execute({ name, icon, channel, intro, whatIDo, voice, slug }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set — the midwife cannot commit a birth.");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MAIN_BRANCH ?? "main";

    const { id: channelId, name: channelName } = await resolveChannelId(channel);

    const raw = await readFileFromBranch({ repo, branch, path: REGISTRY_PATH, token });
    if (raw === null) {
      throw new Error(`Registry ${REGISTRY_PATH} not found on ${branch} — refusing to birth without it.`);
    }
    let registry: Record<string, VillagerRecord>;
    try {
      registry = JSON.parse(raw) as Record<string, VillagerRecord>;
    } catch (e) {
      throw new Error(`Registry ${REGISTRY_PATH} on ${branch} is not valid JSON: ${(e as Error).message}`);
    }

    const built = buildBirthFiles({ registry, channelId, input: { name, icon, intro, whatIDo, voice, slug } });

    const where = channelName ? `#${channelName}` : channelId;
    const result = await commitFilesToBranch({
      repo,
      branch,
      files: built.files,
      message: `birth: ${name} (${built.slug}) in ${where}\n\nBorn by the midwife from a Slack interview. Prose-only villager: instructions.md + empty memory + registry entry.`,
      token,
    });

    return {
      ...result,
      slug: built.slug,
      dir: built.dir,
      channelId,
      channelName,
      branch,
      fileCount: built.files.length,
      note: `Committed to ${branch}; the villager is live in ${where} after the production redeploy (~1–2 min).`,
    };
  },
});
```

- [ ] **Step 2: Verify discovery, types, and build**

Run: `npx tsc --noEmit && npx eve build > /dev/null && npx eve info | grep -i tools && node --test agent/lib/*.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: tsc clean, build OK, `Tools 14 tools`, `pass 41` / `fail 0` (10 memory + 4 memory-store + 4 record-atom + 2 github-commit + 4 villages + 10 birth + 5 slack-channels + 2 github-read).

- [ ] **Step 3: Commit**

```bash
git add agent/tools/birth_villager.ts
git commit -m "feat: birth_villager tool — folder + registry entry in one commit to main"
```

---

### Task 7: Midwife instructions, Enterprise Architect learning section, docs + env

**Files:**
- Modify: `agent/instructions.md`
- Modify: `agent/sandbox/workspace/village/villagers/enterprise-architect/instructions.md` (replace from `## How I learn` to end)
- Modify: `docs/status.md`, `CLAUDE.md`, `README.md`, `.env.example`, `docs/plan.md`

- [ ] **Step 1: Update the midwife's interview + constraints in `agent/instructions.md`**

In "How to interview", after item 4 add:

```markdown
5. **The channel.** Ask which Slack channel they created for the villager (`#name`). You can't create channels yet; you post into theirs without an invite.
```

Replace the "Create." paragraph under "Two phases" with:

```markdown
**Create.** A human describes a workflow to you in a thread. You interview them, reflect the summary back (name, emoji, channel, the job in a paragraph) and ask "shall I birth it?". On yes, you write the villager's prose and call the `birth_villager` tool — it renders the folder from the template, adds the channel→villager entry to the registry, and commits both to `main` in one commit (which redeploys the app). Then announce the new villager in its channel under its own name and face with `post_as_villager`, and tell the human it answers there after the redeploy (about 1–2 minutes). Then you step back — the villager is a teammate now, not a feature of yours.
```

Replace the "Committing to git is limited." bullet under "Current constraints" with:

```markdown
- **Births commit themselves.** `birth_villager` writes a new prose-only villager (its `instructions.md`, an empty memory folder, and its registry entry) to `main` in one commit; production redeploys automatically. Learned memory reaches git through `snapshot_memory` (the `village-memory` branch, [ADR 0003](../docs/adrs/0003-memory-substrate-blob-live-git-snapshot.md)). What you still cannot do is commit an *edit* to an existing villager's code: your `bash` runs in the sandbox, a copy of the workspace with no repository, so for a code change write the files with `write_file`, post the paths and contents for a human to commit, and never claim you committed it yourself (a maintain tool is a later build).
- **Births are prose-only for now.** A villager you birth has instructions and memory but no scripts or fixtures yet — script creation and validation at birth is the next build.
```

Also update the "Git is the source of truth." hard rule to: `- **Git is the source of truth for code.** The sandbox is stateless hands and is not durable — never treat sandbox files as permanent. Villager code reaches the repo through your tools (`birth_villager` for a birth); memory reaches it through `snapshot_memory`.`

- [ ] **Step 2: Regenerate the Enterprise Architect's learning section from the template**

Run (deterministic — the same renderer the tool uses):

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const { learningSection } = await import("./agent/lib/birth.ts");
const p = "agent/sandbox/workspace/village/villagers/enterprise-architect/instructions.md";
const s = readFileSync(p, "utf8");
const i = s.indexOf("## How I learn");
if (i < 0) throw new Error("no How I learn section");
writeFileSync(p, s.slice(0, i) + learningSection("enterprise-architect") + "\n");
console.log("rewrote", p);
'
```

Then run: `grep -c "midwife helps me consider" agent/sandbox/workspace/village/villagers/enterprise-architect/instructions.md`
Expected: `0` (the stale confirm-gate wording is gone) and the file ends with the template's "Rules I've been taught" pointer.

- [ ] **Step 3: Docs + env**

- `README.md` env table: add a row `GITHUB_MAIN_BRANCH` — "Branch a birth commits to (default `main`; a birth needs the redeploy)". Add `villages.json` to any file map that lists `agent/lib/villages.ts` ("registry data; `villages.ts` loads it").
- `.env.example`: under the `# --- Memory permanence (ADR 0003) ---` block add `GITHUB_MAIN_BRANCH=main` with a one-line comment "birth_villager commits here (auto-redeploys)".
- `docs/status.md`: item 4 → "**`birth` pipeline — BUILT (Sep 13), live verification pending/DONE** …" describing: `birth_villager` tool; registry data now `villages.json` (repo root — Eve rejects JSON under `agent/`); the tool reads the registry from `main` first; spec + plan paths; roadmap bullets (scripts at birth, ICM multi-stage, non-technical handholding, `channels:manage`, maintain tool). Add the new live-verification proof once Task 8 passes.
- `CLAUDE.md` Status paragraph: replace the trailing "Next: the `birth` pipeline (…)" with one sentence that births work via `birth_villager` (prose-only) and that the next build is script creation + validation at birth; mention `villages.json`.
- `docs/plan.md`: wherever it says the registry is `agent/lib/villages.ts`, say the data is `villages.json` (loaded by `villages.ts`).

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && node --test agent/lib/*.test.ts 2>&1 | grep -E "^ℹ fail" && git diff --stat`
Expected: tsc clean, `fail 0`, and the diff touches only the files listed above.

```bash
git add agent/instructions.md agent/sandbox/workspace/village/villagers/enterprise-architect/instructions.md docs/status.md CLAUDE.md README.md .env.example docs/plan.md
git commit -m "docs: midwife births via birth_villager; EA learning section from template; env + status"
```

---

### Task 8: Push, deploy, live-verify a throwaway birth, clean up

**Files:** none new (a throwaway villager folder + registry key will be added by the live birth and removed again).

- [ ] **Step 1: Push `main` (auto-deploys) and wait for Ready**

Run: `git push origin main && sleep 90 && vercel ls --prod 2>/dev/null | head -5`
Expected: newest production deployment shows `● Ready`.

- [ ] **Step 2: Live birth from Slack (David drives; the agent watches)**

1. David creates a public channel `#village-test-greeter` in Slack.
2. In `#villager-management`: `@villager I want a villager called Greeter that welcomes new people and answers "what is this village?" in one friendly paragraph. Emoji :wave:. Channel #village-test-greeter.` Answer the midwife's one or two questions; confirm the reflected summary.
3. Expected: the midwife calls `birth_villager`; a commit `birth: Greeter (greeter) in #village-test-greeter` appears on `main` (`git fetch && git log origin/main -1 --oneline`) containing `villages.json` + the three folder files; the midwife announces in `#village-test-greeter` as **Greeter** 👋 and says it will be live after the redeploy.
4. After the redeploy (`vercel ls --prod` shows a new `● Ready`), in `#village-test-greeter`: `@villager what is this village?` → one friendly paragraph. Then teach it: `@villager always end with "Welcome aboard!"` → it records an atom (`record_atom` for slug `greeter` succeeds); in a NEW thread, `@villager what is this village?` ends with "Welcome aboard!".

- [ ] **Step 3: Verify the negative paths (no commits made)**

In `#villager-management`, ask the midwife to birth into `#village-test-greeter` again → the tool errors "Channel … already has a villager ('Greeter' …)" and the midwife relays it; ask it to birth into `#does-not-exist-xyz` → "No public channel named …"; ask it to birth into `#villager-management` → "is a midwife channel".

- [ ] **Step 4: Clean up the throwaway villager**

```bash
git pull --ff-only origin main
git rm -r agent/sandbox/workspace/village/villagers/greeter
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const r = JSON.parse(readFileSync("villages.json", "utf8"));
for (const [k, v] of Object.entries(r)) if (v.slug === "greeter") delete r[k];
writeFileSync("villages.json", JSON.stringify(r, null, 2) + "\n");
'
node --test agent/lib/villages.test.ts
git add villages.json
git commit -m "chore: remove throwaway Greeter villager after live birth verification"
git push origin main
```

Then delete the `greeter` memory from Blob (so a re-run starts clean):

```bash
set -a; source .env.local; set +a
node --input-type=module -e '
import { list, del } from "@vercel/blob";
const token = process.env.BLOB_READ_WRITE_TOKEN;
const { blobs } = await list({ prefix: "village/villagers/greeter/memory/", token });
if (blobs.length) await del(blobs.map((b) => b.url), { token });
console.log("deleted", blobs.length, "blobs");
'
```

Ask David to archive `#village-test-greeter` (or keep it for the next test).

- [ ] **Step 5: Record the proof**

Update `docs/status.md` item 4 to "DONE + VERIFIED LIVE (Sep 13)" with the Greeter proof (birth commit → redeploy → answered → learned a rule across threads), and the project memory file's NEXT TASK to "script creation + validation at birth". Commit with the docs when David asks.
