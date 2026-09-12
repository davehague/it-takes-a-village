# It Takes a Village — Hackathon Plan (Agents, Everywhere, Columbus, Sep 12 2026)

Product name: **It Takes a Village**. The channel is the village, the midwife delivers, the room parents. "Midwife" below refers to the host agent's role, not the product. This supersedes the Second Reader concept in `brainstorm.md` as the hackathon plan; event facts, schedule, judging criteria, prizes, and submission rules live there and aren't repeated here.

Team: David and Ren. Whiteboard photos from the venue (Sep 12) are in `docs/whiteboard/`.

Glossary: the **midwife** is the host agent that creates, updates, tests, and deploys villagers. The **villager** (called "Eve" on the whiteboard; renamed because Eve is the framework) is the daily running agent that works a workflow with the humans in its channel. The **village** is the channel. Both midwife and child are Eve-framework agents. Two phases: **Create** — humans ↔ midwife → folder → server/deploy, and iteratively later when the workflow changes; **Run** — humans with expertise (technical and domain: biology, chemistry, finance, whatever they bring) ↔ child over Slack/Teams ↔ memory (MOC).

Hard constraints: ~4h15m of build time (11:15–3:30), submission by 5:00 PM EDT, judged after the fact off a public GitHub repo plus a 2-minute video. Core functionality must be built live; templates, libraries, existing components, and seed data may be prepared beforehand.

## Decisions so far

Confirmed (Sep 12): this is the hackathon plan. Product name "It Takes a Village." Architecture C (interpreted while learning, compiled when graduated). Eve is the runtime. Vendor credits in hand: $50 OpenAI, $50 Exa (no others) — big model for interview/birth, mini model for compaction; one Exa-backed `search_literature` script for the science teammate.

Decided with Ren (Sep 12): the child agent is a **villager**. Slack only for the hackathon; Teams is pitch-only. Single stage today, using whatever Eve gives us natively; the full ICM stage structure is later. Memory today is one shared MOC per villager; the community brain / personal brain split with a promotion process stays the design intent but is a stretch goal, not in the ~3 hours. Ren is a developer, capable with Claude; work is split and tracked in Linear. Repo: `~/source/it-takes-a-village`.

Recommended, not yet explicitly confirmed: family Slack as the demo hero (the mom test), science as the cutaway and written narrative, PR firm dropped; voice dropped and the CopilotKit side-prize with it; Slack over Discord; midwife as the core with the full memory layer as stretch; channel per workflow, with the midwife creating the channel at birth and the shared pool keyed by channel ID; the child never modifies itself — the midwife is the alloparent and humans approve by reaction; "show me an example of the input" as a core interview question that seeds a fixture.

## The concept

A midwife agent lives in a team channel. Someone describes a workflow; the midwife interviews them one question at a time (the ICM builder pattern), then births a new teammate as a folder — instructions, stages, deterministic scripts, and a wiki — which joins the channel under its own name. From then on the teammate learns in public: every run writes a raw trace, corrections from anyone in the channel are compiled into durable knowledge atoms, and its instructions and scripts evolve. When it's stable, it graduates to its own deployment with one command.

This is two ideas merged. Multiplayer chat where the agent does real work in the company messaging platform is the Midjourney play: if everyone sees you getting results, they learn your prompting, add their context, and pair on it. Agents as folders plus deterministic tools (ICM — Interpretable Context Methodology) means the teammate is a readable, editable, portable artifact rather than a black box. The learn-in-public loop is what makes the merge more than "an agent builder in Slack": one person's failure becomes everyone's pattern, and the folder carries it.

The mechanism is Google Research's WikiSkill (arXiv:2608.27454, Aug 2026): immutable raw traces → a maintained wiki of patterns → executable skills, with the wiki append-only and only skills ever rolled back. Their transfer result (skills evolved on a 4B model improved a 9B model) is direct evidence for the thesis that the text is the asset and the model or harness is interchangeable.

## Why it scores

Innovation & Theme: the pattern is "born in the channel, learns in public." A 1:1 chatbox cannot reproduce multiplayer witnessing or a shared knowledge pool by definition, which is the top-score language in the rubric. Birth-by-interview inside the channel wasn't found in the market (see competition note below).

Usefulness: a non-developer creates a custom agent by answering questions. The mom test — a spouse sets up a family flow with zero coaching — makes the claim concrete on camera.

Technical Execution: Eve durable sessions and sandbox, a generated Eve shim over a harness-agnostic folder, deterministic scripts as the testable core, a WikiSkill-style knowledge layer, and a real integration (Calendar via Vercel Connect).

Core Functionality: the filmed loop is small — interview, birth, run, correct, rerun — even though the backend is deep.

## Architecture C: interpreted while learning, compiled when graduated

One Eve host agent (the midwife) with a sandbox. Each birthed teammate is a folder in the sandbox workspace and in a git repo. While young, the host interprets it: loads its `instructions.md` as context, runs its stages and scripts in the sandbox, posts to Slack under the teammate's own name (`chat.postMessage` with `username`/`icon_emoji`, scope `chat:write.customize`). Every birthed folder is a valid Eve agent directory from day one, so graduation is `eve deploy` from that folder — same artifact, two execution modes. This mirrors WikiSkill's evolve-then-freeze and the ICM name: the folder is the interpretable artifact.

Rejected: A (one runtime, many folders, no graduation) is the same thing minus the ~20-minute graduation beat. B (true birth via live `eve deploy` per teammate) is literal to the vision but puts deploy latency, per-agent Slack credentials, and beta surprises on the critical path of a one-take video.

The 90/10 rule: the birthed folder is ~90% harness-agnostic — SKILL.md-style markdown, stages, CLI scripts, the wiki, declarative bindings — and the midwife generates the ~10% Eve shim (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`). The moment folder content depends on `defineTool` signatures it stops being portable, and portability is the point: harnesses keep getting better, we bring the folder.

## Hands, parenting, and the OpenClaw line

One principle answers all three: separate execution from modification.

Hands: the sandbox is stateless hands, the folder is the body. Eve's sandbox runs on ephemeral microVMs; treat that as a feature. The folder in git is the state and each session re-seeds the sandbox from it. In a stage, the model's only job is choosing which script and which parameters; the script does the work byte-for-byte with an exit code. Judgment steps (summarize, classify, draft) are the only places the model produces output itself. Determinism beats non-determinism because scripts are testable, idempotent, and dry-runnable.

Fixtures: one golden input per stage under `stages/<n>/fixtures/`, seeded at birth by one extra interview question — "show me an example of the input." Every proposed change to instructions or scripts must pass the fixtures before it is committed. That is WikiSkill's validation gate translated to a company workflow with no benchmark, and it is the deterministic eval for text changes.

Side-effect gating: reads inside the sandbox are free. Writes to the world (post, calendar, email) run dry by default and require approval. Eve has human-in-the-loop approval on tools natively, so this is configuration, not code. Credentials never live in the folder (the repo is public); Eve connections and Vercel Connect keep them outside the prompt and the files.

Parenting: the child never modifies itself. WikiSkill tested this directly — an inference agent that executes, a maintainer that compiles traces into patterns, a proposer that drafts skill diffs behind a deterministic gate — and found that giving the executor wiki access during evolution degraded final skill quality. Execution and modification are different jobs. The child's tools: `run_stage`, `post`, and `propose` (a message, never a write); it can notice ("I keep failing on Tuesdays — suggest a rule") but cannot self-edit. The midwife — the alloparent — owns `birth`, `maintain` (traces → atoms), `propose` (diffs), `run_fixtures`, and `commit`; in Eve terms, maintainer and proposer are two declared subagents with narrow tools under `agent/subagents/`, a 1:1 map to the paper. The midwife's parenting skill improves across every child it raises, which is the compounding asset. Humans are the reward signal: a correction in the channel is a proposal until an allowed user reacts 👍, then it becomes an atom with their name on it.

The OpenClaw line: shared DNA — agents as markdown files, multi-channel, skills, memory as text. What OpenClaw learned the hard way (exposed gateways, inbound messages as injection vectors, self-editing soul and memory) is exactly the failure mode a multiplayer, learning agent is most exposed to: the channel is an untrusted input surface, and with a learning loop an injection can persist as an atom and steer every future run — memory poisoning by pull request. Defenses are the separations above: sandboxed hands not host access, no self-modification, approval-gated atoms with attribution and an allowlist, least-privilege tools per child. On scope: OpenClaw became a whole platform; Eve already is that platform (channels, sandbox, durability, skills). This project builds the parenting protocol and the folder format, not the nursery.

## Eve facts verified (Sep 11)

Agent = `agent/` directory: `instructions.md` (always-on prompt), `agent.ts` (`defineAgent`, model), `tools/*.ts` (one typed tool per file, filename = tool name), `skills/*` (on-demand procedures, installable via the skills CLI), `subagents/*` (declared child agents with their own config; also a built-in `agent` tool that delegates to a copy of the current agent), `channels/*` (Slack and Discord named in docs), `connections/*`, `sandbox/*` (seed files under `agent/sandbox/workspace/**`), optional `instrumentation.ts`.

Sandbox: every agent has one bash-style sandbox with its own filesystem and framework tools `bash`, `read_file`, `write_file`; on Vercel it runs on ephemeral microVMs. Sessions are durable on Vercel Workflows and survive cold starts and redeploys. Deploy via `eve build` / `eve deploy --non-interactive --yes` or git push; multiple root agents per project via the workspace layout at `/<name>/eve/v1/*`. Agents compile at build time; nothing in the docs creates an agent at runtime. Eve is in beta.

There is a Slack agent starter template ("Build your first Slack agent with eve") and a Slack content-agent template. Docs: https://vercel.com/docs/eve, https://vercel.com/docs/eve/concepts, https://eve.dev/docs.

Unverified and load-bearing: whether sandbox filesystem state persists across sessions on Vercel (design assumes not — folders live in git and are re-seeded); whether the host can load a workspace folder's `instructions.md` as context at runtime (expected yes via `read_file`, unconfirmed); whether Eve compacts session context or sessions simply grow (determines whether to start fresh sessions and re-inject from the pools); that Eve's tool approval gating works from the Slack starter; that the Slack app can create channels and invite users (`channels:manage`) and read reactions (`reactions:read`); Calendar via Vercel Connect setup time; Teams channel support (only matters for Battelle later).

## Birthed folder layout

```
rooms/<channel_id>/      # the room's living wiki — shared pool keyed by channel, not by child
  raw/                   # pointers to channel history plus run traces; append-only, never edited
  atoms/                 # one file per fact/rule/preference; frontmatter: source, author, themes, scope
  themes/                # GENERATED from atom frontmatter
  index.md               # GENERATED map of content

agents/<teammate>/       # the child — a valid Eve agent directory from day one
  instructions.md        # who it is, what it does — written from the interview in the user's words
  stages/
    01-<step>/CONTEXT.md # what it reads, does, produces; output/ lands here
    01-<step>/fixtures/  # golden input from the interview; gate for every change
    02-<step>/CONTEXT.md
  scripts/               # deterministic, CLI-invoked, exit codes; selected from the library, parameterized
  skills/                # COMPILED from the room's atoms at graduation, so the folder travels self-contained
  agent.ts, tools/, channels/, connections/   # the generated Eve shim

dm/<user_id>/            # private pool — same layout as a room; never committed to the public repo
org/                     # workspace-wide pool — same layout; not built for the hackathon, named in the description
```

ICM stages in Eve: Eve has no native stage primitive and doesn't need one. A stage is a folder in the sandbox workspace with its own `CONTEXT.md`, its own skills, and an `output/`; stage 2 reads stage 1's `output/`. The child's `run_stage` tool executes stages in numbered order. When a stage needs isolation or a narrower tool set, it becomes a declared subagent under `agent/subagents/`. Folder-stages today; subagent-stages when the workflow earns it. Eve's own `skills/` (on-demand procedures) and `tools/` (typed TypeScript) sit alongside and are the more extensible layer.

## Rooms: a channel per workflow

A channel is the child's room: the scope of its shared memory, its audience, and its approver list, in one Slack primitive. The room full of specialists self-assembles per workflow — the chemist joins #assay-qc, nobody joins #pickup-schedule but the two parents. Consequences: birth creates the room (the midwife's last act of birth is `conversations.create` plus inviting the birthing user — "I've made #pickup-schedule and moved in"); channel membership is the allowlist for approvals (cooperative breeding, literally); channel history is the raw trace, so `raw/` is a pointer, not a copy; and the shared pool is keyed by channel ID rather than by child, so a room can later house several children (a Battelle project channel with the assay-QC teammate and the lit-watch teammate sharing one wiki, because the humans' corrections are about the room's domain, not one bot). Channel sprawl is not a real problem at SMB scale; archive rooms on retirement, curate at the org level later.

## Memory model: pools as a lattice, one shape

Three pools with one layout: DM (private, per user), room (per channel), org (workspace-wide). The rule: read up, promote up explicitly, never read down. A DM turn reads its own DM pool plus the room and org pools; a room turn reads the room and org pools and never mounts a DM pool; an org-level view never reads a room's private specifics. Compaction writes atoms only to the pool of the turn's own scope. Promotion is the only path upward — "share this with the team" copies a DM atom into the room, and a room member can promote a room atom to org — always explicit and attributed. So the chemist teaches `<LOD` once in #assay-qc, promotes it, and every future child inherits it; that is the room of specialists paying off across rooms. For the hackathon only DM and room exist (DM as stretch); org is named, not built. Private experimentation, public sharing — Midjourney's DM-the-bot vs. public channels is the same split.

Folder thesis vs. room thesis, reconciled the WikiSkill way: the room's wiki is the living source; the child's folder gets the compiled knowledge. At graduation the atoms relevant to that child are compiled into its `skills/`, so the folder you bring with you is self-contained and the room keeps learning after it leaves. Wiki persists, skills compile.

Context for any turn, per the whiteboard: the last N messages (a couple dozen) for recent context, plus the **themes always loaded** (dozens — small enough to never crowd the window). Progressive disclosure below that: the agent can dig from a theme to its knowledge atoms (hundreds to thousands) and from an atom to the originating chat messages, via read tools, only when needed. No RAG, embeddings, or knowledge graph at this stage; markdown files and a distillation pipeline (chats with experts → atoms → themes) are the usable pattern. The midwife has its own MOC — its parenting knowledge — separate from any child's.

Compaction is the WikiSkill maintainer and the existing parenting-agent routine (knowledge atoms → themes → last-N window over a map-of-content vault). Deterministic: chunking, checkpoint bookkeeping, file writes, dedupe by ID, and generating `themes/` and `index.md` from atom frontmatter. LLM: atom extraction and dedupe-merge. Every atom records who taught it (Slack user → discipline), so the wiki doubles as a map of the team's expertise and institutional memory that survives departures.

Cautions: DM pools must not land in the public repo (shared pool lives in git as the public learning log; DM pools go to sandbox storage or Blob). If Eve sessions grow rather than compact, periodically start a fresh session and re-inject from the pools.

## Where the hard parts actually are

Whiteboard framing (why workflows are hard to define, and why this design answers it): context is incomplete — you forget steps when defining, so the definition needs to change over time, which is why folders-as-agents; visibility is incomplete — there are other humans in the workflow and you can't see what they do with it, which is why collaborators are in the channel; and re-runs are cheap — a 5-minute, $5 rerun of a folder versus software that is expensive to rework and has a bug surface — which is why iterate beats specify. Create and Run are the two loops that fall out of this.

1. Integration — credentials and side effects. The folder can say "pull open tickets from Jira" in one line; making it true means OAuth, scopes, data shape, and permission to write. Read-only workflows are safe; writing workflows need approvals, dry runs, and undo. Durability and audit aren't the hard part on their own — they're the precondition for being allowed to write, and the runtime (Eve Workflows, Agent Runs) should supply them so the folder never has to.
2. Convergence on exceptions. The happy path is easy to state; the branches ("unless the client is EMEA") only surface when it runs and fails. The multiplayer wiki loop is the mechanism that makes convergence cheap, which is why it isn't a gimmick.
3. Evaluation, not versioning. Git solves versioning of text. "Was version N+1 better" has no benchmark in a company; the eval signal is humans in the channel plus deterministic scripts with exit codes. Wiki append-only; instructions and skills versioned and rollback-able.
4. Slack is not an editor and shouldn't be. Slack steers (watch runs, add context, approve); git holds the folder; the midwife edits by proposing a patch, posting the diff, and committing on approval.

## Demo plan

Hero: family Slack, the mom test. She births the agent from home, uncoached, while David is at the venue — Slack is remote, and the remoteness proves the channel is the product. Workflow: weekly pickup/dropoff schedule posted Sunday night from Google Calendar. Exceptions are obvious and natural ("Tuesdays are soccer", "grandma doesn't do texts"). Privacy: the repo, video, and social post are public — fictional names and events in seed data, no school names, the kindergartener stays out entirely.

Cutaway and written narrative: a research-group teammate pre-birthed tonight (zero build time on the day) — "QC incoming assay CSVs and post anomalies" on a synthetic dataset, with one atom already in its wiki authored by two disciplines: chemist ("values below detection limit arrive as `<LOD`, not zero") and ML engineer ("don't drop them, mark them censored"). Both are a parser change with an exit code. The description says plainly: built to run inside Battelle, where the biologist, chemist, and ML engineer are in the same channel. Alternative, simpler science workflow: weekly literature watch via Exa/OpenAlex (less cross-discipline).

Dropped: PR firm (two folders is enough; cuts prep), voice (earned its place in the lab concept because hands were busy; here it's tacking on), Main Street SMB (not channel-native, integrations too heavy), CopilotKit side-prize.

Video storyboard (2:00): 0:00–0:40 birth by interview, ending with the midwife creating #pickup-schedule and moving in; 0:40–1:40 `@teammate run` → fail → spouse adds the exception in-thread → the agent proposes the atom → she reacts 👍 → atom committed with her name → rerun passes the fixture and succeeds ("the agent asked, she approved" is also the rubric's thoughtful-failure-handling line); 1:40–1:50 science cutaway showing the two-author atom; 1:50–2:00 `eve deploy` graduation with the Vercel Agent Runs dashboard as proof. Optional 10-second DM beat if built: "keep this between us" in DM is remembered in DM and never surfaces in the channel. Run trigger on camera is `@teammate run`; the Sunday-night schedule is mentioned in the description, not demoed.

## Scope: what's core, what's stretch, what's Plan B

Core (as re-scoped with Ren for ~3 hours): the midwife (threaded interview including the fixture question → template fill → folder committed → channel created → birth announced under its own name); the run loop, single stage (execute the villager's scripts in the sandbox, post the result); the minimal learning loop (one correction in a thread becomes one proposed atom, approved by a 👍 from the birthing user, that passes the fixture and changes the next run — ~40 lines plus the reaction handler). Tool split for the day: children get `run_stage` and `post`; the midwife gets `birth`, `maintain`, `propose`, `run_fixtures`, `commit`. Approval allowlist for the demo is the birthing user; channel-wide later. Memory-only would cap the Innovation score: without the birth it's "a Slack agent with good memory," and the folder thesis and mom test never show.

De-risking the birth: compose, don't generate. The interview (5–6 questions) fills a template folder — `instructions.md` and `stages/` from the answers in one LLM pass — and selects and parameterizes scripts from a small pre-written library (`fetch_calendar`, `check_csv_anomalies`, `format_post`). Selected scripts can't hallucinate. Novel script generation is v2.

Stretch, in order if ahead of schedule: the DM-pool beat (10s of video); `eve deploy` graduation (~20 min); the full memory architecture (the DM/room lattice with promotion, generated themes/index, sliding window, compile-to-skills at graduation). The science cutaway costs zero build time because it's seed data.

Plan B, triggered if the midwife isn't working by 1:45: hand-write the family folder and demo the learning loop. Still a submission, still the folder thesis, just without the birth.

## Build-day timeline (11:15–3:30)

0:00–0:30 — Eve Slack starter running in socket mode, hello-world in the family Slack (template). 0:30–1:30 — midwife: threaded interview → template fill → folder committed → birth announced. 1:30–2:15 — run loop with Calendar via Vercel Connect, seeded `.ics` fallback ready. 2:15–3:00 — learning loop: correction → atom → parameter/instruction change → rerun; wife does the birth around 2:15 while this is built. 3:00–3:30 — record the video. Then stretch items in order. Submission window is 3:30–4:00; the video is the submission.

## Tonight's prep (allowed: templates, libraries, components, data — the midwife and loop get built live; be ready to say which parts pre-existed)

1. Eve Slack starter running locally; confirm sandbox persistence, runtime loading of a folder's `instructions.md`, whether sessions compact or grow, and that tool approval gating works from Slack.
2. Family Slack workspace (or confirm one exists) and a 60-second brief for the spouse: "you'll answer some questions, that's it." Confirm ~10 minutes of availability in the 2:15–3:00 window.
3. Script library: `fetch_calendar`, `check_csv_anomalies`, `format_post`, `search_literature` (Exa); seeded `.ics` fallback.
4. Pull the compaction routine out of the parenting agent as a standalone script that takes a pool path (Plan A's stretch, Plan B's core).
5. Science seed folder with a synthetic assay CSV and one two-author atom; it doubles as the midwife's ICM template.
6. Repo scaffold; Slack app scopes: `chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read`.
7. Declare the `maintainer` and `proposer` subagents under `agent/subagents/` with narrow tools, and write the science seed folder's fixture so the gate has something to run on day one.

## Competition note

Slack's "Add to Slack" one-click deploys agents from ~10 builder platforms; Dust is explicitly multiplayer AI with shared context; Slackbot now orchestrates Agentforce agents; Gas City (a sponsor) runs fleets of coding agents. Not found anywhere: birthing the agent from inside the channel by interview, as a readable folder the team can open and edit, with a public learning loop the channel watches. The differentiator is legibility plus shared learning, not "agent in Slack." Directionally right, not an exhaustive audit.

## After the hackathon: the Battelle path

Battelle won't run proprietary data through Vercel-hosted agents and is likely on Teams. Both are fine and are exactly what the portability thesis is for: the folder and the loop move inside their boundary; the channel and host are shims. The value to Battelle is the format and the learn-in-public loop, especially wiki attribution as institutional memory across disciplines. The Second Reader concept (mining old notebooks) and this one (compiling expertise live from the channel) share a thesis — institutional memory — with different ingestion paths; the tech fellow's "find common themes across all our data" is the wiki's `index.md`. Rooms are the pitch: each project channel is an interdisciplinary room where the biologist, chemist, and ML engineer parent the same apprentice, the org pool is the institution learning, and attribution on every atom means expertise survives departures. The lattice (read up, promote up, never read down) is also the answer to Battelle's compartmentalization — a room's specifics never leak upward without an explicit, attributed promotion.
