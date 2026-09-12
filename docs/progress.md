# Progress log

Running status for It Takes a Village. Newest first. `plan.md` is the source of truth for the design; this is what is actually done, decided, blocked, and next.

## Sep 12 — Slack persona mechanism proven; one-app decision

Milestone: the "villager = persona in one app" model is validated end to end. One Connect-managed Slack app can post under many villager identities (custom name + icon) into per-villager channels — the load-bearing assumption behind the whole architecture.

### Done
- Hello-world midwife deployed to Vercel, replies to @mentions via Vercel Connect. Model `openai/gpt-5.6-luna-fast`. Live: `https://it-takes-a-village-orpin.vercel.app`.
- Proved locally (Connect token minted via `VERCEL_OIDC_TOKEN`, no pasted secret) that `chat:write.customize` (villager name + icon) and `chat:write.public` (post into a channel the bot is not a member of) both work.
- Full Option-A birth beat proven: "Exa Researcher" 🔎 posted its own birth announcement into a human-created `#village-exa-researcher` (`C0C1GK8SGKT`).
- Recipe and proof written up in `eve-verification.md`; auto-create fallback path in `future.md`.

### Decisions
- **One Slack app for the hackathon**, not the Midwife/Village two-app split. The two-app boundary was mostly about `channels:manage`, which is unavailable everywhere on the managed connector; the remaining boundary (git-commit/edit tooling) is gated in code instead. Fewer moving parts for demo day.
- **Channels are pre-created by a human** for the demo; villagers post in via `chat:write.public`. Auto-create deferred.

### Blocked / not today
- `channels:manage` (midwife auto-creates the village channel) — not grantable on the Vercel Connect managed Slack app. Post-hackathon fix: self-managed app created from `docs/manifest.json` (see `future.md`).

### Next
- Build the real midwife birth flow as an Eve tool in the deployed agent: interview → fill villager folder → announce as the villager via the `ctx.slack.request` escape hatch (custom name + icon).
- Wire Exa search ($50 credits) into the villager's run step so "Exa Researcher" returns sourced findings.
- One clean filmed pass of the loop: birth → post → correct → rerun, all inside `#village-exa-researcher`.

## Sep 12 (earlier) — hello-world milestone

Midwife deployed and replying to @mentions in Slack via Vercel Connect. Eve v0.54.3 verified against its bundled docs; the load-bearing unknowns are resolved in `eve-verification.md`.
