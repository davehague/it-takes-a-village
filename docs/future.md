# Roadmap & deferred scope

Directions deliberately deferred to keep the core tight: a villager that lives in a channel with multiple humans, plus the midwife and the **community brain**. Captured here as the roadmap and the parking lot. `plan.md` is the design doc; `status.md` is current state; this file is what's next and what's intentionally not built yet.

## What's next (triaged Sep 13 2026)

Everything in this file is deferred on purpose; this section is the ordered backlog, triaged so a session knows what it can *build* versus what needs a *decision* from David first. Bins: **Build** = spec'd, testable, reversible on a branch — an agent can take it. **Research** = the premise is uncertain; the deliverable is a finding and a recommendation, not code. **Decide** = a real tradeoff whose answer depends on intent — it goes to David with a recommendation and is never executed by default. (Every commit to `main` redeploys production, so hard-to-reverse work leans Decide.)

| # | Item | Bin | Section |
|---|---|---|---|
| 1 | Prove ICM-style multi-stage folders; decide when a villager graduates from a single `instructions.md` | Decide (small) → Build | Multi-stage villagers |
| 2a | Hands: script creation + a fixture gate at birth, determinism by default | **Build** — top priority | Novel script generation |
| 2b | Non-technical users setting up and troubleshooting integrations | Decide / flesh out | Non-technical users |
| 2c | Interview handholding so the villager's intent is confirmed before birth | Build, after a UX design gate | Non-technical users |
| 3 | `channels:manage` "granted but not working" | Research — largely answered | Auto-created village channels |
| 4 | One Slack app or two (midwife vs villagers), and how a villager gets tagged in | Decide, gated on #3 | Auto-created village channels |
| 5 | Channel-scoped interaction: ingest everything, chime in only when asked | Decide → Build | Channel-scoped interaction |
| 6 | Scheduling: may villagers act proactively? | Decide → Research → Build | Scheduling and proactive villagers |
| 7 | Multi-level memory (personal, company) + a chat/provenance store | Decide (scope, privacy) → Build | Personal brain · Org-wide brain · Generated memory internals |

Net: two items are build-ready today (2a, and 1 once its rule is confirmed), one is research the Sep 12 spike may already answer, and four need a decision first. Don't hand this list to an autonomous run as-is — answer the Decide items, then build the Build subset on a branch.

**Smaller build items** (all Build; no decision needed): a `retire_villager` tool (de-birth — remove the folder, registry key, and Blob memory; today done by hand); brain visibility for the midwife (`atomCount` in `list_villagers`, a `read_memory` tool); a Slack trigger for `snapshot_memory` (the git public-record half is wired but nothing calls it); redeploy-aware birth (poll Vercel so the midwife says "I'm awake" instead of "~1–2 min"); per-file executable mode for births and `update_villager` (committed scripts land non-executable); and enabling `message.channels` on the Connect trigger (a config toggle, prerequisite for item 5).

## Personal brain (DM / per-user pool)

From the deploy-and-brains whiteboard (`docs/architecture-deploy-and-brains.md`). A human can DM the villager and see a private pool — that user's own pool plus the villager's own knowledge — never anyone else's private pool. The rule is read up, promote up, never read down: a DM turn reads its own pool plus the community brain; a channel turn never mounts a DM pool; promotion ("share this with the team") copies a personal atom up into the community brain, explicit and attributed. **Today only the community brain exists** — there is no DM/personal pool and no promotion step yet. The `dm/` path stays gitignored so private pools never land in the public repo when we do build this.

**Item 7 (Decide: scope and privacy).** Multi-level memory is designed above and on the whiteboards; the open questions are whether to build it now and how to keep private pools out of the public repo if any of it lands in a database rather than files.

## Org-wide brain

A workspace-wide pool above the community brain — the institution learning across channels. Read up / promote up applies here too. Named as the extension, not built.

**Item 7:** this is the "company brain" — so villagers understand what the organization is about. Same read-up / promote-up rule; same scope-and-privacy decision as the personal brain.

## Graduation (`eve deploy` per villager)

Each villager folder is a valid Eve agent directory from day one, so it can graduate to its own deployment with `eve deploy` — same artifact, two execution modes (interpreted while young, compiled when graduated). ~20-minute beat; a stretch goal, not core.

## Multi-stage villagers

A stage is a folder with its own `CONTEXT.md` and `output/`; stage 2 reads stage 1's `output/`. Single stage today; multi-stage when a workflow earns it. When a stage needs isolation or a narrower tool set, it becomes a declared Eve subagent under `agent/subagents/`.

**Open (item 1): decide the promotion rule.** When does a workflow earn `stages/NN-*/` instead of one `instructions.md`? Working hypothesis: promote when the work produces more than one distinct output that a later step consumes, when a stage needs its own fixture, or when a step needs a narrower tool set or isolation (the declared-subagent case above). Then prove it by birthing one real multi-stage villager end to end. Decide the rule → Build the proof.

## Novel script generation

Today the midwife composes scripts from a small pre-written library (selected scripts can't hallucinate). Generating brand-new scripts from the interview is a later step.

**Open (item 2a — the most important next step): "hands."** Births are prose-only today, so a villager can't take actions. Make script creation and a fixture gate part of birth, with determinism as the default: the interview selects or parameterizes library scripts (or generates a novel one), runs them against the fixture in the sandbox, and commits only on green. Committed scripts also need per-file executable mode. This is Build — the design lives in `docs/superpowers/specs/2026-09-13-birth-pipeline-design.md`.

## Generated memory internals

Sliding-window context, `themes/` and `index.md` generated from atom frontmatter, compile-atoms-to-`skills/` at graduation, and a standalone compaction routine that takes a pool path. The current build keeps the community brain simple; these are the fuller memory architecture.

**Item 7 (provenance).** Should chats be saved to a database for later reference? The memory whiteboard's progressive-disclosure path is themes → knowledge atoms → chat provenance, pulled in only as needed. A provenance store would make that third layer real, but it raises the privacy bar (private DMs must never reach the public repo), so it is a Decide before a Build.

## UI visualization / read-only viz layer

Git stays the source of truth; a read-only UI over the villager folders and the community brain (to browse instructions, atoms, and who taught what) could come later. David's note.

## Auto-created village channels (self-managed Slack app)

The original vision had the midwife create each village channel itself (`conversations.create`) for a hands-off birth. That needs the `channels:manage` bot scope, and the Sep 12 spike proved it is **unavailable on the Vercel Connect _managed_ Slack app**: Connect hands out a fixed ~24-scope bundle and there is no supported way to add `channels:manage` — the CLI has no scope flag, editing the Slack app manifest does not change the grant, and a full uninstall/reinstall still mints a token without it (see `eve-verification.md` for the proof). Today a human pre-creates the channel and the villager posts in via `chat:write.public`. To get auto-create back, move the midwife off the managed connector to a **self-managed Slack app**: create it from `slack/manifest.json` (which already declares `channels:manage`), swap the three Connect URLs (`redirect_urls`, `event_subscriptions.request_url`, `interactivity.request_url`) to the deployment's `/eve/v1/slack`, turn off `managed_app_settings`, and use the resulting `xoxb-` bot token — self-managed apps expose one, managed apps do not. Trade-off: you own the app config and the Request-URL wiring that Connect currently handles for free.

**Items 3 and 4.** The "app has `channels:manage` but it doesn't work" observation is the declared-versus-granted gap above: `slack/manifest.json` declares the scope, but the token the managed connector mints never carries it — that is what the spike proved. So the research is largely answered; re-verify only if a fresh check of the live token's scopes shows it present. The real open **decision** is #4, because moving to a self-managed app is itself the "second app" question. Options: (a) one self-managed app playing every role by channel, as today; (b) two apps — a midwife app and a villagers app — so villagers carry their own identity and can be addressed directly. Either way, settle how a villager is tagged in (today: `@villager` plus the channel picks the villager). Recommendation to evaluate: keep one app until per-villager identity is a demonstrated need, since (b) doubles the Connect / Request-URL wiring you would own.

## Non-technical users: integrations, troubleshooting, and intent confirmation

**Item 2b (Decide / flesh out).** Let non-technical people connect a villager to the systems it needs and troubleshoot those integrations without a developer. Underspecified today — which integrations, and what "troubleshoot" means for that audience — so two agents would build two different things. Flesh out a target list and a support flow before building.

**Item 2c (Build, after a design gate).** The midwife already reflects the interview back and asks "shall I birth it?"; extend that into deliberate handholding — ask in the user's terms, propose defaults, and confirm the villager's intent (the job, the input, what "good" looks like) before birth. Design the confirmation UX, then build.

## Channel-scoped interaction (reopening ADR 0002)

**Item 5 (Decide → Build).** Today a villager only acts in threads it is mentioned in. The intended model is channel-scoped: everything said in a village channel is ingested as context, and the villager chimes in only when asked. This reopens ADR 0002, which deferred exactly this until David's preference triggered it. The decision is what "asked" means — an explicit mention, a question addressed to it by name, something else — and it must be made under the constraint of the runaway-loop post-mortem in `eve-verification.md` (mention-only exists because a loop happened). Cheap enabler regardless of the answer: enable `message.channels` on the Connect trigger so top-level channel messages reach `onMessage` (already listed under open decisions in `status.md`).

## Scheduling and proactive villagers

**Item 6 (Decide → Research → Build).** Should a villager be able to schedule work and act proactively rather than only when asked? This is the largest character change on the roadmap — an agent acting unasked — so it is a decision first. If yes: research Eve's schedules (`AGENTS.md` lists schedules among the things Eve authors), decide how proactive posts interact with the anti-loop rule (bot-authored messages never trigger turns), then build.
