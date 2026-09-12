# Status & handoff (live)

Fast-moving hackathon handoff — the current state, what's next, and open decisions. Updated Sep 12. `docs/plan.md` is the source of truth for the design; this file is "where are we right now." Keep it short and current.

## Current state — the loop WORKS LIVE ✅

- **`@villager <question>` in `#village-exa-researcher` → one clean, Markdown-rendered, sourced brief** (ending in a `Confidence:` line). Confirmed working end to end: it CDs into the villager folder, runs `search.sh` (real Exa), synthesizes, and replies once.
- **One app (`@villager`), two roles by channel:** midwife in `#villager-management` (`C0C0YRB5M47`); the first villager **Exa Researcher** 🔎 in `#village-exa-researcher` (`C0C1GK8SGKT`).
- Model **`anthropic/claude-sonnet-5`** via Vercel AI Gateway (switched off Luna for fewer empty completions). Slack via **Vercel Connect** (managed app, no manifest).
- **Reply mechanism = Option A:** a villager turn replies with its brief as the *normal* assistant message; Eve posts it once and renders Markdown (`thread.post` → `markdown_text`). So **run replies show the app name "villager", not "Exa Researcher" 🔎** — the birth announcement (via `post_as_villager`) is where the per-villager name/face is introduced. If we want the 🔎 face on every reply, that's the two-post variant (branded brief + a tiny app line).
- **Anti-loop hardening in place:** the app acts ONLY on an explicit human `@villager` mention (no auto-continue on subscribed threads), and drops all bot-authored messages. See the loop post-mortem in `docs/eve-verification.md`.

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

1. ~~Live-test the loop~~ **DONE** — one clean sourced reply confirmed. (Optional: decide whether to add the 🔎 per-reply face via the two-post variant.)
2. **Learning loop = the write side (next real build).** The read side is **DONE**: the villager reads its brain (`memory/index.md`) before every answer and obeys any taught rules (`instructions.md` step 1 + the `villages.ts` framing `cat memory/index.md`). The brain now starts **empty** and learns in public — the fabricated seed atoms were cleared (they contradicted the villager's own "none yet" and implied conversations that never happened; regenerable via `memory-demo.ts`, which now writes to a scratch dir, never the live villager). So the missing piece is **writing** a new atom: correction in thread → villager proposes an atom → human confirms → `recordAtom`/`compileRoomMemory` appends it under `memory/atoms/` → midwife git-commits with the author's name → next run reads it and obeys. This is the filmed "learn in public" beat.
   - **Deferred (not demo-relevant): `ingestForMemory()` stays a no-op.** Eve's memory lifecycle only recalls/captures on *turns* (mentions), so passive capture of un-mentioned chatter would be a custom Vercel-Blob build with no beat in the 2-min video. Leave the seam documented.
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

- Ren built the **community-brain memory** compiler (`agent/lib/memory.ts` + `memory-demo.ts` + `memory.test.ts`; append-only atoms, generated themes/index/graph, content ranking). **Merged (Sep 12):** his `demo-room/` fixture now lives at `villagers/exa-researcher/memory/` and the `rooms/` tree is gone — one channel = one villager, so memory lives in the villager's own folder. His compiler is untouched (it takes any `roomPath`); only `memory-demo.ts`'s one path line changed. Ping Ren that the fixture moved. Next: wire it into the `ingestForMemory()` seam.
- Our side owns the midwife, the villager folders/routing, and the birth/commit pipeline (next).

## Decisions locked this session (already in the docs)

- Cut the mom-test/non-developer/from-home narrative; cut science/Battelle, OpenClaw, Second Reader, PR firm/voice/CopilotKit. Focus is purely the villager-in-a-channel + midwife + community brain.
- Git is the source of truth; villagers live under `agent/sandbox/workspace/village/villagers/`, each with its own community brain at `<slug>/memory/` (one channel = one villager, so no separate `rooms/` tree); `agent/` is the midwife (folder name is fixed by Eve, can't be renamed).
- Learning is a *proposal* the villager considers saving as an atom, confirmed by a human — not an automatic permanent rule.
