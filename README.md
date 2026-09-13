# It Takes a Village

A midwife agent that interviews a human in Slack and births a **villager** agent — a readable folder of instructions, deterministic scripts, a fixture, and a wiki — into its own channel, where the team teaches it in public. Built on Vercel's [Eve](https://eve.dev) framework for the AI Tinkerers Columbus hackathon.

**Start with [`docs/plan.md`](docs/plan.md)** — it is the source of truth. Framework findings are in [`docs/eve-verification.md`](docs/eve-verification.md); deferred scope in [`docs/future.md`](docs/future.md).

## Prerequisites

- **Node.js >= 24** (Eve requires it). If you use nvm: `nvm use 24`.
- A Vercel account (for the AI Gateway credential that powers the agent's model calls).

## Setup

```bash
npm install
cp .env.example .env.local        # then fill in the values (see below)
eve link --project it-takes-a-village   # links to Vercel and writes VERCEL_OIDC_TOKEN to .env.local
```

### Environment (`.env.local`, gitignored)

| Variable | What it is | How to get it |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key — funds the agent's model calls ("the brain"). The exact name the AI SDK reads. | Vercel dashboard → AI Gateway → API Keys. |
| `VERCEL_OIDC_TOKEN` | Fallback AI Gateway credential, auto-written by `eve link`. Short-lived; re-run `eve link` to refresh. | Automatic. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token — the live memory store where villagers' learned atoms persist across threads/redeploys ([ADR 0003](docs/adrs/0003-memory-substrate-blob-live-git-snapshot.md)). | `vercel blob create-store village-memory --access public` (writes it to `.env.local` and connects it to all envs). |
| `GITHUB_TOKEN` | Repo-scoped token the `snapshot_memory` tool uses to commit a villager's memory folder to the `village-memory` branch via the GitHub Git Data API. App env only — never commit a real value. | Fine-grained PAT at github.com → Settings → Developer settings, scoped to this repo with **Contents: Read and write**. |
| `GITHUB_REPO`, `GITHUB_MEMORY_BRANCH` | Snapshot target (default `davehague/it-takes-a-village` and `village-memory`). Optional — the code defaults cover the hackathon repo. | Set only to override the defaults. |

**Model note:** the repo uses `openai/gpt-5.6-luna-fast` (OpenAI Luna) via the Vercel AI Gateway — a cheap, fast model. Premium models (OpenAI and Anthropic, e.g. `anthropic/claude-sonnet-5`) require **AI Gateway credits** — add them in the Vercel dashboard → AI Gateway → Budgets & Spend. A *budget* alone is only a spend cap, not funds; without credits, premium models return `403 "Free tier users do not have access to this model"`. Free ($0) models such as `inclusionai/ling-3.0-flash-fin-free` work without credits. Change the model in `agent/agent.ts` or with `eve set --model <provider/model-id>`.

## Run

```bash
eve dev                 # interactive dev TUI
eve dev --no-ui         # headless server; POST /eve/v1/session to talk to it
eve invoke "hello"      # one-shot invocation without a UI
```

## Slack (Vercel Connect)

Slack is wired through **Vercel Connect** (`agent/channels/slack.ts` uses `connectSlackCredentials("slack/it-takes-a-village")`) — a **managed** Slack app, so there is no manifest to build. Provision the connector once:

```bash
vercel connect create slack --connection-method slack-app --name it-takes-a-village --triggers
```

A browser opens: **choose the Slack workspace** and authorize. This registers a managed Slack app, installs it, and points its event trigger at `/eve/v1/slack` on the production deployment. Then deploy (below). To use the bot, invite it to a channel (`/invite @it-takes-a-village`) or open a DM, and `@mention` it.

## Deploy

The GitHub repo is connected to the Vercel project, so **pushing to `main` auto-redeploys production**. For a manual deploy:

```bash
vercel deploy --prod --yes   # deploy the midwife to production
```

Note: `eve deploy` currently force-appends an invalid `--non-interactive` flag to its bundled Vercel CLI (v50.9.6) and fails — use a push or `vercel deploy --prod` instead. `AI_GATEWAY_API_KEY` must be set in the Vercel project's **Production** environment for the deployment to make model calls (`vercel env add AI_GATEWAY_API_KEY production`).

Live production: `https://it-takes-a-village-orpin.vercel.app` — Slack events arrive at `/eve/v1/slack`.

## Layout

- `agent/` — the **midwife** (the Eve root agent Eve compiles). The one Slack app (`@villager`) plays a different role per channel; a mention in a village channel acts as that channel's villager.
- `agent/channels/slack.ts` — the listen/run loop: resolves the villager by channel and frames the turn; listens on every message, acts only when addressed.
- `agent/lib/villages.ts` — the channel→villager registry (birth-time config, in git). `agent/lib/memory-ingest.ts` — the memory-ingestion seam (no-op; integration notes inside).
- `agent/sandbox/sandbox.ts` — seeds the village into `/workspace` and brokers the Exa key at the firewall.
- `agent/sandbox/workspace/village/` — birthed villagers (`villagers/`, e.g. `exa-researcher/`) and community brains (`rooms/`), git-tracked as the source of truth (see `docs/plan.md`).
- `docs/` — planning docs (Eve ignores these). Start with `docs/status.md` for current state.
