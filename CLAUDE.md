# It Takes a Village

Hackathon build (AI Tinkerers Columbus, "Agents, Everywhere", Sep 12 2026). A **midwife** agent lives in Slack, interviews a human about a workflow, and births a **villager** agent as a folder (instructions + deterministic scripts + fixture + wiki) into its own channel (the **village**). The villager learns in public: corrections from anyone in the channel become attributed knowledge atoms after a 👍, must pass the fixture, and evolve the folder. Runtime is Vercel's Eve framework (agents as directories, sandbox, Slack channel).

**Read `docs/plan.md` first — it is the source of truth.** Whiteboard photos are in `docs/whiteboard/`. `docs/brainstorm-second-reader.md` is a parked alternate concept, context only.

## Team and tracking

David Hague and Ren, both developers using Claude. Work is split and tracked in **Linear** (MCP is connected in this folder). Commits go to `main` on github.com/davehague/it-takes-a-village. Submission needs: public repo, 2-minute video, written description, social post tagging partners — deadline 5:00 PM EDT; submit in the portal 3:30–4:00.

## Scope for today (~3 hours)

Core: midwife interview → template-filled villager folder → channel created → birth announced under its own name; single-stage run loop (`run_stage`, `post`) executing library scripts in the Eve sandbox; minimal learning loop (correction → proposed atom → 👍 from birthing user → passes fixture → committed → rerun). Compose scripts from a library (`fetch_calendar`, `check_csv_anomalies`, `format_post`, `search_literature` via Exa); do not generate novel code today.

Stretch, in order: `eve deploy` graduation; DM/personal brain vs community brain with an explicit promotion process; full ICM multi-stage folders; org-level pool.

Plan B if the midwife isn't working by 1:45: hand-write the family villager folder and demo the learning loop.

Demo: family Slack, hero beat is David's wife birthing a weekly pickup/dropoff scheduler from home, uncoached (window 2:15–3:00). Science cutaway is pre-built seed data. Privacy: fictional names/events only; no school names; no kids in repo, video, or post.

## Hard rules

- Villagers never modify themselves. The midwife (alloparent) owns birth, maintain, propose, run_fixtures, commit. Humans approve by reaction.
- Determinism beats non-determinism: scripts do the work with exit codes; the model picks the script and parameters. Judgment steps only where output is prose.
- The villager folder stays ~90% harness-agnostic (markdown + CLI scripts + wiki); Eve-specific files (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`) are a thin generated shim.
- Secrets never go in the folder or the repo. `.env` is gitignored. Private (DM) memory never lands in the public repo.
- Slack channel = memory scope + audience + approver allowlist. Shared pool keyed by channel ID.
- Markdown: no hard-wrapped prose; one paragraph per line.

## Environment

- Node is not on the default PATH: prepend `~/.nvm/versions/node/v22.17.0/bin` before `node`, `npx`, `pnpm`.
- Credits: $50 OpenAI (big model for interview/birth, mini for compaction; hard spend limit set), $50 Exa. No other vendor credits.
- Slack app scopes needed: `chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read`. Run in socket mode locally.
- Eve docs: https://vercel.com/docs/eve · https://vercel.com/docs/eve/concepts · https://eve.dev/docs · Slack starter: "Build your first Slack agent with eve" (vercel.com/kb). Eve is beta.

## Unverified, load-bearing

Sandbox persistence across sessions (design assumes none — folder in git is state, sandbox re-seeds); loading a folder's `instructions.md` as context at runtime; whether Eve sessions compact or grow; tool approval gating from Slack; `conversations.create` from the app; Vercel plan supports Sandbox + Workflows for the graduation beat. Verify these first.
