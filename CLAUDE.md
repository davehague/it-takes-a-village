# It Takes a Village

Hackathon build (AI Tinkerers Columbus, "Agents, Everywhere", Sep 12 2026). A **midwife** agent lives in Slack, interviews a human about a workflow, and births a **villager** agent as a folder (instructions + deterministic scripts + fixture + wiki) into its own channel (the **village**). The villager learns in public: corrections from anyone in the channel become attributed knowledge atoms once a human confirms, must pass the fixture, and evolve the folder. Runtime is Vercel's Eve framework (agents as directories, sandbox, Slack channel).

**Status (Sep 12):** hello-world milestone done — the midwife is deployed to Vercel and replies to `@mentions` in Slack (via Vercel Connect); model `openai/gpt-5.6-luna-fast`. Live: `https://it-takes-a-village-orpin.vercel.app`. Next: give the midwife its real identity + the interview flow.

**Read `docs/plan.md` first — it is the source of truth.** Whiteboard photos are in `docs/whiteboard/`; the deploy-and-brains board is written up in `docs/architecture-deploy-and-brains.md`. Eve framework verification is in `docs/eve-verification.md`.

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

- Villagers never modify themselves. The midwife (alloparent) owns birth, maintain, propose, run_fixtures, commit. Humans approve by reaction.
- Determinism beats non-determinism: scripts do the work with exit codes; the model picks the script and parameters. Judgment steps only where output is prose.
- The villager folder stays ~90% harness-agnostic (markdown + CLI scripts + wiki); Eve-specific files (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`) are a thin generated shim.
- Secrets never go in the folder or the repo. `.env` is gitignored. Private (DM) memory never lands in the public repo.
- Slack channel = memory scope + audience + approver allowlist. Shared pool keyed by channel ID.
- Markdown: no hard-wrapped prose; one paragraph per line.

## Environment

- Node is not on the default PATH: prepend `~/.nvm/versions/node/v24.3.0/bin` before `node`, `npx`, `pnpm`. Eve requires Node >=24 — the older v22.17.0 cannot run Eve 0.54.3.
- Credits: **$50 OpenAI Codex credits (1,250 Codex credits)** — these are Codex *usage* credits for the OpenAI Codex coding tool, NOT API credits and NOT a ChatGPT subscription. They can help us *build* (run Codex as a coding agent), but they CANNOT power the midwife's runtime brain, because Eve makes API-style model calls. Plus **$50 Exa** (search, not a model). We hold no LLM API credit, so the midwife's runtime model runs on **Vercel AI Gateway** (via `eve link`, uses its included allowance) or a real LLM API key — TBD, set Eve's spend guard either way.
- Slack app scopes needed: `chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read` (plus `im:history`, `im:write` for DMs). Eve's Slack channel is **HTTP Events API only — no socket mode**. We use **Vercel Connect** (`vercel connect create slack --connection-method slack-app --name it-takes-a-village --triggers`) — a managed Slack app (no manifest), authorized into a workspace, forwarding events to `/eve/v1/slack` on the Vercel deployment. The GitHub repo is connected to Vercel, so pushing to `main` auto-redeploys; manual deploy is `vercel deploy --prod` (the `eve deploy` wrapper is currently broken). See `docs/eve-verification.md`.
- Eve docs: https://vercel.com/docs/eve · https://vercel.com/docs/eve/concepts · https://eve.dev/docs · Slack starter: "Build your first Slack agent with eve" (vercel.com/kb). Eve is beta.

## Verification status

Most load-bearing unknowns are now verified against Eve v0.54.3 — see `docs/eve-verification.md`. Resolved: runtime `instructions.md` loading works (`read_file`); sessions compact automatically; tool approval gating is native as Slack buttons (but 👍-as-approval must be hand-built); `conversations.create` and posting under a custom villager name are NOT native (raw `ctx.slack.request` escape hatch). Design correction: git is the source of truth — the sandbox persists per session but is not durable, and Eve does not sync sandbox writes to git, so the midwife must commit villager folders explicitly. Still open: whether the Vercel plan supports Sandbox + Workflows for the graduation beat; how the midwife's runtime model is paid for — Vercel AI Gateway's included allowance vs. a real LLM API key (the $50 OpenAI credit is Codex-only and not usable for API model calls) — with Eve's spend guard set regardless.
