# Progress log

Running status for It Takes a Village. Newest first. `plan.md` is the source of truth for the design; this is what is actually done, decided, blocked, and next.

## Sep 12 — First villager born + channel-routed listen/run loop deployed

Milestone: the interpreted-villager loop is live in production. The one app now plays two roles by channel — midwife in `#villager-management`, **Exa Researcher** 🔎 in `#village-exa-researcher` — and the routing, the first real villager, and the memory seam are all deployed.

### Done
- **Demo workflow decided: an Exa-powered Researcher villager.** Answers a research question posted in its channel by running a real web search (Exa) and posting a short, *sourced* brief that ends with a Confidence line; corrections tune its taste (source recency, domain allow/blocklist, required sections).
- **Midwife identity** written (`agent/instructions.md`) — the alloparent role, plus how to act when a turn is framed as a villager.
- **`post_as_villager` tool** — one app posts under a villager's name + icon (proven recipe: `connectSlackCredentials().botToken` + `callSlackApi`).
- **Exa Researcher villager folder** (`agent/sandbox/workspace/village/villagers/exa-researcher/`): `instructions.md`, `scripts/search.sh` (cached, key-free, live-tested at ~$0.007/search), `stages/01-research/CONTEXT.md`, and a fixture (query + captured golden response + structural expectations).
- **Sandbox** (`agent/sandbox/sandbox.ts`): seeds `/workspace/village/**` and brokers the Exa key at the Vercel firewall (`x-api-key` injected for api.exa.ai) so no secret enters the folder or sandbox; local runs fall back to an `EXA_API_KEY` env var.
- **Channel→villager registry** (`agent/lib/villages.ts`), in git as birth-time config.
- **Listen/run loop** (`agent/channels/slack.ts`): `onAppMention`/`onMessage` resolve the villager by channel and inject a villager framing via the mention result's `context`, so the turn acts AS the villager. Listen on every message, act only when addressed (mention / active thread / DM); thread context on.
- **Memory seam** (`agent/lib/memory-ingest.ts`): a stable no-op `ingestForMemory()` called on every message, with integration notes for the community brain.
- **Deployed** (git push → auto-redeploy, deployment Ready); `EXA_API_KEY` set in Vercel Production.

### Decisions
- **The app is renamed `@villager`** — its native mention is the universal trigger; the channel disambiguates which villager answers. No literal-keyword parser needed.
- **Listen always, act only when asked.** Passive ingest on every message; a reply only on an explicit mention or an active thread. Cooldown/ambient reply is parked.
- **Registry lives in git with the midwife**, not in Blob. Blob (Eve `fileMemory`) is reserved for the accumulating community brain.

### Blocked / to verify live
- **Double-post risk:** the model is instructed to reply only via `post_as_villager` and emit no final text; confirm Eve doesn't also post an empty app message.
- **`message.channels` trigger:** enable it on the Connect connector (Advanced → Trigger Event Types) so in-thread corrections without a re-mention reach `onMessage`. @mentions work without it.

### Next
- Live-test the loop in `#village-exa-researcher`.
- Merge Ren's community-brain memory (`rooms/`) into the village folder and wire it into `ingestForMemory()`.
- Build the `birth`/`commit` pipeline (interview → fill folder → append to `villages.ts` → commit).

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
