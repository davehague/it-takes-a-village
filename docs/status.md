# Status & handoff (live)

Fast-moving hackathon handoff — the current state, what's next, and open decisions. Updated Sep 12. `docs/plan.md` is the source of truth for the design; this file is "where are we right now." Keep it short and current.

## Current state — hello-world milestone DONE ✅

- The **midwife** is deployed to Vercel production and **replies to `@mentions` in Slack** (round-trip confirmed).
- Model: **`openai/gpt-5.6-luna-fast`** (OpenAI Luna) via Vercel AI Gateway. David added **$10** of AI Gateway credits, so premium OpenAI/Anthropic models also work now.
- Slack is wired via **Vercel Connect** — a managed Slack app (no manifest), authorized into a workspace, forwarding events to `/eve/v1/slack`.
- The midwife's identity is still the scaffold default ("You are a helpful assistant") — not yet the real midwife.

## Operational reference

- Repo: `github.com/davehague/it-takes-a-village` (branch `main`).
- **Node 24 required**: prepend `~/.nvm/versions/node/v24.3.0/bin` (v22 can't run Eve).
- Live production: `https://it-takes-a-village-orpin.vercel.app` (Slack → `/eve/v1/slack`).
- Vercel project: `dhaggerfins-projects/it-takes-a-village` (id `prj_CJB7TtPPpIyUSj21WpaMGKD13Hsi`).
- Slack connector: `slack/it-takes-a-village` (`scl_g32hxyh1ZP4wQiV3OOLRiQ`) — `vercel connect list` to inspect.
- **Deploy: the GitHub repo is connected to the Vercel project, so pushing to `main` auto-redeploys production.** Manual deploy: `vercel deploy --prod --yes`. **`eve deploy` is broken** (force-appends an invalid `--non-interactive`), don't use it. Consequence to design around: because git is the source of truth *and* wired to auto-deploy, a midwife `commit` that writes/updates a villager folder will also trigger a production redeploy — fine, but keep commits deliberate.
- Env: `AI_GATEWAY_API_KEY` is the var the AI SDK reads (NOT `VERCEL_API_GATEWAY_KEY`); it's in `.env.local` (gitignored) and the Vercel project's Production env. `.env.example` documents it.
- Model funding: AI Gateway **free tier 403s premium models**; a *budget* is only a spend cap, not funds — you must add **credits**. Free ($0) models like `inclusionai/ling-3.0-flash-fin-free` work with no credits.

## Next (build)

1. Give the midwife its **real identity** (`agent/instructions.md`) — the midwife role from `docs/plan.md`.
2. **Interview → birth** flow (Track A): threaded interview incl. "show me an example of the input", template-fill a villager folder under `agent/sandbox/workspace/village/villagers/<name>/`, create the channel, announce under the villager's own name, **git-commit** the folder (sandbox is not durable; the midwife must commit).
3. **Run loop** (Track B): villager `run_stage` + `post`, single stage, execute a script, post result.
4. **Learning loop**: correction in thread → villager proposes a knowledge atom → human confirms ("yes", native button — **no 👍 bridge**) → passes fixture → committed with author's name → changes next run.

## Open decisions (waiting on David)

- **Demo workflow is UNDECIDED** — blocks the script library and the birth template. Recommendation on the table: incoming-request triage (multiplayer, corrections-are-rules, no external OAuth). Alt: weekly status roll-up.
- **`/project-status`** entry drafted (prototype→running) but not yet written — awaiting confirm.
- **`/shelloverflow`** post on the `eve deploy` bug — offered, not done.

## Not done / parked

- **Linear tickets were drafted in conversation but NOT created** (team "Ren Murakami", project "it-takes-a-village"), and are now partly stale: foundation (Slack/creds/deploy) is largely done; the 👍 reaction ticket (B4) was cut; workflow-specific tickets wait on the demo-workflow decision. Redraft against current state before creating.
- Deferred to `docs/future.md`: personal/DM brain, promotion, org pool, `eve deploy` graduation, multi-stage villagers, novel script generation, UI viz layer. **This version is community-brain only.**

## Decisions locked this session (already in the docs)

- Cut the mom-test/non-developer/from-home narrative; cut science/Battelle, OpenClaw, Second Reader, PR firm/voice/CopilotKit. Focus is purely the villager-in-a-channel + midwife + community brain.
- Git is the source of truth; villagers + community brains live under `agent/sandbox/workspace/village/` (`villagers/` + `rooms/`); `agent/` is the midwife (folder name is fixed by Eve, can't be renamed).
- Learning is a *proposal* the villager considers saving as an atom, confirmed by a human — not an automatic permanent rule.
