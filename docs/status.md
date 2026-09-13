# Status & handoff (live)

Fast-moving hackathon handoff — the current state, what's next, and open decisions. Updated Sep 12. `docs/plan.md` is the source of truth for the design; this file is "where are we right now." Keep it short and current.

> **Video: DONE and SUBMITTED (Sep 12).** The 2-minute video is complete and submitted. Remaining work is feature quality (the learning loop), not the deadline.

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
2. **Learning loop = the write side (in progress).** The read side is **DONE**: the villager reads its brain (`memory/index.md`) before every answer and obeys any taught rules (`instructions.md` step 1 + the `villages.ts` framing `cat memory/index.md`). The brain starts **empty** and learns in public. **Ingestion model settled + recorded in [ADR 0001](adrs/0001-knowledge-ingestion-model.md):** extraction runs **end-of-turn over a per-thread watermark** (timely, cheap, no double-collecting); atoms are sourced **only from humans or cited web results, never the villager's own prose**; the villager **judges** atom-worthiness ("nothing worth saving" is valid — guards over-collection); updates record `supersedes: <id>` so rules don't pile up. Mechanism = a **deterministic in-villager script** (`scripts/record-atom.*`) the villager runs via bash: writes `memory/atoms/<id>.md` (attributed) + rebuilds `index.md`. Persists in-thread (sandbox survives across turns); git-permanence is a later midwife-commit step. Chosen over Blob/`fileMemory` because git-tracked, human-readable atoms *are* the "learn in public" story.
   - **BUILT + LIVE (Sep 12):** `scripts/record-atom.mjs` (deterministic: writes an attributed atom in Ren's exact frontmatter, dedups exact duplicates, supersedes via `superseded_by`, rebuilds `index.md`'s rules/questions) + the villager's end-of-turn extract step (`instructions.md` "How I learn" + the `villages.ts` framing) with the human-only filter, dedup, and supersession. **Confirmed working in Slack** — the villager judged a human message a rule and saved an atom. **Attribution fix shipped** (`343e683`): `slack.ts` resolves thread participants' Slack ids → display names via `ctx.slack.request("users.info")` (cached, best-effort) and injects a "Speaker names" map so atoms are attributed to the NAME (`users:read` IS granted; verified `U0C0YRM6W15` → "David Hague"), not the raw id. **Follow-up for Ren's `agent/lib/memory.ts`:** `readAtoms`/`compileRoomMemory` don't yet honor `superseded_by`, so a canonical recompile would re-list a superseded rule — teach it to drop `superseded_by` atoms. Not blocking (villager reads the script's index).
   - **Deferred ([ADR 0002](adrs/0002-memory-scope-thread-vs-channel.md)): thread vs channel scope + the mention-per-thread UX** (David isn't a fan of thread-based tagging — revisit intentionally). `ingestForMemory()` stays a no-op (a channel-wide sweep would need it; not now).
3. **`birth`/`commit` pipeline — THE ACTIVE NEXT TASK (atom permanence to git).** Learned atoms today live only in a thread's sandbox (`/workspace` persists across turns in a session, but not across threads or redeploys) — so they vanish on redeploy/new thread. Making them permanent means writing the villager folder (incl. `memory/atoms/`) back to the git repo. **The hard problem:** neither the sandbox (firewall allows only `api.exa.ai`, no repo/creds) nor the app runtime (serverless, no repo checkout) can `git push`. Options to brainstorm: (a) a tool using the **GitHub contents API** with a token to commit files directly; (b) the midwife **posts the file paths/contents (or a diff/PR) for a human to commit** (Ren's current `agent/instructions.md` says the midwife has NO commit tool and does exactly this); (c) periodic export. Same mechanism also powers **birth** (interview → template-fill a new villager folder → append the channel→villager entry to `agent/lib/villages.ts` → land it in git). Channel is pre-created by a human (`channels:manage` not grantable). **Start here after compaction: brainstorm how writes reach git.**

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
- ~~Learning is a *proposal* the villager considers saving as an atom, confirmed by a human~~ **RETIRED Sep 12.** Pivot to **autonomous memory, no confirmation gate**: the villager decides what to remember and writes attributed atoms itself; humans correct after the fact. It still never rewrites its own instructions/scripts (code) — autonomy is over the memory layer only. See `plan.md` and `eve-verification.md`.
