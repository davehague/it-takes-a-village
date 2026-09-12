# Deploy paths and brains (whiteboard, Sep 12)

Companion to `plan.md` (the source of truth). This captures the second venue whiteboard — `docs/whiteboard/deploy-and-brains.jpg` — which David walked Ren through. It sharpens two things the plan already implies: how the midwife *deploys* a villager, and how the *brains* (memory pools) relate. Nothing here overrides `plan.md`; it makes the deploy and memory story concrete for the build and for the 2-minute video.

**Scope note (this version):** the hackathon build is **community-brain only**. The personal/DM brain and the promotion path described below are a faithful record of the whiteboard but are **deferred — see `docs/future.md`**. The rest (deploy paths, the community brain) is in scope.

## What the drawing shows

The **midwife** (host agent) has two outbound arrows:

1. **→ Server(s).** The midwife deploys the resources a villager needs to actually run — the compute/runtime side. This is the "hands" from the plan: sandboxed execution of the villager's scripts and stages.
2. **→ Slack.** The midwife redeploys the **villager bot into Slack** at two scopes:
   - **Workspace scope** — the villager exists as a bot identity in the Slack workspace.
   - **Channel scope** — it joins/creates its workflow channel, drawn as `#workflow_name` with `villager_A` living in it. (Channel naming still open — "workflow name channel, or whatever we end up naming these.")

So "birth" is not just writing a folder; it is (a) standing up the run resources on the server and (b) placing the villager's bot identity into Slack at both the workspace and the specific channel. The midwife owns both deploys.

## The two ways humans reach a villager

From the Slack side the drawing splits into two interaction paths, which map exactly to the plan's memory lattice:

- **Public path — `#workflow_name` → `villager_A` → Community Brain.** The group of humans with domain expertise (the specialists) interact with `villager_A` in its channel. Their corrections and approvals flow into the **community brain** (the room/channel-scoped pool). This is "learns in public": one person's fix becomes everyone's pattern.
- **Private path — `DM villager_A` → "me + villager brain" → (promote) → Community Brain.** A single human can DM the villager. That DM sees a private brain — drawn as "me + villager brain": the user's own private pool *plus* the villager's own knowledge — and never the other humans' DM pools. The curved arrow back up to the community brain is the **promotion** step: something learned privately can be explicitly promoted up into the community brain when the human chooses to share it.

The rule from the plan holds: **read up, promote up, never read down.** A DM turn can read its own private pool plus the community (and org) brain; a channel turn reads the community brain and never mounts anyone's DM pool; promotion is the only upward path and it is explicit and attributed.

"Domain" is noted at the top of the board — the humans in the channel bring domain expertise (whatever their field), and that expertise is what accretes into the community brain with attribution.

## How this maps to `plan.md`

- Server deploy + Slack deploy = the plan's **Architecture C** ("interpreted while learning, compiled when graduated") plus the birth act that ends with `conversations.create` and moving into the channel. The whiteboard makes explicit that the *bot identity* is deployed to Slack at workspace + channel scope, not just that a channel is created.
- Community brain = the plan's **room pool** (per-channel, keyed by channel ID).
- "me + villager brain" in DM = the plan's **DM pool** (private, per-user), read alongside the villager's own knowledge.
- The promote arrow = the plan's **promotion** ("share this with the team" copies a DM atom up into the room, attributed). Org pool sits above the community brain (named, not built for the hackathon).

## Open naming question

The channel is drawn as `#workflow_name`. Still deciding the convention — `#workflow_name`, `#<villager-name>`, or a room-first name. Decide before the video so on-screen channel names are consistent.

## Why it matters for the video

These two whiteboards are the clearest one-glance explanation of the system and should be reused as visuals in the 2-minute judge video (see `docs/video-plan.md`): board 1 (Create loop: humans ↔ midwife → villager → server/deploy, Memory) and board 2 (deploy paths + the two brains with the promotion arrow).
