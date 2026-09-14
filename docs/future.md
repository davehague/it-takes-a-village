# Roadmap & deferred scope

Directions deliberately deferred to keep the core tight: a villager that lives in a channel with multiple humans, plus the midwife and the **community brain**. Captured here as the roadmap and the parking lot. `plan.md` is the design doc; `status.md` is current state; this file is what's next and what's intentionally not built yet.

## What's next (triaged Sep 13 2026)

Everything in this file is deferred on purpose; this section is the ordered backlog, triaged so a session knows what it can *build* versus what needs a *decision* from David first. Bins: **Build** = spec'd, testable, reversible on a branch — an agent can take it. **Research** = the premise is uncertain; the deliverable is a finding and a recommendation, not code. **Decide** = a real tradeoff whose answer depends on intent — it goes to David with a recommendation and is never executed by default. (Every commit to `main` redeploys production, so hard-to-reverse work leans Decide.)

| # | Item | Bin | Section |
|---|---|---|---|
| 1 | Prove ICM-style multi-stage folders with the promotion rule accepted Sep 13 | **Build** (rule decided) | Multi-stage villagers |
| 2a | Hands: script creation + a fixture gate at birth, determinism by default | **Build — in progress** on `feature/hands-at-birth` (Sep 13) | Novel script generation |
| 2b | Non-technical users setting up and troubleshooting integrations | Decide / flesh out | Non-technical users |
| 2c | Interview handholding so the villager's intent is confirmed before birth | Build, after a UX design gate | Non-technical users |
| 3 | `channels:manage` "granted but not working" | Closed — answered by the Sep 12 spike | Auto-created village channels |
| 4 | One Slack app or two (midwife vs villagers), and how a villager gets tagged in | **Decided Sep 13:** stay on the managed app, one app → Build the midwife's pre-birth instructions to the human | Auto-created village channels |
| 5 | Channel-scoped interaction: ingest everything, chime in only when asked | **Decided Sep 13** ([ADR 0004](adrs/0004-channel-scoped-trigger-mention-only.md)): explicit `@mention` only → Build channel ingestion once `message.channels` is on | Channel-scoped interaction |
| 6 | Scheduling: may villagers act proactively? | **Deferred Sep 13:** not now, revisit after hands (2a) ships | Scheduling and proactive villagers |
| 7 | Multi-level memory (personal, company) + a chat/provenance store | **Deferred Sep 13:** community brain only; no design work either | Personal brain · Org-wide brain · Generated memory internals |
| 8 | Should memory be snapshotted to git at all? (the git half of ADR 0003) | **Decide, later** — YAGNI until a reader of the public record exists; build nothing | Memory snapshot to git |

Net (after the Sep 13 decision pass): 2a is in progress on a branch; 1, the item-4 follow-up (pre-birth instructions), and the item-5 follow-up (channel ingestion) are build-ready; 6 and 7 are deferred by decision; 8 is the one open discussion. Build on a branch; every push to `main` redeploys production.

**Smaller build items** (all Build; no decision needed): a `retire_villager` tool (de-birth — remove the folder, registry key, and Blob memory; today done by hand); brain visibility for the midwife (`atomCount` in `list_villagers`, a `read_memory` tool); the midwife's pre-birth instructions to the human (which channel to create, what to name it, what the interview needs from them; decided Sep 13 under item 4); redeploy-aware birth (poll Vercel so the midwife says "I'm awake" instead of "~1–2 min"); per-file executable mode for births and `update_villager` (committed scripts land non-executable); and enabling `message.channels` on the Connect trigger (a config toggle David is flipping; prerequisite for the item-5 ingestion build).

## Personal brain (DM / per-user pool)

From the deploy-and-brains whiteboard (`docs/architecture-deploy-and-brains.md`). A human can DM the villager and see a private pool — that user's own pool plus the villager's own knowledge — never anyone else's private pool. The rule is read up, promote up, never read down: a DM turn reads its own pool plus the community brain; a channel turn never mounts a DM pool; promotion ("share this with the team") copies a personal atom up into the community brain, explicit and attributed. **Today only the community brain exists** — there is no DM/personal pool and no promotion step yet. The `dm/` path stays gitignored so private pools never land in the public repo when we do build this.

**Item 7 — deferred Sep 13.** Multi-level memory is designed above and on the whiteboards. Decision: community brain only, and no privacy-model design work yet either; reopen when a second human wants to teach a villager privately.

## Org-wide brain

A workspace-wide pool above the community brain — the institution learning across channels. Read up / promote up applies here too. Named as the extension, not built.

**Item 7:** this is the "company brain" — so villagers understand what the organization is about. Same read-up / promote-up rule; deferred with the personal brain (Sep 13).

## Graduation (`eve deploy` per villager)

Each villager folder is a valid Eve agent directory from day one, so it can graduate to its own deployment with `eve deploy` — same artifact, two execution modes (interpreted while young, compiled when graduated). ~20-minute beat; a stretch goal, not core.

## Multi-stage villagers

A stage is a folder with its own `CONTEXT.md` and `output/`; stage 2 reads stage 1's `output/`. Single stage today; multi-stage when a workflow earns it. When a stage needs isolation or a narrower tool set, it becomes a declared Eve subagent under `agent/subagents/`.

**Item 1 — rule decided Sep 13, proof still to build.** A workflow earns `stages/NN-*/` instead of one `instructions.md` when the work produces more than one distinct output that a later step consumes, when a stage needs its own fixture, or when a step needs a narrower tool set or isolation (the declared-subagent case above). Otherwise it stays single-stage. Build: birth one real multi-stage villager end to end to prove the rule; do it after 2a lands so stages can carry scripts and fixtures.

## Novel script generation

Today the midwife composes scripts from a small pre-written library (selected scripts can't hallucinate). Generating brand-new scripts from the interview is a later step.

**Open (item 2a — the most important next step): "hands."** Births are prose-only today, so a villager can't take actions. Make script creation and a fixture gate part of birth, with determinism as the default: the interview selects or parameterizes library scripts (or generates a novel one), runs them against the fixture in the sandbox, and commits only on green. Committed scripts also need per-file executable mode. This is Build and is **in progress on `feature/hands-at-birth`** (started Sep 13); the design lives in `docs/superpowers/specs/2026-09-13-birth-pipeline-design.md` with a hands-specific spec landing on the branch.

## Generated memory internals

Sliding-window context, `themes/` and `index.md` generated from atom frontmatter, compile-atoms-to-`skills/` at graduation, and a standalone compaction routine that takes a pool path. The current build keeps the community brain simple; these are the fuller memory architecture.

**Item 7 (provenance) — deferred Sep 13.** Should chats be saved to a database for later reference? The memory whiteboard's progressive-disclosure path is themes → knowledge atoms → chat provenance, pulled in only as needed. A provenance store would make that third layer real, but it raises the privacy bar (private DMs must never reach the public repo). Deferred with the rest of item 7.

## UI visualization / read-only viz layer

Git stays the source of truth; a read-only UI over the villager folders and the community brain (to browse instructions, atoms, and who taught what) could come later. David's note.

## Auto-created village channels (self-managed Slack app)

The original vision had the midwife create each village channel itself (`conversations.create`) for a hands-off birth. That needs the `channels:manage` bot scope, and the Sep 12 spike proved it is **unavailable on the Vercel Connect _managed_ Slack app**: Connect hands out a fixed ~24-scope bundle and there is no supported way to add `channels:manage` — the CLI has no scope flag, editing the Slack app manifest does not change the grant, and a full uninstall/reinstall still mints a token without it (see `eve-verification.md` for the proof). Today a human pre-creates the channel and the villager posts in via `chat:write.public`. To get auto-create back, move the midwife off the managed connector to a **self-managed Slack app**: create it from `slack/manifest.json` (which already declares `channels:manage`), swap the three Connect URLs (`redirect_urls`, `event_subscriptions.request_url`, `interactivity.request_url`) to the deployment's `/eve/v1/slack`, turn off `managed_app_settings`, and use the resulting `xoxb-` bot token — self-managed apps expose one, managed apps do not. Trade-off: you own the app config and the Request-URL wiring that Connect currently handles for free.

**Items 3 and 4.** The "app has `channels:manage` but it doesn't work" observation is the declared-versus-granted gap above: `slack/manifest.json` declares the scope, but the token the managed connector mints never carries it — that is what the spike proved. So the research is largely answered; re-verify only if a fresh check of the live token's scopes shows it present. The real open **decision** is #4, because moving to a self-managed app is itself the "second app" question. Options: (a) one self-managed app playing every role by channel, as today; (b) two apps — a midwife app and a villagers app — so villagers carry their own identity and can be addressed directly. Either way, settle how a villager is tagged in (today: `@villager` plus the channel picks the villager). **Decided Sep 13: stay on the managed Connect app, one app, as today.** Humans pre-create the village channel; villagers reply as the app and the channel picks who. The follow-up is Build, not Decide: the midwife must give the human explicit pre-birth instructions, which channel to create and how to name it, what the interview needs from them (the job, an example input, what good looks like), and what happens after the yes. Reopen the two-app question only when per-villager identity is a demonstrated need.

## Non-technical users: integrations, troubleshooting, and intent confirmation

**Item 2b (Decide / flesh out).** Let non-technical people connect a villager to the systems it needs and troubleshoot those integrations without a developer. Underspecified today — which integrations, and what "troubleshoot" means for that audience — so two agents would build two different things. Flesh out a target list and a support flow before building.

**Item 2c (Build, after a design gate).** The midwife already reflects the interview back and asks "shall I birth it?"; extend that into deliberate handholding — ask in the user's terms, propose defaults, and confirm the villager's intent (the job, the input, what "good" looks like) before birth. Design the confirmation UX, then build.

## Channel-scoped interaction (reopening ADR 0002)

**Item 5 (Decide → Build).** Today a villager only acts in threads it is mentioned in. The intended model is channel-scoped: everything said in a village channel is ingested as context, and the villager chimes in only when asked. This reopens ADR 0002, which deferred exactly this until David's preference triggered it. **Decided Sep 13 ([ADR 0004](adrs/0004-channel-scoped-trigger-mention-only.md)): "asked" means an explicit human `@villager` mention, nothing else.** Everything else in the channel is context only. The anti-loop rule from the post-mortem in `eve-verification.md` is preserved unchanged. What's left is Build: once `message.channels` is enabled on the Connect trigger (David is flipping it), wire unmentioned channel messages into the villager's context and extraction window via the `ingestForMemory()` seam so an in-thread correction without a re-mention still lands as an atom.

## Scheduling and proactive villagers

**Item 6 — deferred Sep 13.** Should a villager be able to schedule work and act proactively rather than only when asked? This is the largest character change on the roadmap, an agent acting unasked, so it stays a decision, and the decision for now is no. Revisit after hands (2a) ships with a concrete use case. If yes then: research Eve's schedules (`AGENTS.md` lists schedules among the things Eve authors), decide how proactive posts interact with the anti-loop rule (bot-authored messages never trigger turns), then build.

## Memory snapshot to git

**Item 8 (Decide, later).** ADR 0003 split memory into Vercel Blob (live) and a git snapshot on the `village-memory` branch (the public record). The `snapshot_memory` tool exists and its git path is proven, but nothing calls it, and on Sep 13 David flagged the bigger question: should memory be snapshotted to git at all? Until someone actually wants to read the public record, it is YAGNI. Decision: build no trigger, no schedule, no auto-snapshot; keep the tool as is; have the full discussion later and build then if the answer is yes. If the answer is no, ADR 0003's git half is retired and the "learn in public" story is told through Slack and a read-only viz layer instead.
