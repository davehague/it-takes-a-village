# Progress log

Running status for It Takes a Village. Newest first. `plan.md` is the design doc; this is what is actually done, decided, blocked, and next.

## Sep 13 — Hackathon → living project; docs reframed

The hackathon build carried through the full birth → run → learn → maintain loop in production, so the project graduated from "hackathon submission" to a living open-source project. Reframed the doc set off the deadline/build-day framing: `CLAUDE.md` and `README.md` now lead with the pattern (agents born/run/taught in public; the folder is the asset) and the open-source direction; `plan.md` retitled from "Hackathon Plan" to the design doc, with the build-day timeline, Plan B, "scope for today", and prep sections replaced by design principles + a status/roadmap pointer; `status.md`, `future.md`, and this log de-hackathonized. Origin (AI Tinkerers Columbus, Sep 12–13 2026) kept as a one-line provenance note throughout. No code change.

## Sep 13 — Atom permanence: memory moved to Blob + git snapshot; durable learning verified LIVE

Re-examined the "git is the source of truth" premise (which was making the git write painful) and split memory into two stores ([ADR 0003](adrs/0003-memory-substrate-blob-live-git-snapshot.md)): **Vercel Blob = the live runtime store** (cheap writes, no redeploy) and **git = a periodically-snapshotted public record**. Write mechanism = **C1**: the sandbox no longer touches memory. Built: `MemoryStore` abstraction (`agent/lib/memory-store.ts`, Blob in prod / local fs in dev); the atom-write logic ported from the retired `record-atom.mjs` to a pure TS function (`agent/lib/record-atom.ts`, dedup + supersession); the app-runtime **`record_atom` tool** (`agent/tools/record_atom.ts`); the read side injected from the store as turn context (`brainFraming` in `slack.ts`); the **`snapshot_memory` tool** + `commitFilesToBranch` (`agent/lib/github-commit.ts`, GitHub Git Data API → non-deploying `village-memory` branch); Ren's `memory.ts` now honors `superseded_by`. 20 unit tests, `tsc`/`eve` clean (13 tools). Commits `662e1b2`, `34cbce5`, `d376552`, `227dfdd`.

Env provisioned + deployed: created the `village-memory` Blob store (token in prod + `.env.local`), added a repo-scoped `GITHUB_TOKEN` (prod + local). Verified every path against the live services (Blob round-trip, `record_atom`-over-Blob, `commitFilesToBranch`).

**Verified LIVE in Slack:** taught the Exa Researcher "always include tokens/sec" → it recorded an attributed atom → a **brand-new thread obeyed the rule** (tokens/sec for every model). The rule survived the thread boundary because memory persists to Blob, not the thread sandbox — the whole point of ADR 0003. **Next:** the `birth` pipeline (reuses `commitFilesToBranch`); minor: wire a Slack trigger for `snapshot_memory`.

## Sep 12 — Learning loop LIVE end to end; attribution fixed

The autonomous write side works in Slack: the Exa Researcher judged a human message a durable rule and saved an attributed atom via `record-atom.mjs` — read → answer → learn all in one thread. Built and shipped: `scripts/record-atom.mjs` (deterministic write in Ren's exact frontmatter, exact-duplicate dedup, `superseded_by` supersession, `index.md` rebuild) + the villager's end-of-turn extract step (human-only filter, dedup, supersession) in `instructions.md`/`villages.ts`.

Then fixed the one live bug: atoms were attributed to a raw Slack id (`U0C0YRM6W15`) because Eve attaches only the id to messages (no profile lookup by design). `slack.ts` now resolves thread participants' ids → display names via `ctx.slack.request("users.info")` (cached, best-effort) and injects a "Speaker names" map so the villager uses the name. Verified `users:read` is granted (`U0C0YRM6W15` → "David Hague"). Commits: `7ee7810` (write side), `343e683` (attribution). Follow-up for Ren's `memory.ts`: honor `superseded_by` so a canonical recompile matches the villager's live index.

**Next: the birth/commit pipeline = atom permanence to git.** Atoms currently live only in a thread's sandbox. The hard problem: neither sandbox nor app runtime can `git push`, so writes reach git via the GitHub API (token) or via a human committing posted content. Brainstorm that first.

## Sep 12 — Knowledge-ingestion model locked (ADR 0001); scope deferred (ADR 0002)

Worked through the ingestion model carefully — the collection/non-collection boundary is the quality-critical part of "learn in public". Recorded it as `docs/adrs/0001-knowledge-ingestion-model.md` (Accepted). Five-stage pipeline (context → capture → extract → store → recall). Decisions: (1) extraction runs **end-of-turn over a per-thread watermark** — timely, cheap, idempotent, learns from all human parties in the thread; (2) **human-only sourcing** with a cited-web-results exception — the villager never learns from its own prose; (3) **judgment over keywords**, with "nothing worth saving" a valid outcome to prevent over-collection; (4) **supersession** (`supersedes: <id>`) so updated rules replace stale ones instead of piling up. Deferred in `docs/adrs/0002-memory-scope-thread-vs-channel.md`: thread-vs-channel scope and the mention-per-thread interaction model (David flagged thread-based tagging as not his favorite; revisit deliberately). Source-of-truth docs updated to point at the ADRs (`plan.md`, `status.md`).

## Sep 12 — Video submitted; learning-loop design settled (autonomous, no confirmation)

**The 2-minute video is complete and submitted.** Remaining work is feature quality, not deadline.

Designed the write side of the learning loop and verified its constraints. Findings (full detail in `eve-verification.md` → "Learning-loop mechanics"): the sandbox `/workspace` persists across turns within one durable session (Slack thread), so a villager can write a file and read it back next turn with no git round-trip; authored tools run in the app runtime but `ctx.getSandbox()` gives the live sandbox handle; Eve memory (`defineMemory`) recall/capture is turn-tied, so passive per-message ingest is out of scope.

**Design pivot: autonomous memory, no confirmation gate.** Dropped the "villager proposes → human confirms → commit" loop. The villager now decides what to remember and writes attributed atoms during its own turn; humans correct after the fact (a correction is a superseding atom). The kept line: a villager manages its **memory** autonomously but never rewrites its **code** (instructions/scripts). Mechanism chosen = a deterministic in-villager script the villager runs via bash (writes `memory/atoms/<id>.md` + rebuilds `index.md`), over a Blob/`fileMemory` path — because git-tracked, human-readable atoms are the "learn in public" story. Retired: the hand-built 👍-approval bridge (no longer needed for learning). Docs updated: `plan.md`, `CLAUDE.md` hard rules, `eve-verification.md`, `status.md`.

## Sep 12 — Villager reads its brain; seed atoms cleared to learn in public

Wired the memory **read** side and fixed a legitimacy problem. The Exa Researcher now reads `memory/index.md` before every answer (`instructions.md` step 1 + a `cat memory/index.md` line in the `villages.ts` framing) and obeys any rules the channel has taught it, saying which rule shaped the answer.

Cleared the seed atoms. Ren's `createExampleRoom` fixture had fabricated atoms attributing rules to "david"/"ren" ("prefer primary sources", "last 24 months") as if said in the channel — and they directly contradicted the villager's own `instructions.md`, which said the learned-rules list was "none yet". For legitimacy (the public video shouldn't imply conversations that never happened) and a stronger demo (watch it learn a rule live, then obey it), the brain now starts **empty and valid** (`index.md` = "0 atoms", empty `atoms/`/`themes/`/`raw/` with `.gitkeep`). `memory-demo.ts` was retargeted to a `mkdtemp` scratch dir so it stays a format demo and can never re-pollute a live villager. Eve memory recall/capture is turn-tied (mention-only), so the passive `ingestForMemory()` seam stays a no-op — deferred as not demo-relevant. Tests green (9/9), tsc clean.

## Sep 12 — Memory design resolved: one folder per villager (collapsed `rooms/`)

Decided and merged: the community brain is **not** a separate `rooms/<channel_id>/` tree. One channel = one villager, so `rooms/` and `villagers/` keyed the same 1:1 thing twice. Collapsed the community brain into the villager's own folder as `villagers/<slug>/memory/` — the accumulating atoms/themes/index *are* the villager's living wiki (no separate curated wiki). Merged Ren's `demo-room/` fixture into `villagers/exa-researcher/memory/`; his compiler (`agent/lib/memory.ts`, `memory.test.ts`) is untouched since `compileRoomMemory` takes any path — only `memory-demo.ts`'s one path line changed. Tests stay green (9/9); the demo regenerates at the new path. The Slack channel still selects the store via `villagerForChannel(channelId).dir` + `/memory`.

### Next
- Wire `ingestForMemory()` (still a no-op) to the villager's `memory/`: raw pointers first, then a channel-scoped Eve `fileMemory` slot for durability (the sandbox is not durable, so on-disk `memory/` alone won't hold runtime writes). Confirmed atoms are the learning-loop step, on human confirmation.
- Build the `birth`/`commit` pipeline.

## Sep 12 — Loop works live (after a runaway-loop scare)

Milestone: `@villager <question>` in `#village-exa-researcher` returns **one clean, Markdown-rendered, Exa-sourced brief** with a Confidence line. The full interpreted-villager path works end to end on `anthropic/claude-sonnet-5`.

### Fixed on the way here (three real bugs)
- **Runaway reply loop (50+ posts).** `post_as_villager` posts with a custom username, which Eve's self-message filter does not recognize as the app's own, so each villager reply re-triggered `onMessage` on the subscribed thread. Fix: act ONLY on an explicit human `@villager` mention (removed the `isSubscribed`/DM auto-continue) and drop all bot-authored messages in both handlers. Had to pull the Eve/Connect installation to stop it mid-incident (a code deploy alone didn't, likely because events were still routing to an older deployment until reinstall re-pointed them).
- **Double-post + "Empty model response" turn failure.** Caused by instructing the model to reply only via `post_as_villager` and emit no final text — Eve treats an empty final message as a failed turn, errors, and retries (the second near-identical brief).
- **Raw Markdown** (`**bold**`, `[label](url)` shown literally) because the reply went out in Slack's mrkdwn `text` field.

### The fix that stuck (Option A)
A villager turn now replies with its brief as the **normal assistant message**. Eve's default reply (`thread.post`) sends it as Slack `markdown_text`, so GitHub-flavored Markdown renders, and there is no empty-final failure. No `post_as_villager` on the reply path (kept for birth announcements). Trade-off: run replies show the app name **"villager"**, not "Exa Researcher" 🔎 — identity is introduced at birth. Switched model Luna → **Sonnet 5** for fewer empty completions. Details in `docs/eve-verification.md`.

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
- `channels:manage` (midwife auto-creates the village channel) — not grantable on the Vercel Connect managed Slack app. Post-hackathon fix: self-managed app created from `slack/manifest.json` (see `future.md`).

### Next
- Build the real midwife birth flow as an Eve tool in the deployed agent: interview → fill villager folder → announce as the villager via the `ctx.slack.request` escape hatch (custom name + icon).
- Wire Exa search ($50 credits) into the villager's run step so "Exa Researcher" returns sourced findings.
- One clean filmed pass of the loop: birth → post → correct → rerun, all inside `#village-exa-researcher`.

## Sep 12 (earlier) — hello-world milestone

Midwife deployed and replying to @mentions in Slack via Vercel Connect. Eve v0.54.3 verified against its bundled docs; the load-bearing unknowns are resolved in `eve-verification.md`.
