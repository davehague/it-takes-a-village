# It Takes a Village — Design & Architecture

Product name: **It Takes a Village**. The channel is the village, the midwife delivers, the room parents. This is the design doc — the architecture and the reasoning behind it. The core: a **villager** agent that lives in a Slack channel with multiple humans, plus the **midwife** that births it and the **brains** (memory) it learns into. For current state and what's next, see `docs/status.md`; for the deferred/roadmap scope, `docs/future.md`.

Origin: built at the AI Tinkerers Columbus hackathon ("Agents, Everywhere", Sep 12–13 2026) and now a living open-source project. Team: David and Ren. Whiteboard photos are in `docs/whiteboard/`; the deploy-and-brains board is written up in `docs/architecture-deploy-and-brains.md`. Eve framework verification is in `docs/eve-verification.md`.

Glossary: the **midwife** is the host agent that creates, updates, tests, and commits villagers. The **villager** is the daily agent that works a workflow with the humans in its channel. The **village** is the channel. Both are Eve-framework agents. Two phases: **Create** — humans ↔ midwife → villager folder → committed and deployed; **Run** — the humans in the channel ↔ villager ↔ brains (memory).

## The design, in one paragraph

A villager lives in a Slack channel with a handful of humans. It was born there: someone described a workflow to the midwife in an interview, and the midwife filled a template folder — instructions, deterministic scripts, a fixture, a wiki — and committed it as a new teammate that joined the channel under its own name. From then on the villager works the workflow in the open, and the humans in the channel teach it: when someone corrects it, the villager decides for itself whether that is durable knowledge and, if so, saves it as an attributed knowledge atom that shapes the next run, with the teacher's name on it — humans correct after the fact rather than gate it up front (see the learning-loop pivot below). The villager is a readable folder anyone can open and edit, not a black box.

## Why it's different

The channel is the product. Multiple humans witness the villager work, correct it, and share what they learn — one person's fix becomes everyone's, recorded with their name on it. A 1:1 chatbox cannot reproduce multiplayer witnessing or a shared, growing knowledge pool. And because the villager is a folder of markdown plus scripts, the team reads and edits it directly: the knowledge is the asset and the runtime is interchangeable.

## Architecture: interpreted while learning, git as source of truth

One Eve host agent (the midwife) with a sandbox. Each birthed villager is a folder committed to the git repo and seeded into the midwife's sandbox workspace. While young, the midwife interprets it: loads its `instructions.md`, runs its scripts in the sandbox, and posts to Slack under the villager's own name. **Git is the source of truth for a villager's *code*** (`instructions.md`, scripts) — the sandbox is stateless hands and is not durable, so a code change has to reach the repo (verified: Eve does not sync sandbox writes to git for us — see `docs/eve-verification.md`). **Runtime memory is different (Sep 13, [ADR 0003](adrs/0003-memory-substrate-blob-live-git-snapshot.md)):** learned atoms live in **Vercel Blob** (the live store, cheap writes, no redeploy) and are snapshotted to a `village-memory` git branch as the public record — so git is the source of truth for the *published* memory record, Blob for *live* memory between snapshots. Every villager folder is a valid Eve agent directory, so graduation to its own deployment is `eve deploy` from that folder — same artifact, two execution modes. Graduation is a roadmap item (`docs/future.md`).

The 90/10 rule: the villager folder is ~90% harness-agnostic (markdown instructions, stages, CLI scripts, the wiki) and ~10% generated Eve shim (`agent.ts`, `tools/`, `channels/`). Portability is the point — harnesses keep improving; we bring the folder.

## Separate execution from modification (the safety model)

The villager never modifies itself. It executes — runs its scripts, posts results — and it can propose ("I keep failing on Tuesdays, here's a rule"), but the **midwife is the alloparent** that commits changes. Determinism beats non-determinism: scripts do the work with exit codes; the model's only job is choosing which script and which parameters. Judgment steps (summarize, classify, draft) are the only places the model writes output itself, because those are the only places the output is prose.

Fixtures: one golden input per workflow, captured at birth by the interview question "show me an example of the input." Every proposed change to instructions or scripts must pass the fixture before it is committed — the deterministic eval for text changes.

Side effects (posting, and later writing to a calendar or ticket) run dry by default and can be gated by Eve's native approval. A human's plain "yes" in the thread is enough to approve — no emoji ritual, no custom approval UI. Corrections are attributed: every committed rule records who taught it, so the wiki doubles as a map of the team's expertise and survives departures.

## The community brain

This version has **one memory pool: the community brain** — the channel's shared wiki, keyed by channel ID, all of it markdown on disk. What the humans in the channel teach the villager becomes attributed atoms. This is the "learns in public" pool: one person's correction, once confirmed, is knowledge the whole channel's villager carries. The format is specified in `docs/room-memory.md` and implemented in `agent/lib/memory.ts`.

**Villagers are research agents.** A villager researches a question for the room it lives in — "Exa Researcher" in `#village-exa-researcher` is the demo one — so its memory is shaped for research and grows as the investigation does. An atom is one of three kinds:

- a **finding**, a sourced claim carrying a citation (an uncited finding is hearsay, and `index.md` lists the ones still missing a source);
- a **question**, something the room wants chased down and cannot answer yet — the villager's standing agenda;
- a **rule**, how *these humans* want research done ("prefer primary sources", "last 24 months unless foundational"). A correction in the channel becomes a rule, and that is the mechanism by which the next run is better than the last.

Themes are a research vocabulary — `sources`, `findings`, `methods`, `open_questions`, `contradictions`, `terminology`, `scope`, `quality` — generated from the atoms beneath them, along with `index.md` (the research map) and `graph.json`. Atoms are append-only; the derived files are rewritten on every compile.

How a correction becomes knowledge (pivoted Sep 12 — **autonomous memory, no confirmation gate**): someone corrects or teaches the villager in a thread → the villager **decides for itself** whether that is durable knowledge and, if so, writes an attributed atom with the teacher's name on it, then and there. No human confirmation, no approval button. The bet is to trust the model to curate its own memory and let humans correct after the fact — and a correction is just another atom that supersedes the earlier one. The line we keep: a villager autonomously manages its **memory** (what it remembers — the atoms), but never rewrites its own **instructions or scripts** (what it is — its code); changing those stays a deliberate, human-and-midwife act. So "the villager never writes its own memory unilaterally" is retired for the memory layer; "the villager never rewrites its own code" stands.

How ingestion works — the collection/non-collection model (specified in **[ADR 0001](adrs/0001-knowledge-ingestion-model.md)**): a five-stage pipeline — context → capture → extract → store → recall — with a hard safety line between capture and extract. **Extraction runs at the end of each turn the villager takes**, over only the messages **new since a per-thread watermark**, so it is timely, cheap, and never double-collects. **Atoms are sourced only from human statements or cited web results — never from the villager's own prose** (agent messages are context, not knowledge, which stops the villager learning from its own unverified output). The villager **judges** atom-worthiness against explicit criteria — durable, general instructions/preferences/facts qualify; one-offs, chatter, and restatements do not — and **"nothing worth saving" is a valid outcome** (the guard against over-collecting). A new human statement that updates an existing rule records `supersedes: <id>` so rules don't pile up contradictorily. Scope is thread-based for now; whole-channel learning is deferred in **[ADR 0002](adrs/0002-memory-scope-thread-vs-channel.md)**.

Context for any turn: the last N messages, the always-loaded themes, and **every rule the room has taught** — rules apply to each run rather than only to a query that happens to match them — with progressive disclosure down to individual atoms, their citations, and the raw trace they came from. Raw traces append to a dated file per day and are never edited, so every claim stays traceable to the search that produced it.

Deferred to `docs/future.md`: the personal/DM brain, promotion between pools, and the org-wide pool. This version is community-brain only.

## Rooms: a channel per workflow

A channel is the villager's room — its shared-memory scope, its audience, and its approver allowlist, in one Slack primitive. Birth creates the room: the midwife's last act is creating the channel and moving in. Channel membership is the approver allowlist. Channel history is the raw trace, so the pool's `raw/` is a pointer, not a copy. The shared pool is keyed by channel ID, so a room can later house several villagers sharing one wiki.

## Runtime: Eve (verified)

Eve is the runtime; an agent is a directory (`instructions.md`, `agent.ts`, `tools/`, `skills/`, `subagents/`, `channels/`, `connections/`, `sandbox/`). Verified facts for Eve v0.54.3 and the corrections they force are in `docs/eve-verification.md`. Headlines: Node ≥24; Slack is HTTP Events API (**no socket mode**) — wired via **Vercel Connect** (a managed Slack app that forwards events to `/eve/v1/slack`), deployed with `vercel deploy --prod`; sessions compact automatically; runtime file reads work; tool approval renders as native Slack buttons, and a plain-text "yes" resolves it (so no emoji-reaction bridge to build); posting under a custom villager name and creating a channel are not native (raw `ctx.slack.request` escape hatch with added scopes).

## Repo layout

One Eve app (the midwife) is the repo. Villagers live inside the midwife's sandbox workspace, so Eve seeds them into the sandbox at runtime and git tracks them as the source of truth. They are named `villagers/` (not `agents/`) to avoid confusion with Eve's own `agent/`, which is the midwife. One channel = one villager, so a villager's community brain is not a separate tree — it lives inside its own folder as a `memory/` subdir. Our `docs/` sit alongside and Eve ignores them — no mixing problem.

```
it-takes-a-village/
  agent/                          # the MIDWIFE — the Eve root agent (the only thing Eve compiles)
    instructions.md, agent.ts
    tools/                        # birth, maintain, propose, run_fixtures, commit
    channels/slack.ts
    sandbox/
      sandbox.ts                  # sandbox config (required to seed the workspace)
      workspace/village/          # SEEDED into the sandbox AND git-tracked = source of truth
        villagers/<villager>/     # a villager — a valid Eve agent directory from day one
          instructions.md         # who it is, what it does — from the interview, in the user's words
          stages/01-<step>/CONTEXT.md    # what it reads, does, produces; output/ lands here
          stages/01-<step>/fixtures/     # golden input from the interview; gate for every change
          scripts/                # deterministic, CLI-invoked, exit codes; selected from the library
          agent.ts, tools/, channels/    # the generated Eve shim (used at graduation)
          memory/                 # the COMMUNITY BRAIN — this villager's living wiki (one channel = one villager)
            raw/                  # pointers to channel history + run traces; append-only, never edited
            atoms/                # one file per fact/rule/preference; frontmatter: source, author, themes
            themes/               # GENERATED from atom frontmatter
            index.md              # GENERATED map of content
  docs/                           # planning docs (Eve ignores these)
  package.json, tsconfig.json, AGENTS.md, CLAUDE.md
```

Git is the source of truth for villager *code*: a code change is written to `agent/sandbox/workspace/village/` and committed so the next session re-seeds with it (the birth/commit tool for folders is the next build). **Memory took a different path (Sep 13, [ADR 0003](adrs/0003-memory-substrate-blob-live-git-snapshot.md)):** it does not round-trip through the sandbox at all — the `record_atom` tool writes atoms straight to Vercel Blob (the sandbox firewall can't reach Blob or git anyway), the read side injects the brain into each turn, and `snapshot_memory` commits the `memory/` folder to the `village-memory` branch via the GitHub API as the public record.

A stage is a folder in the sandbox workspace with its own `CONTEXT.md` and `output/`; stage 2 reads stage 1's `output/`. The villager's `run_stage` tool executes stages in numbered order. Single stage today; multi-stage later.

Deferred to `docs/future.md`: `dm/<user_id>/` personal pools (kept gitignored), the `org/` workspace pool, and compiling a villager's `skills/` from the room's atoms at graduation.

## Where the hard parts are

1. Integration — credentials and side effects. The folder can say "pull open tickets" in one line; making it true means OAuth, scopes, data shape, and permission to write. Read-only is safe; writing needs approvals, dry runs, and undo. The runtime (Eve) supplies durability and audit so the folder doesn't have to.
2. Convergence on exceptions. The happy path is easy to state; the branches ("unless the client is EMEA") surface only when it runs and fails. The multiplayer learning loop is what makes convergence cheap.
3. Evaluation, not versioning. Git versions text; "was version N+1 better" has no benchmark in a team — the eval signal is humans in the channel plus deterministic scripts with exit codes. Wiki append-only; instructions and scripts versioned and rollback-able.
4. Slack steers, git holds. Slack is not an editor: it watches runs, adds context, and approves. The midwife edits by proposing a patch, posting the diff, and committing on approval.

## The reference villager: Exa Researcher

The first villager and the canonical walk-through of the whole loop: **interview → birth → run → correct → rerun.** Privacy: the repo, the demo channels, and the origin video are public — fictional names and synthetic data only.

**The workflow is an Exa-powered Researcher villager.** A human posts a research question in the channel; the villager runs a real web search (Exa) and posts a short, *sourced* brief ending with a Confidence line. Corrections tune its research taste — "exclude vendor blogs", "only sources from the last 12 months", "always name the primary source" — which map to deterministic search params and required brief sections, so a correction changes the next run and the fixture can assert it offline. No external OAuth (Exa is an API key), naturally multiplayer, and read-only by nature — no risky writes. Results cache to a fixture so a rerun is deterministic.

The 2-minute origin video walking this loop is planned in `docs/video-plan.md`.

## Design principles that hold

- **Compose, don't generate.** The birth interview fills a template folder in one LLM pass and selects and parameterizes scripts from a small pre-written library — selected scripts can't hallucinate. Novel script generation is a later step (`docs/future.md`).
- **Determinism beats non-determinism.** Scripts do the work with exit codes; the model only picks the script and parameters. Judgment steps (summarize, classify, draft) are the only places the model writes output itself.
- **Separate execution from modification.** A villager executes and can propose, but the midwife (alloparent) commits code changes. A villager autonomously manages its own **memory** (atoms) but never rewrites its own **code** (instructions/scripts).
- **Fixtures are the eval.** One golden input per workflow, captured at birth; every proposed change to instructions or scripts must pass the fixture before commit.

## Status and roadmap

The full birth → run → learn → maintain loop runs in production today (no human touching git for births or edits; durable cross-thread learning). Current state and open decisions live in `docs/status.md`; the forward roadmap and deferred scope (graduation via `eve deploy`, multi-stage villagers, novel script generation, the DM/personal and org brains, a read-only UI) live in `docs/future.md`.

## Positioning

Multiplayer AI inside the messaging platform exists (e.g. Dust); one-click "add to Slack" agent builders exist. What's distinctive here: birthing the agent from inside the channel by interview, as a readable folder the team can open and edit, with a public learning loop the channel watches. The differentiator is legibility plus shared learning, not "an agent in Slack." Directionally right, not an exhaustive audit.
