# Status & handoff (live)

Fast-moving hackathon handoff — the current state, what's next, and open decisions. Updated Sep 12. `docs/plan.md` is the source of truth for the design; this file is "where are we right now." Keep it short and current.

## Current state — interpreted-villager loop DEPLOYED ✅

- **One app (`@villager`), two roles by channel:** midwife in `#villager-management` (`C0C0YRB5M47`); the first villager **Exa Researcher** 🔎 in `#village-exa-researcher` (`C0C1GK8SGKT`).
- **Built + deployed this session:** midwife identity (`agent/instructions.md`); `post_as_villager` tool; the Exa Researcher villager folder (`scripts/search.sh` cached + live-tested, fixture); the sandbox (seeds `village/**`, brokers the Exa key at the firewall); the channel→villager registry (`agent/lib/villages.ts`); the channel-routed **listen/run loop** (`agent/channels/slack.ts` — listen on every message, act only when addressed, framing injected via the mention `context`); the memory seam (`agent/lib/memory-ingest.ts`, no-op).
- Model **`openai/gpt-5.6-luna-fast`** via Vercel AI Gateway. Slack via **Vercel Connect** (managed app, no manifest).
- **Not yet verified live:** the full loop round-trip (`@villager <question>` → 🔎 sourced brief). Watch for a double-post (model told to reply only via `post_as_villager`).

## Operational reference

- Repo: `github.com/davehague/it-takes-a-village` (branch `main`).
- **Node 24 required** (default `node` is a v22 and can't run Eve): `nvm use 24`, or `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"`. Our machines have different v24 patch versions — don't pin one in the docs.
- Live production: `https://it-takes-a-village-orpin.vercel.app` (Slack → `/eve/v1/slack`).
- Vercel project: `dhaggerfins-projects/it-takes-a-village` (id `prj_CJB7TtPPpIyUSj21WpaMGKD13Hsi`).
- Slack connector: `slack/it-takes-a-village` (`scl_g32hxyh1ZP4wQiV3OOLRiQ`) — `vercel connect list` to inspect.
- **Deploy: the GitHub repo is connected to the Vercel project, so pushing to `main` auto-redeploys production.** Manual deploy: `vercel deploy --prod --yes`. **`eve deploy` is broken** (force-appends an invalid `--non-interactive`), don't use it. Consequence to design around: because git is the source of truth *and* wired to auto-deploy, a midwife `commit` that writes/updates a villager folder will also trigger a production redeploy — fine, but keep commits deliberate.
- Env: `AI_GATEWAY_API_KEY` is the var the AI SDK reads (NOT `VERCEL_API_GATEWAY_KEY`); it's in `.env.local` (gitignored) and the Vercel project's Production env. `.env.example` documents it.
- Model funding: AI Gateway **free tier 403s premium models**; a *budget* is only a spend cap, not funds — you must add **credits**. Free ($0) models like `inclusionai/ling-3.0-flash-fin-free` work with no credits.

## Next (build)

1. **Live-test the loop** in `#village-exa-researcher`: `@villager <research question>` → 🔎 Exa Researcher posts a sourced brief with a Confidence line. Watch for double-post; confirm `search.sh` runs in the sandbox with the brokered key.
2. **Merge Ren's `rooms/` memory** into the village folder, then wire it into the `ingestForMemory()` seam.
3. **`birth`/`commit` pipeline**: threaded interview incl. "show me an example of the input" → template-fill a villager folder → append the channel→villager entry to `agent/lib/villages.ts` → **git-commit** (sandbox is not durable; the midwife must commit). Channel is pre-created by a human (auto-create deferred — `channels:manage` not grantable).
4. **Learning loop**: correction in thread → villager proposes a knowledge atom → human confirms → passes the fixture → committed with author's name → changes the next run.

## Open decisions (waiting on David)

- **Enable `message.channels` on the Connect trigger** (Advanced → Trigger Event Types) so in-thread corrections without a re-mention reach `onMessage`. @mentions already work without it.
- **`/project-status`** update — worth offering once the loop is proven live (crosses prototype→running).
- **`/shelloverflow`** post — the persona-in-one-app + sandbox credential-brokering findings are genuinely novel; offer at a good commit.

## Resolved (was open)

- **Demo workflow = Exa-powered Researcher villager** (research question → sourced brief; corrections tune source taste). No OAuth; showcases the $50 Exa credits.
- **Trigger = native `@villager` mention**; channel disambiguates the villager. Listen always, act only when addressed.
- **Registry lives in git** (`agent/lib/villages.ts`), not Blob.

## Not done / parked

- **Linear tickets were drafted in conversation but NOT created** (team "Ren Murakami", project "it-takes-a-village"), and are now partly stale: foundation (Slack/creds/deploy) is largely done; the 👍 reaction ticket (B4) was cut; workflow-specific tickets wait on the demo-workflow decision. Redraft against current state before creating.
- Deferred to `docs/future.md`: personal/DM brain, promotion, org pool, `eve deploy` graduation, multi-stage villagers, novel script generation, UI viz layer. **This version is community-brain only.**

## Coordination with Ren (Sep 12, active)

- Ren is building the **community-brain memory** under `agent/sandbox/workspace/village/rooms/` (append-only rooms, content ranking; `agent/lib/memory.ts` + `memory-demo.ts`; a `demo-room/` fixture is already merged). **Leave `rooms/` to Ren for now** — we merge his memory into the village folder after our loop is proven, then wire it into the `ingestForMemory()` seam in `agent/lib/memory-ingest.ts`.
- Our side owns the midwife, the villager folders/routing, and the birth/commit pipeline (next).

## Decisions locked this session (already in the docs)

- Cut the mom-test/non-developer/from-home narrative; cut science/Battelle, OpenClaw, Second Reader, PR firm/voice/CopilotKit. Focus is purely the villager-in-a-channel + midwife + community brain.
- Git is the source of truth; villagers + community brains live under `agent/sandbox/workspace/village/` (`villagers/` + `rooms/`); `agent/` is the midwife (folder name is fixed by Eve, can't be renamed).
- Learning is a *proposal* the villager considers saving as an atom, confirmed by a human — not an automatic permanent rule.
