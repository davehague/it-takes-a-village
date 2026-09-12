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

**Model note:** the repo uses `anthropic/claude-sonnet-5` via the Vercel AI Gateway. On this account, Anthropic models run with the Gateway key, while some OpenAI models (e.g. `openai/gpt-5.6-luna`) return `403 "Free tier users do not have access to this model"` until you add AI Gateway credits or use Bring Your Own Key. Change the model in `agent/agent.ts` or with `eve set --model <provider/model-id>`; free ($0) models such as `inclusionai/ling-3.0-flash-fin-free` also work.

## Run

```bash
eve dev                 # interactive dev TUI
eve dev --no-ui         # headless server; POST /eve/v1/session to talk to it
eve invoke "hello"      # one-shot invocation without a UI
```

## Deploy

```bash
eve deploy              # deploys to the linked Vercel project
```

`AI_GATEWAY_API_KEY` must also be set in the Vercel project's environment for the deployment to make model calls (`vercel env add AI_GATEWAY_API_KEY`).

## Layout

- `agent/` — the **midwife** (the Eve root agent Eve compiles).
- `agent/sandbox/workspace/village/` — birthed villagers (`villagers/`) and community brains (`rooms/`), git-tracked as the source of truth (see `docs/plan.md`).
- `docs/` — planning docs (Eve ignores these).
