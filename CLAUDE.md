# It Takes a Village

An open-source pattern — with a working reference implementation — for **agents that are born, run, and taught in public**. A **midwife** agent lives in Slack, interviews a human about a workflow, and births a **villager** agent as a readable folder (instructions + deterministic scripts + fixture + wiki) into its own channel (the **village**). The villager learns in public: corrections from anyone in the channel become attributed knowledge atoms that the villager curates itself (no confirmation gate since the Sep 12 pivot — humans correct after the fact), must pass the fixture, and evolve the folder. Runtime is Vercel's Eve framework (agents as directories, sandbox, Slack channel). Born at the AI Tinkerers Columbus hackathon ("Agents, Everywhere", Sep 12–13 2026); now a living project.

**The thesis:** the knowledge is the asset and the runtime is interchangeable. A villager is a folder of markdown + CLI scripts a team can open, read, edit, and carry to any harness — not a black box. The channel is the product: multiple humans witness the agent work and correct it, so one person's fix becomes everyone's, recorded with their name on it.

**Status: running in production (state as of Sep 13 2026).** The full villager loop works live, including durable learning. `@villager <question>` in `#village-exa-researcher` returns one clean, Markdown-rendered, Exa-sourced brief; when a human teaches it a rule ("always include tokens/sec"), it records an attributed knowledge atom, and a **brand-new thread obeys that rule** — verified live Sep 13. Memory now persists to **Vercel Blob** (the live store) not just the thread sandbox, so it survives across threads and redeploys ([ADR 0003](docs/adrs/0003-memory-substrate-blob-live-git-snapshot.md)): the `record_atom` tool writes atoms to Blob, the read side injects the brain into each turn, and `snapshot_memory` commits the readable folder to a `village-memory` git branch as the public record. Ren's `rooms/` tree was collapsed into each villager's own `memory/` (one channel = one villager). One app (`@villager`) plays two roles by channel — midwife in `#villager-management`, first villager **Exa Researcher** 🔎 in `#village-exa-researcher`. Model `anthropic/claude-sonnet-5`. Reply = Option A (model's normal message, Eve renders Markdown), so run replies show the app name "villager"; the birth announcement introduces the per-villager name/face via `post_as_villager`. Acts only on explicit mention (anti-loop). Live: `https://it-takes-a-village-orpin.vercel.app`. **Births and edits land with no human in git (verified live Sep 13):** `birth_villager` (interview → template-filled, prose-only villager folder + a one-line `description` → registry entry in `villages.json` at the repo root → one commit to `main` pinned to the head sha it read the registry at, auto-redeploying), `update_villager` (full-file edits and/or registry `description`/`name`/`icon`, same pinned commit; `memory/` refused), `read_villager_file` (read a villager's code from `main`), and `list_villagers` (the live roster with real Slack channel refs and descriptions — the midwife never guesses channels). A throwaway Greeter was born, edited twice by the midwife, and retired the same day. Next build: script and fixture creation and validation at birth (with per-file executable mode), so a birthed villager gets deterministic scripts, not just instructions; then `retire_villager`.

**Read `docs/plan.md` first — it is the design doc (architecture + reasoning); `docs/status.md` is current state and open decisions; `docs/future.md` is the roadmap.** Whiteboard photos are in `docs/whiteboard/`; the deploy-and-brains board is written up in `docs/architecture-deploy-and-brains.md`. Eve framework verification is in `docs/eve-verification.md`. Decision records are in `docs/adrs/` (0001 = knowledge-ingestion model; 0002 = deferred thread-vs-channel scope; 0003 = memory substrate — Blob live + git snapshot).

Eve's authoring guidance for coding agents (how to build tools, channels, connections; read `node_modules/eve/docs` first) lives in `AGENTS.md`, imported here:

@AGENTS.md

## Team and tracking

David Hague and Ren, both developers using Claude. Work is split and tracked in **Linear** (MCP is connected in this folder). Commits go to `main` on github.com/davehague/it-takes-a-village (public). The repo, the demo channels, and the 2-minute origin video (`docs/video-plan.md`) are all public — so fictional names and synthetic data only in anything that ships.

## Roadmap

**Working today:** the full birth → run → learn → maintain loop in production, with no human touching git for births or edits, and durable cross-thread learning. See the Status paragraph above.

**Next up (in rough priority):**
- **Scripts and fixtures at birth.** Births are prose-only right now; a birthed villager should get deterministic scripts and a fixture, validated before commit. Needs per-file executable mode so committed scripts land runnable.
- **`retire_villager` tool.** De-birth is currently a manual cleanup (folder + registry key + Blob); make it a first-class midwife tool.
- **A Slack trigger for `snapshot_memory`.** The git public-record half is wired and proven but nothing calls it from Slack yet — a midwife maintenance command or a schedule.
- **Self-managed Slack app** so the midwife can auto-create the village channel (`channels:manage` is not grantable on the Vercel Connect managed app — see `docs/future.md`).
- **Brain visibility** (`atomCount` / a `read_memory` tool) so the midwife and humans can inspect what a villager has learned.

**Deferred / larger scope** (parked in `docs/future.md`): `eve deploy` graduation per villager; multi-stage villager folders; novel script generation; the DM/personal brain and promotion between pools; the org-wide brain; a read-only UI over the folders and brains.

## Hard rules

- Villagers never rewrite their own **code** (instructions/scripts) — the midwife (alloparent) owns birth, maintain, run_fixtures, commit for those. But a villager **does autonomously manage its own memory layer** (its atoms): as of the Sep 12 pivot there is **no human confirmation gate** on learning — the villager decides what to remember and writes attributed atoms itself; humans correct after the fact (a correction is just a superseding atom). Trust the model to curate memory; keep code changes deliberate.
- Determinism beats non-determinism: scripts do the work with exit codes; the model picks the script and parameters. Judgment steps only where output is prose.
- The villager folder stays ~90% harness-agnostic (markdown + CLI scripts + wiki); Eve-specific files (`agent.ts`, `tools/*.ts`, `channels/`, `connections/`) are a thin generated shim.
- Secrets never go in the folder or the repo. `.env` is gitignored. Private (DM) memory never lands in the public repo.
- Slack channel = memory scope + audience + approver allowlist. Shared pool keyed by channel ID.
- Markdown: no hard-wrapped prose; one paragraph per line.

## Environment

- Eve requires Node >=24 and the default `node` on PATH is a v22, which aborts ("requires Node.js >=24"). We each have a different v24 patch under nvm, so don't pin one: run `nvm use 24`, or in a non-interactive shell resolve it — `export PATH="$(ls -d ~/.nvm/versions/node/v24*/bin | tail -1):$PATH"` — before `node`, `npx`, `pnpm`.
- Funding the brain: the midwife's runtime model runs on **Vercel AI Gateway** (via `eve link`). Premium models (OpenAI/Anthropic) require **AI Gateway credits**, not just a budget — a budget is only a spend cap; without credits, premium models return `403 "Free tier users do not have access to this model"`. Free ($0) models work with no credits. Set Eve's spend guard either way. Exa search runs on an Exa API key brokered at the sandbox firewall (no key in the folder). (Hackathon-era note: the $50 OpenAI Codex credits are Codex *coding-tool* usage credits — usable to build, but not for API model calls, so they never powered the runtime brain.)
- Slack app scopes needed: `chat:write`, `chat:write.customize`, `channels:manage`, `channels:read`, `channels:history`, `reactions:read`, `app_mentions:read`, `users:read` (plus `im:history`, `im:write` for DMs). Eve's Slack channel is **HTTP Events API only — no socket mode**. We use **Vercel Connect** (`vercel connect create slack --connection-method slack-app --name it-takes-a-village --triggers`) — a managed Slack app (no manifest), authorized into a workspace, forwarding events to `/eve/v1/slack` on the Vercel deployment. The GitHub repo is connected to Vercel, so pushing to `main` auto-redeploys; manual deploy is `vercel deploy --prod` (the `eve deploy` wrapper is currently broken). See `docs/eve-verification.md`.
- Eve docs: https://vercel.com/docs/eve · https://vercel.com/docs/eve/concepts · https://eve.dev/docs · Slack starter: "Build your first Slack agent with eve" (vercel.com/kb). Eve is beta.

## Verification status

Most load-bearing unknowns are now verified against Eve v0.54.3 — see `docs/eve-verification.md`. Resolved: runtime `instructions.md` loading works (`read_file`); sessions compact automatically; tool approval gating is native as Slack buttons (but 👍-as-approval must be hand-built); `conversations.create` and posting under a custom villager name are NOT native (raw `ctx.slack.request` escape hatch). Design correction: git is the source of truth — the sandbox persists per session but is not durable, and Eve does not sync sandbox writes to git, so the midwife must commit villager folders explicitly. Still open: whether the Vercel plan supports Sandbox + Workflows for the graduation beat; how the midwife's runtime model is paid for — Vercel AI Gateway's included allowance vs. a real LLM API key (the $50 OpenAI credit is Codex-only and not usable for API model calls) — with Eve's spend guard set regardless.
