# Birth pipeline — design

Status: approved (David, Sep 13 2026). Implementation plan: `docs/superpowers/plans/2026-09-13-birth-pipeline.md`.

## Goal

The midwife interviews a human in Slack and births a new **prose-only villager** without any human touching git: it writes the villager's `instructions.md`, and a `birth_villager` tool assembles the villager folder plus the registry update and lands them in one commit on `main` (which auto-redeploys production). After the redeploy the villager is routable in its channel, and its memory/learning loop works with no further wiring.

This is v1. It deliberately excludes script generation and multi-stage folders; those are on the roadmap below and this design must not block them.

## Decisions (and why)

- **Commit target is `main`, not `village-memory`.** A birth is a code change: the folder must be in git so the sandbox seeds from it, and the registry must be in git so the channel routes. Both need the redeploy. Memory snapshots (ADR 0003) stay on `village-memory` because they must *not* redeploy. Both reuse `commitFilesToBranch` (`agent/lib/github-commit.ts`); the branch is already a parameter.
- **The registry data moves to `villages.json` at the repo root.** The routing table was a hand-written TypeScript object literal. A tool appending to that means string surgery on source code — fragile, and on the highest-blast-radius file in the app. As JSON, a birth is "add one key." `villages.ts` keeps the `Villager` type, `MIDWIFE_CHANNELS`, and `villagerForChannel()`, and builds `VILLAGES` from the JSON; consumers do not change. The file sits at the repo root (not under `agent/`) because Eve's discovery rejects a `.json` inside `agent/lib/` ("Expected … to be a supported authored module within lib/") — verified with a throwaway spike on Sep 13, which also confirmed that a root-level JSON import passes `node --test`, `tsc` (with `resolveJsonModule`), and `eve build`, and is inlined into the server bundle (so nothing is read from disk at runtime on Vercel).
- **The tool reads the registry from git at birth time**, not from the in-memory `VILLAGES` of the running deployment. The deployed copy can be stale (a human edit pushed after the deploy, or a birth that hasn't redeployed yet). The tool first resolves the `main` head sha (`getBranchHead`), reads `villages.json` at exactly that sha, and passes the sha to `commitFilesToBranch` as `expectedHeadSha`; if the head has moved by the time the commit is built, the whole birth fails with "main moved while committing — retry" and nothing is written. The final ref update is also `force: false`, so a move inside the commit itself fails the same way. Either way a race retries instead of clobbering.
- **Channel name → ID is resolved automatically** via `conversations.list` (`channels:read` is granted), using the same `callSlackApi` + `connectSlackCredentials` path `post_as_villager` uses. A human still pre-creates the channel because `channels:manage` cannot be granted on the managed Connect app; fixing that is on the roadmap.
- **The model writes prose; the tool writes the contract.** The midwife writes only what makes the villager itself (intro, "What I do", voice). The tool deterministically appends the canonical "How I learn" section (the `record_atom` contract, human-only sourcing, attribute by name, supersede-don't-pile, never rewrite own code) parameterized by slug. Every villager gets a correct learning contract without the model re-deriving it.
- **One gate stays: the reflect-back before birth.** A birth commits to `main`, redeploys production, and creates a public folder — the definition of hard-to-undo and outward. The midwife reflects the summary back and asks "shall I birth it?" once. Everything after the yes is autonomous. (Memory remains gate-free per the Sep 12 pivot.)

## The flow in Slack

1. A human in `#villager-management` (or a DM) describes a workflow. The midwife interviews per its existing flow — the workflow, a synthetic example input, what "good" looks like, name/personality/emoji — plus one new question: **which channel the human created for the villager** (`#name`).
2. The midwife reflects back one summary: name, emoji, channel, and the job in a paragraph. It asks "shall I birth it?"
3. On yes, the midwife calls `birth_villager` with the identity and the prose sections it wrote.
4. The tool resolves the channel, validates, fetches the current registry from `main`, assembles the files, and makes one commit to `main`. It returns the commit URL, the channel ID, and the slug.
5. The midwife announces in the new channel via `post_as_villager` (the villager introduces itself under its own name and face) and tells the human the villager is live after the redeploy (about 1–2 minutes), then to `@villager` it there.

## Components

### `villages.json` (new, repo root) and `agent/lib/villages.ts` (modified)

The JSON is a map of Slack channel ID → villager record:

```json
{
  "C0C1GK8SGKT": {
    "slug": "exa-researcher",
    "name": "Exa Researcher",
    "icon": ":mag:",
    "dir": "village/villagers/exa-researcher",
    "framing": ["line one", "line two"]
  },
  "C0C1A8TE605": {
    "slug": "enterprise-architect",
    "name": "Enterprise Architect",
    "icon": ":triangular_ruler:",
    "dir": "village/villagers/enterprise-architect"
  }
}
```

`framing` is an optional array of lines in JSON (readable), joined with `\n` on load so the `Villager` interface (`framing?: string`) is unchanged. `MIDWIFE_CHANNELS` stays in TypeScript — it does not change at birth.

`villages.ts` exports, unchanged in shape: `Villager`, `MIDWIFE_CHANNELS`, `VILLAGES`, `villagerForChannel`. It additionally exports the JSON record type (`VillagerRecord`) and a `registryFromJson(json)` function so the birth code and the loader share one parser.

Bundling: the JSON is imported statically from `agent/lib/villages.ts` as `import registry from "../../villages.json" with { type: "json" }`, and `tsconfig.json` gains `"resolveJsonModule": true`. Verified Sep 13 (spike): Node 24 `node --test`, `tsc`, and `eve build` all accept it and the data is inlined into `.output/server/index.mjs`.

### `agent/lib/birth.ts` (new, pure)

No I/O. Exports:

- `deriveSlug(name: string): string` — lowercase, non-alphanumerics → `-`, collapsed, trimmed; throws if empty.
- `renderInstructions(input: BirthInput): string` — renders the villager's `instructions.md` from the template below.
- `buildBirthFiles(args: { registry: Record<string, VillagerRecord>; channelId: string; input: BirthInput }): { files: { path: string; content: string }[]; registry: Record<string, VillagerRecord>; slug: string; dir: string }` — validates, then returns the exact repo-relative file list, the updated registry object, the slug, and the sandbox-relative `dir` (`village/villagers/<slug>`).

`BirthInput`:

```ts
type BirthInput = {
  name: string;          // "Copywriter"
  icon: string;          // ":pencil:" (colon form)
  slug?: string;         // optional override; else deriveSlug(name)
  intro: string;         // one paragraph: "I am **Copywriter** ✏️, a villager. I ..."
  whatIDo: string;       // Markdown body of the "What I do" section
  voice?: string;        // optional short paragraph on tone; rendered as "How I sound"
};
```

Validation in `buildBirthFiles` (each throws a plain-English error):

- slug matches `^[a-z0-9]+(-[a-z0-9]+)*$`;
- slug is not already used by any registry entry;
- `channelId` is not already a registry key;
- `channelId` is not in `MIDWIFE_CHANNELS`;
- `name`, `icon`, `intro`, `whatIDo` are non-empty; `icon` is colon form (`^:[a-z0-9_+-]+:$`).

Files produced (repo-relative), with `<slug>` substituted:

- `agent/sandbox/workspace/village/villagers/<slug>/instructions.md` — the rendered template.
- `agent/sandbox/workspace/village/villagers/<slug>/memory/index.md` — the empty-brain placeholder (a heading and one line saying the brain starts empty and grows as the channel teaches).
- `agent/sandbox/workspace/village/villagers/<slug>/memory/atoms/.gitkeep` — empty.
- `villages.json` — the updated registry, `JSON.stringify(registry, null, 2) + "\n"`, key order preserved with the new entry appended.

The new registry entry: `{ slug, name, icon, dir: "village/villagers/<slug>" }` — no `framing` (a prose villager's behavior lives entirely in its `instructions.md`; the base framing in `slack.ts` already tells it to read that file and reply once).

### The `instructions.md` template

~~~markdown
# <name>

<intro>

## What I do

<whatIDo>

## How I sound            (only if voice was given)

<voice>

## How I learn

I manage my own memory. After I answer, I look back at what the **humans** in this thread said and decide for myself whether they taught me something durable — a standing rule about how to do my job, a settled fact worth keeping, or an open question worth tracking. If so, I record it as a knowledge atom, then and there, with the teacher's name on it. No one needs to approve it; if I get it wrong, someone will correct me and that correction becomes a new atom.

I record an atom with the `record_atom` tool — it persists the atom to my memory and updates my brain:

```
record_atom(villagerSlug: "<slug>", kind: "rule"|"finding"|"question", author: "<the human who said it>", text: "<the rule/fact/question, in one sentence>", citation?: "<url|doi>", supersedes?: "<atom-id>")
```

Rules for what I do and don't record:

- **Only from humans.** I never record my own words as knowledge. My replies are not facts to learn from — only what a person in the channel tells me is. (A finding must carry a `citation` to a real source, never "because I said so".)
- **Attribute by name.** I'm given a "Speaker names in this thread" list mapping Slack ids to readable names. I set `author` to the person's name, never the raw `U…` id.
- **Only durable, general things.** A correction, a standing preference, a settled fact, a real open question. Not one-off small talk, not a question I just answered, not a restatement of something already in my brain.
- **Don't repeat myself.** Before recording, I check my brain (given in my context). If the rule is already there, I don't add it again (the tool also refuses exact duplicates). "Nothing here is worth saving" is a perfectly normal outcome.
- **Supersede, don't pile up.** If a human *changes* an existing rule, I record the new rule with `supersedes: <the old atom's id>` (ids appear in my brain), so my brain never holds two rules that contradict each other.

I never rewrite my own instructions or scripts — only my memory. Changing what I *am* stays a deliberate act by a human and the midwife.

## Rules I've been taught

These live in my brain, not here — read my brain (provided in each turn's context) for the current list. It starts empty and grows as the channel teaches me; each rule records who taught it and when.
~~~

The "How I learn" and "Rules I've been taught" sections are byte-identical for every villager except `<slug>`. They are the generalization of the Exa Researcher's current sections (which describe the Exa-specific research rules; the template describes the job generically). The Enterprise Architect's existing `instructions.md` still describes the retired confirm gate in its "How I learn"; as part of this work its learning section is replaced with the template's, by hand, in the same commit series.

### `agent/lib/slack-channels.ts` (new)

Pure, unit-tested helpers with no Eve imports: `CHANNEL_ID_RE` (`^[CG][A-Z0-9]{8,}$`), `normalizeChannelName("#Name ")` → `"name"`, and `pickChannel(channels, wanted)` → `{ match, suggestions }` where `match` is the channel whose name equals the normalized request and `suggestions` (only when there is no match) are up to three names that contain the request or share its first four characters.

### `agent/lib/slack-client.ts` (new)

The network half. `slackAuth()` returns `{ botToken, teamId }` from `connectSlackCredentials(SLACK_CONNECTOR ?? "slack/it-takes-a-village")` and `SLACK_TEAM_ID ?? "T0C28HCG1R6"` — the two defaults that today live inside `post_as_villager.ts`, which switches to this helper. `listPublicChannels()` pages through `callSlackApi({ botToken, context: { teamId }, operation: "conversations.list", body: { types: "public_channel", exclude_archived: true, limit: 200, cursor? } })` following `response_metadata.next_cursor`. `resolveChannelId(channel)`: if it matches `CHANNEL_ID_RE` return `{ id, name: "" }`; else list, `pickChannel`, and either return the match or throw "No public channel named '#x' — did you mean: #a, #b?" so the midwife can ask the human to check. `callSlackApi` from `eve/channels/slack` is the same request path as the live-proven `ctx.slack.request("users.info")`, so the encoding is known to work for these GET-style methods.

### `agent/lib/github-read.ts` (new)

`readFileFromBranch({ repo, branch, path, token }): Promise<string | null>` — GitHub contents API (`GET /repos/{repo}/contents/{path}?ref={branch}`), base64-decoded; `null` on 404, throws on any other failure (including an empty token). Lives next to `github-commit.ts` and reuses its exported `GITHUB_API` constant and `ghHeaders(token)` helper. `branch` is passed as GitHub's `ref`, so a commit sha works too — the birth tool reads at the pinned head sha. `github-commit.ts` also exports `getBranchHead({ repo, branch, token })` → the head sha or `null`, and `commitFilesToBranch` accepts an optional `expectedHeadSha`.

### `agent/tools/birth_villager.ts` (new, thin glue)

Input schema (`zod`): `name`, `icon`, `channel` (`#name` or ID), `intro`, `whatIDo`, `voice?`, `slug?`. Description tells the model: "Birth a new prose-only villager into a Slack channel a human has already created. Commits the villager folder and registry entry to main, which redeploys the app; the villager answers in its channel after the redeploy (~1–2 min). Call only after the human has confirmed the reflected summary."

Execute:

1. `GITHUB_TOKEN` (throw if unset), `GITHUB_REPO` (default `davehague/it-takes-a-village`), `GITHUB_MAIN_BRANCH` (default `main`).
2. `const { id: channelId, name: channelName } = await resolveChannelId(channel)`.
3. `const headSha = await getBranchHead({ repo, branch, token })` (throw if the branch is missing), then `const raw = await readFileFromBranch({ repo, branch: headSha, path: "villages.json", token })`; `null` → throw "registry not found on main" (never write a registry we didn't read). Parse; on parse failure throw.
4. `const { files, slug } = buildBirthFiles({ registry, channelId, input })`.
5. `commitFilesToBranch({ repo, branch, files, message: \`birth: ${name} (${slug}) in #${channelName || channelId}\`, token, expectedHeadSha: headSha })`.
6. Return `{ commitSha, url, slug, channelId, channelName, dir, note: "Live after the production redeploy (~1–2 min)." }`.

No temp dir, no store access — birth writes git only; Blob memory is created lazily on the villager's first `record_atom`.

### `agent/instructions.md` (midwife, modified)

- "How to interview": add item 5 — ask which channel the human created (`#name`), and remind them the app posts there without an invite.
- "Create" phase: after the reflect-back and the human's yes, call `birth_villager` with the identity and the prose you wrote; then announce with `post_as_villager` in the new channel and tell the human about the redeploy delay.
- "Current constraints": replace the "Committing to git is limited … no general tool to commit a villager folder" paragraph with: births commit through `birth_villager` (folder + registry, one commit to `main`, auto-redeploy); learned memory snapshots through `snapshot_memory`; *edits* to an existing villager's code still have no tool — write the files and post them for a human (the maintain tool is a later build).
- Note that v1 births are prose-only: no scripts or fixtures yet (roadmap).

## Error handling

Every failure is a plain-English `Error` the midwife relays verbatim: channel not found (with closest names); channel already has a villager (name it); channel is a midwife channel; slug taken or invalid (show the derived slug); `GITHUB_TOKEN` unset; registry unreadable on `main`; commit ref race — the birth is pinned to the head sha it read the registry at (`expectedHeadSha`), and the final ref update is `force: false`; both surface as "main moved while committing — retry". The tool has no partial state to clean up (git is atomic per commit; no Blob writes).

## Testing

- `agent/lib/villages.test.ts` — the JSON loads; both existing channels route to the right slug; `framing` array joins to a string; a midwife channel and an unknown channel return `null`.
- `agent/lib/birth.test.ts` — `deriveSlug` cases (spaces, punctuation, unicode, empty → throws); `renderInstructions` contains the `record_atom` line with the right slug and omits "How I sound" when `voice` is absent; `buildBirthFiles` returns exactly the four repo paths, the registry JSON gains exactly one key with the expected record, and each validation rule rejects (duplicate slug, duplicate channel, midwife channel, bad icon).
- `agent/lib/github-commit.test.ts` — unchanged (guards).
- Live verification (not automated): birth a throwaway villager into a throwaway channel from Slack, watch the commit land on `main`, wait for the redeploy, `@villager` it in the channel, teach it a rule, see `record_atom` succeed for the new slug; then remove the folder + entry in a follow-up commit.
- `tsc --noEmit` clean; `eve info` lists 14 tools.

## Roadmap (must not be blocked by v1)

- **Script creation and validation at birth.** Villagers must be able to take actions: the interview selects and parameterizes library scripts or generates novel ones, runs them against the fixture in the sandbox, and only commits on green. This is the most important next step after v1.
- **ICM multi-stage decision.** The interview decides whether the workflow needs a multi-stage `stages/NN-*/` layout (the Exa Researcher's interpretable-context shape, generalized to N stages).
- **Handholding non-technical users.** The interview should abstract the technical complexity away — ask in the user's terms, propose defaults, explain what it's about to build in plain language.
- **`channels:manage`.** Fix the Slack permission so the midwife creates the village channel herself instead of asking the human to.
- **Maintain tool.** Commit edits to an existing villager's code (instructions/scripts) through the same git path, with the fixture as the gate.
- **Redeploy-aware birth.** Poll the Vercel deployment so the midwife announces "I'm awake" instead of "~1–2 minutes".
