# It Takes a Village

An open-source pattern — with a working reference implementation — for **agents that are born, run, and taught in public**. A **midwife** agent in Slack interviews a human about a workflow and births a **villager** agent as a readable folder (instructions + deterministic scripts + fixture + wiki) into its own channel (the **village**), where the whole team teaches it: corrections become attributed knowledge atoms the villager curates itself. **The thesis:** the knowledge is the asset and the runtime is interchangeable — a villager is a folder you can open, read, edit, and carry to any harness, not a black box. Runtime is Vercel's Eve framework. Origin: the AI Tinkerers Columbus hackathon ("Agents, Everywhere", Sep 12–13 2026); now a living project, running in production.

**This file is a signpost.** It holds the global directives every session must follow and points to the docs that hold the detail. Read the doc that matches your task — not everything.

## Where things live

- **`docs/plan.md`** — design doc: the architecture and the reasoning behind it. Start here for how the system is shaped.
- **`docs/status.md`** — current state, what's live, and open decisions. Start here for "where are we now" (tool inventory, model, live URL, Vercel/Slack refs).
- **`docs/future.md`** — roadmap and deferred scope.
- **`docs/eve-verification.md`** — verified Eve-framework facts and the design corrections they force (sandbox durability, approvals, `conversations.create`, the anti-loop post-mortem).
- **`docs/adrs/`** — decision records: 0001 knowledge-ingestion model; 0002 deferred thread-vs-channel scope; 0003 memory substrate (Blob live + git snapshot).
- **`docs/architecture-deploy-and-brains.md`** + **`docs/whiteboard/`** — the deploy-and-brains board and source photos.
- **`README.md`** — setup, env vars, run/deploy commands, and Slack (Vercel Connect) provisioning.
- **`AGENTS.md`** (imported below) — **Eve's** authoring guidance for coding agents: how to build tools, channels, connections. Read `node_modules/eve/docs` first when authoring Eve code. Eve owns and may regenerate this file, so project directives live here in CLAUDE.md, never in AGENTS.md.

## Hard rules (global directives)

- Villagers never rewrite their own **code** (instructions/scripts) — the midwife (alloparent) owns birth, maintain, run_fixtures, commit. But a villager **autonomously manages its own memory** (its atoms): no confirmation gate since the Sep 12 pivot — it decides what to remember and writes attributed atoms itself; humans correct after the fact (a correction is a superseding atom). Trust the model to curate memory; keep code changes deliberate.
- Determinism beats non-determinism: scripts do the work with exit codes; the model picks the script and parameters. Judgment steps only where the output is prose.
- The villager folder stays ~90% harness-agnostic (markdown + CLI scripts + wiki); Eve-specific files (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`) are a thin generated shim.
- Secrets never go in the folder or the repo. `.env` is gitignored. Private (DM) memory never lands in the public repo. The repo, demo channels, and origin video are public — fictional names and synthetic data only.
- Slack channel = memory scope + audience + approver allowlist. Shared pool keyed by channel ID.
- Markdown: no hard-wrapped prose; one paragraph per line.

## Environment (must-know gotchas)

- **Node >=24 required.** The default `node` is a v22 and aborts. Run `nvm use 24`, or non-interactively `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"` before `node`/`npx`/`pnpm`. (Our machines have different v24 patches — don't pin one.)
- **Deploy = push to `main`** (GitHub → Vercel auto-redeploys). Manual: `vercel deploy --prod`. `eve deploy` is broken (force-appends an invalid flag) — don't use it. Git is source-of-truth *and* wired to deploy, so a midwife commit also redeploys — keep commits deliberate.
- **The brain runs on Vercel AI Gateway;** premium models need AI Gateway *credits*, not just a budget (else `403 "Free tier users do not have access to this model"`). Full env/setup is in `README.md`; the Slack app's scopes and events are declared in `slack/manifest.json`; Eve facts in `docs/eve-verification.md`.

## Team

David Hague and Ren, both developers using Claude. Work is split and tracked in **Linear** (MCP connected in this folder). Commits go to `main` on github.com/davehague/it-takes-a-village (public).

Eve's authoring guidance for coding agents lives in `AGENTS.md`, imported here:

@AGENTS.md
