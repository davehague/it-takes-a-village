# It Takes a Village — Hackathon Plan (Agents, Everywhere, Columbus, Sep 12 2026)

Product name: **It Takes a Village**. The channel is the village, the midwife delivers, the room parents. This is the single design for the hackathon: a **villager** agent that lives in a Slack channel with multiple humans, plus the **midwife** that births it and the **brains** (memory) it learns into. Event facts, schedule, judging criteria, prizes, and submission rules live in the event materials and aren't repeated here.

Team: David and Ren. Whiteboard photos are in `docs/whiteboard/`; the deploy-and-brains board is written up in `docs/architecture-deploy-and-brains.md`. Eve framework verification is in `docs/eve-verification.md`.

Glossary: the **midwife** is the host agent that creates, updates, tests, and commits villagers. The **villager** is the daily agent that works a workflow with the humans in its channel. The **village** is the channel. Both are Eve-framework agents. Two phases: **Create** — humans ↔ midwife → villager folder → committed and deployed; **Run** — the humans in the channel ↔ villager ↔ brains (memory).

Hard constraints: build window 11:15–3:30, submission by 5:00 PM EDT, judged off a public GitHub repo plus a 2-minute video. Core functionality is built live; templates, the script library, and seed data may be prepared beforehand.

## The design, in one paragraph

A villager lives in a Slack channel with a handful of humans. It was born there: someone described a workflow to the midwife in an interview, and the midwife filled a template folder — instructions, deterministic scripts, a fixture, a wiki — and committed it as a new teammate that joined the channel under its own name. From then on the villager works the workflow in the open, and the humans in the channel teach it: when someone corrects it, the villager considers whether to save that as a knowledge atom, and once a human confirms and it passes the fixture, the atom sticks and shapes the next run, with the author's name on it. The villager is a readable folder anyone can open and edit, not a black box.

## Why it's different

The channel is the product. Multiple humans witness the villager work, correct it, and share what they learn — one person's fix becomes everyone's, recorded with their name on it. A 1:1 chatbox cannot reproduce multiplayer witnessing or a shared, growing knowledge pool. And because the villager is a folder of markdown plus scripts, the team reads and edits it directly: the knowledge is the asset and the runtime is interchangeable.

## Architecture: interpreted while learning, git as source of truth

One Eve host agent (the midwife) with a sandbox. Each birthed villager is a folder committed to the git repo and seeded into the midwife's sandbox workspace. While young, the midwife interprets it: loads its `instructions.md`, runs its scripts in the sandbox, and posts to Slack under the villager's own name. **Git is the source of truth** — the sandbox is stateless hands and is not durable, so the midwife commits every change back to the repo (verified: Eve does not sync sandbox writes to git for us — see `docs/eve-verification.md`). Every villager folder is a valid Eve agent directory, so graduation to its own deployment is `eve deploy` from that folder — same artifact, two execution modes. Graduation is a stretch beat.

The 90/10 rule: the villager folder is ~90% harness-agnostic (markdown instructions, stages, CLI scripts, the wiki) and ~10% generated Eve shim (`agent.ts`, `tools/`, `channels/`). Portability is the point — harnesses keep improving; we bring the folder.

## Separate execution from modification (the safety model)

The villager never modifies itself. It executes — runs its scripts, posts results — and it can propose ("I keep failing on Tuesdays, here's a rule"), but the **midwife is the alloparent** that commits changes. Determinism beats non-determinism: scripts do the work with exit codes; the model's only job is choosing which script and which parameters. Judgment steps (summarize, classify, draft) are the only places the model writes output itself, because those are the only places the output is prose.

Fixtures: one golden input per workflow, captured at birth by the interview question "show me an example of the input." Every proposed change to instructions or scripts must pass the fixture before it is committed — the deterministic eval for text changes.

Side effects (posting, and later writing to a calendar or ticket) run dry by default and can be gated by Eve's native approval. A human's plain "yes" in the thread is enough to approve — no emoji ritual, no custom approval UI. Corrections are attributed: every committed rule records who taught it, so the wiki doubles as a map of the team's expertise and survives departures.

## The community brain

This version has **one memory pool: the community brain** — the channel's shared wiki. What the humans in the channel teach the villager becomes attributed knowledge atoms, keyed by channel ID. This is the "learns in public" pool: one person's correction, once confirmed, is knowledge the whole channel's villager carries.

How a correction becomes knowledge: someone corrects the villager in a thread → the villager **proposes** saving a knowledge atom → a human confirms → the midwife commits the atom (with the author's name) after it passes the fixture. The villager proposes; it never writes its own memory unilaterally.

Context for any turn: the last N messages plus always-loaded themes, with progressive disclosure down to individual atoms and the originating messages when needed. Compaction — deterministic chunking/bookkeeping/file writes plus LLM atom extraction — rolls raw traces into atoms and themes.

Deferred to `docs/future.md`: the personal/DM brain, promotion between pools, and the org-wide pool. This version is community-brain only.

## Rooms: a channel per workflow

A channel is the villager's room — its shared-memory scope, its audience, and its approver allowlist, in one Slack primitive. Birth creates the room: the midwife's last act is creating the channel and moving in. Channel membership is the approver allowlist. Channel history is the raw trace, so the pool's `raw/` is a pointer, not a copy. The shared pool is keyed by channel ID, so a room can later house several villagers sharing one wiki.

## Runtime: Eve (verified)

Eve is the runtime; an agent is a directory (`instructions.md`, `agent.ts`, `tools/`, `skills/`, `subagents/`, `channels/`, `connections/`, `sandbox/`). Verified facts for Eve v0.54.3 and the corrections they force are in `docs/eve-verification.md`. Headlines: Node ≥24; Slack is HTTP Events API (**no socket mode**) — wired via **Vercel Connect** (a managed Slack app that forwards events to `/eve/v1/slack`), deployed with `vercel deploy --prod`; sessions compact automatically; runtime file reads work; tool approval renders as native Slack buttons, and a plain-text "yes" resolves it (so no emoji-reaction bridge to build); posting under a custom villager name and creating a channel are not native (raw `ctx.slack.request` escape hatch with added scopes).

## Repo layout

One Eve app (the midwife) is the repo. Villagers and the community brain live inside the midwife's sandbox workspace, so Eve seeds them into the sandbox at runtime and git tracks them as the source of truth. They are named `villagers/` and `rooms/` (not `agents/`) to avoid confusion with Eve's own `agent/`, which is the midwife. Our `docs/` sit alongside and Eve ignores them — no mixing problem.

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
        rooms/<channel_id>/       # the COMMUNITY BRAIN — the room's living wiki, keyed by channel
          raw/                    # pointers to channel history + run traces; append-only, never edited
          atoms/                  # one file per fact/rule/preference; frontmatter: source, author, themes
          themes/                 # GENERATED from atom frontmatter
          index.md                # GENERATED map of content
  docs/                           # planning docs (Eve ignores these)
  package.json, tsconfig.json, AGENTS.md, CLAUDE.md
```

Git is the source of truth: the midwife writes villager/room files in the sandbox and its `commit` tool writes them back to `agent/sandbox/workspace/village/` and git-commits, so the next session re-seeds with the change. (Build note: on Vercel the sandbox is isolated from the repo, so committing back needs the midwife to run git itself — straightforward for a local `eve dev` demo, a wrinkle to solve for graduation.)

A stage is a folder in the sandbox workspace with its own `CONTEXT.md` and `output/`; stage 2 reads stage 1's `output/`. The villager's `run_stage` tool executes stages in numbered order. Single stage today; multi-stage later.

Deferred to `docs/future.md`: `dm/<user_id>/` personal pools (kept gitignored), the `org/` workspace pool, and compiling a villager's `skills/` from the room's atoms at graduation.

## Where the hard parts are

1. Integration — credentials and side effects. The folder can say "pull open tickets" in one line; making it true means OAuth, scopes, data shape, and permission to write. Read-only is safe; writing needs approvals, dry runs, and undo. The runtime (Eve) supplies durability and audit so the folder doesn't have to.
2. Convergence on exceptions. The happy path is easy to state; the branches ("unless the client is EMEA") surface only when it runs and fails. The multiplayer learning loop is what makes convergence cheap.
3. Evaluation, not versioning. Git versions text; "was version N+1 better" has no benchmark in a team — the eval signal is humans in the channel plus deterministic scripts with exit codes. Wiki append-only; instructions and scripts versioned and rollback-able.
4. Slack steers, git holds. Slack is not an editor: it watches runs, adds context, and approves. The midwife edits by proposing a patch, posting the diff, and committing on approval.

## Demo plan

The filmed loop is small: **interview → birth → run → correct → rerun.** Privacy: the repo, video, and post are public — fictional names and synthetic data only.

**OPEN DECISION — the concrete demo workflow.** Pick one simple, channel-native workflow that a handful of humans plausibly share and that demos read-only or dry-run (so no risky live writes on camera). The choice drives which scripts go in the library. Name it before building the script library.

Storyboard (2:00): 0:00–0:40 birth by interview, ending with the midwife creating the channel and moving in under the villager's own name; 0:40–1:40 `@villager run` → a miss → a human corrects it in-thread → the villager proposes the rule → a human confirms with a "yes" → the rule is committed with their name on it → rerun passes the fixture and succeeds; 1:40–2:00 open the villager folder to show it's readable and editable, and — if built — the `eve deploy` graduation with the Vercel dashboard as proof.

## Scope: core / stretch / plan B

Core (~3h): the **midwife** (interview including the fixture question → template fill → folder committed → channel created → villager announces itself under its own name); the **run loop**, single stage (execute the villager's scripts in the sandbox, post the result); the **minimal learning loop** (a correction in a thread becomes one attributed rule that passes the fixture and changes the next run). Tools: the villager gets `run_stage` and `post`; the midwife gets `birth`, `maintain`, `propose`, `run_fixtures`, `commit`. Approver allowlist for the demo is the birthing user; channel-wide later.

De-risking the birth: **compose, don't generate.** The interview (5–6 questions) fills a template folder in one LLM pass and selects and parameterizes scripts from a small pre-written library. Selected scripts can't hallucinate. Novel script generation is v2.

Stretch, in order: `eve deploy` graduation (~20 min); the fuller memory internals (generated themes/index, sliding window, compile-to-skills at graduation). Larger deferred scope — the personal/DM brain, promotion between pools, the org pool — is parked in `docs/future.md`.

Plan B, triggered if the midwife isn't working by 1:45: hand-write one villager folder and demo the learning loop. Still a submission, still the folder thesis, just without the live birth.

## Build-day timeline (11:15–3:30)

0:00–0:30 — Eve Slack agent deployed to Vercel, hello-world `@mention` round-trip. **✅ DONE** (deployed via `vercel deploy --prod`; Slack via Vercel Connect; model `openai/gpt-5.6-luna-fast`). 0:30–1:30 — midwife: interview → template fill → folder committed → birth announced. 1:30–2:15 — run loop, single stage. 2:15–3:00 — learning loop: correction → attributed rule → rerun. 3:00–3:30 — record the video. Then stretch items in order. Submission window is 3:30–4:00; the video is the submission.

## Prep (allowed: templates, libraries, components, data — the midwife and loop are built live)

1. Eve Slack agent deployed to Vercel; hello-world `@mention` works.
2. Slack workspace and app with scopes (`chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read`, `im:history`, `im:write`).
3. Script library for the chosen demo workflow; deterministic, exit codes, with a fixture each.
4. Compaction routine as a standalone script that takes a pool path (Plan A's stretch, Plan B's core).
5. Repo scaffold plus the template villager folder with a fixture, so the gate has something to run on day one.

## Competition note

Multiplayer AI inside the messaging platform exists (e.g. Dust); one-click "add to Slack" agent builders exist. Not found anywhere: birthing the agent from inside the channel by interview, as a readable folder the team can open and edit, with a public learning loop the channel watches. The differentiator is legibility plus shared learning, not "an agent in Slack." Directionally right, not an exhaustive audit.
