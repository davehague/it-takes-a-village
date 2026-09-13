# It Takes a Village

Hackathon build (AI Tinkerers Columbus, "Agents, Everywhere", Sep 12 2026). A **midwife** agent lives in Slack, interviews a human about a workflow, and births a **villager** agent as a folder (instructions + deterministic scripts + fixture + wiki) into its own channel (the **village**). The villager learns in public: corrections from anyone in the channel become attributed knowledge atoms once a human confirms, must pass the fixture, and evolve the folder. Runtime is Vercel's Eve framework (agents as directories, sandbox, Slack channel).

**Status (Sep 12):** the interpreted-villager loop WORKS LIVE — `@villager <question>` in `#village-exa-researcher` returns one clean, Markdown-rendered, Exa-sourced brief. One app (renamed `@villager`) plays two roles by channel — midwife in `#villager-management`, the first villager **Exa Researcher** 🔎 in `#village-exa-researcher`. Model `anthropic/claude-sonnet-5`. Reply mechanism is Option A (the model replies as its normal message, which Eve renders as Markdown), so run replies show the app name "villager"; the birth announcement introduces the per-villager name/face via `post_as_villager`. Acts only on explicit mention (anti-loop). Live: `https://it-takes-a-village-orpin.vercel.app`. Next: merge Ren's `rooms/` memory, build the `birth`/`commit` pipeline.

**Read `docs/plan.md` first — it is the source of truth.** Whiteboard photos are in `docs/whiteboard/`; the deploy-and-brains board is written up in `docs/architecture-deploy-and-brains.md`. Eve framework verification is in `docs/eve-verification.md`. Decision records are in `docs/adrs/` (0001 = knowledge-ingestion model; 0002 = deferred thread-vs-channel scope).

Eve's authoring guidance for coding agents (how to build tools, channels, connections; read `node_modules/eve/docs` first) lives in `AGENTS.md`, imported here:

@AGENTS.md

## Team and tracking

David Hague and Ren, both developers using Claude. Work is split and tracked in **Linear** (MCP is connected in this folder). Commits go to `main` on github.com/davehague/it-takes-a-village. Submission needs: public repo, 2-minute video, written description, social post tagging partners — deadline 5:00 PM EDT; submit in the portal 3:30–4:00.

## Scope for today (~3 hours)

Core: midwife interview → template-filled villager folder → channel created → birth announced under its own name; single-stage run loop (`run_stage`, `post`) executing library scripts in the Eve sandbox; minimal learning loop (correction → proposed atom → confirmed by the birthing user → passes fixture → committed → rerun). Compose scripts from a small pre-written library selected and parameterized at birth (the exact scripts depend on the chosen demo workflow — see plan.md); do not generate novel code today.

Stretch, in order: `eve deploy` graduation; full ICM multi-stage folders. Deferred beyond stretch (parked in `docs/future.md`): DM/personal brain and the promotion process, org-level pool.

Plan B if the midwife isn't working by 1:45: hand-write one villager folder and demo the learning loop.

Demo: the filmed loop is interview → birth → run → correct → rerun, all inside one Slack channel with multiple humans (plus the midwife and the brains). The concrete demo workflow is an open decision — see plan.md "Demo plan". Privacy: repo, video, and post are public — fictional names and synthetic data only.

## Hard rules

- Villagers never rewrite their own **code** (instructions/scripts) — the midwife (alloparent) owns birth, maintain, run_fixtures, commit for those. But a villager **does autonomously manage its own memory layer** (its atoms): as of the Sep 12 pivot there is **no human confirmation gate** on learning — the villager decides what to remember and writes attributed atoms itself; humans correct after the fact (a correction is just a superseding atom). Trust the model to curate memory; keep code changes deliberate.
- Determinism beats non-determinism: scripts do the work with exit codes; the model picks the script and parameters. Judgment steps only where output is prose.
- The villager folder stays ~90% harness-agnostic (markdown + CLI scripts + wiki); Eve-specific files (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`) are a thin generated shim.
- Secrets never go in the folder or the repo. `.env` is gitignored. Private (DM) memory never lands in the public repo.
- Slack channel = memory scope + audience + approver allowlist. Shared pool keyed by channel ID.
- Markdown: no hard-wrapped prose; one paragraph per line.

## Environment

- Eve requires Node >=24 and the default `node` on PATH is a v22, which aborts ("requires Node.js >=24"). We each have a different v24 patch under nvm, so don't pin one: run `nvm use 24`, or in a non-interactive shell resolve it — `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"` — before `node`, `npx`, `pnpm`.
- Credits: **$50 OpenAI Codex credits (1,250 Codex credits)** — these are Codex *usage* credits for the OpenAI Codex coding tool, NOT API credits and NOT a ChatGPT subscription. They can help us *build* (run Codex as a coding agent), but they CANNOT power the midwife's runtime brain, because Eve makes API-style model calls. Plus **$50 Exa** (search, not a model). We hold no LLM API credit, so the midwife's runtime model runs on **Vercel AI Gateway** (via `eve link`, uses its included allowance) or a real LLM API key — TBD, set Eve's spend guard either way.
- Slack app scopes needed: `chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read` (plus `im:history`, `im:write` for DMs). Eve's Slack channel is **HTTP Events API only — no socket mode**. We use **Vercel Connect** (`vercel connect create slack --connection-method slack-app --name it-takes-a-village --triggers`) — a managed Slack app (no manifest), authorized into a workspace, forwarding events to `/eve/v1/slack` on the Vercel deployment. The GitHub repo is connected to Vercel, so pushing to `main` auto-redeploys; manual deploy is `vercel deploy --prod` (the `eve deploy` wrapper is currently broken). See `docs/eve-verification.md`.
- Eve docs: https://vercel.com/docs/eve · https://vercel.com/docs/eve/concepts · https://eve.dev/docs · Slack starter: "Build your first Slack agent with eve" (vercel.com/kb). Eve is beta.

## Verification status

Most load-bearing unknowns are now verified against Eve v0.54.3 — see `docs/eve-verification.md`. Resolved: runtime `instructions.md` loading works (`read_file`); sessions compact automatically; tool approval gating is native as Slack buttons (but 👍-as-approval must be hand-built); `conversations.create` and posting under a custom villager name are NOT native (raw `ctx.slack.request` escape hatch). Design correction: git is the source of truth — the sandbox persists per session but is not durable, and Eve does not sync sandbox writes to git, so the midwife must commit villager folders explicitly. Still open: whether the Vercel plan supports Sandbox + Workflows for the graduation beat; how the midwife's runtime model is paid for — Vercel AI Gateway's included allowance vs. a real LLM API key (the $50 OpenAI credit is Codex-only and not usable for API model calls) — with Eve's spend guard set regardless.
