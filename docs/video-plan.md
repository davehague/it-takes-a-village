# 2-minute video — considerations and prep

Living doc for the judge submission video (AI Tinkerers Columbus, "Agents, Everywhere", Sep 12 2026). The video *is* the submission. This is the "what we should think about" checklist; the beat-by-beat storyboard lives in `plan.md` under "Demo plan" and this doc builds on it rather than repeating it. Deadline: recorded by **3:30 PM**, submitted **3:30–4:00**, hard cutoff **5:00 PM EDT**.

## The one thing the video has to prove

Born in the channel, learns in public. Someone describes a workflow in Slack; minutes later a new teammate is born into its own channel — as a readable folder anyone can open, not a black box — does the work, gets corrected by someone in the channel, and the villager offers to save that correction as a knowledge atom; a human confirms and it becomes attributed knowledge the whole channel's villager carries. If a judge remembers one clip: a casual correction in a thread visibly teaches the agent, with the corrector's name on it. That is the thing a 1:1 chatbox cannot do.

## Judging-criteria mapping (say the rubric's words on camera)

- **Innovation & Theme ("Agents, Everywhere"):** "born in the channel, learns in public." A 1:1 chatbox can't reproduce multiplayer witnessing or a shared knowledge pool — that's the top-score language. Show birth happening *inside* the channel.
- **Usefulness:** a team creates a custom teammate by answering questions, and it gets better every time someone corrects it — no rebuild, no developer in the loop for each change.
- **Technical Execution:** the villager is a readable folder (show the files), deterministic scripts with exit codes, and the learning loop; git is the source of truth and the midwife commits.
- **Core Functionality:** the filmed loop is small and complete — interview → birth → run → correct → rerun.
- **Thoughtful failure handling:** the agent misses, a human corrects it in the thread, the fix is captured as a rule that passes the fixture before it counts.

## Shot list / capture plan

Capture more than we need; cut to 2:00. Rough allocation (see `plan.md` for exact timings):

1. **Birth by interview (~0:40).** Screen-record the Slack thread: a human describes the workflow, the midwife asks one question at a time, ends with "show me an example of the input" (seeds the fixture). Final beat: the midwife creates the workflow channel and announces itself under the villager's own name. *This is the money shot — get it clean.*
2. **Run → miss → correct → rerun (~1:00).** `@villager run` → wrong output → someone in the channel adds the missing rule in-thread → the villager proposes the rule → a human confirms with a plain "yes" → the rule is committed *with their name on it* → rerun passes the fixture and posts the right result. Show the rule/atom file getting written and committed if we can.
3. **It's a readable folder (~0:10).** Open the villager folder — instructions, a script, the new atom with the author's name. The legibility beat: you can read and edit your teammate.
4. **Graduation (~0:10, stretch).** `eve deploy` from the villager folder, Vercel Agent Runs dashboard as proof it's a real deployment. Only if built and time allows.

## Visuals to reuse (we already have them)

The two venue whiteboards are the clearest one-glance explanation — use them as cutaway diagrams over narration:

- **Board 1** (`docs/whiteboard/midwife-create-flow.jpg`): the Create loop — humans ↔ midwife → villager → server/deploy, with Memory.
- **Board 2** (`docs/whiteboard/deploy-and-brains.jpg`): deploy paths (midwife → server, midwife → Slack workspace + workflow channel) and the two brains (community brain vs personal brain in DM) with the promotion arrow. See `docs/architecture-deploy-and-brains.md`.

A 5-second animated redraw of board 2 to explain "learns in public + promotion" without narration eating time is a nice-to-have, not required.

## Narration / script notes

- Open cold on the birth — no title card longer than 2 seconds. Time is the enemy at 2:00.
- Name the mechanism once, plainly: "the channel is the village, the midwife delivers, the room parents."
- Land the attribution line: "the correction is now a rule in the folder, with their name on it." That's the shared-learning hook.
- Close on the thesis, not a feature: the villager is a portable folder you can read and edit, and the channel keeps teaching it.

## Technical capture notes

- **Screen recording:** clean Slack workspace, no unrelated channels/DMs visible, notifications silenced, browser zoom up so text is legible at video scale.
- **Multiple humans in the channel:** the point is multiplayer — show more than one person present, and have the correction come from a channel member. Coordinate who does the birth vs who corrects.
- **Have a fallback recording.** If the live loop misbehaves on camera, we still need a clean take — rehearse once, then record. Plan B (hand-written folder) still yields a video of the learning loop.
- **Audio:** narrate to a script; record voice separately if venue audio is noisy.
- **Length discipline:** if it's over 2:00, cut the graduation and personal-brain beats first; the birth + learning loop are non-negotiable.

## Privacy rules (hard — the video is public)

- Fictional names and synthetic data only. Nothing real or personally identifying.
- Scrub the Slack workspace of any real info before recording.

## Submission checklist (3:30–4:00 window)

- [ ] Public GitHub repo pushed (`github.com/davehague/it-takes-a-village`); README explains what's live vs pre-built.
- [ ] 2:00 video rendered and uploaded.
- [ ] Written description (maps to rubric; names the org-pool intent as the extension).
- [ ] Social post tagging partners.
- [ ] Say clearly which parts were pre-built (templates, script library, whiteboards) vs built live (midwife, run loop, learning loop) — the rules require core functionality built live.

## Open decisions before recording

- **The concrete demo workflow** (drives the script library and everything on screen) — still open in `plan.md`.
- Channel naming convention (`#workflow_name` vs `#<villager>` vs room-first) — must be consistent on screen.
- Whether the graduation beat makes the cut (depends on build progress by 3:00).
- Who narrates and whether voice is recorded live or dubbed.
