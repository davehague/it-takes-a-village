# Eve verification results (Sep 12) — reconciling the plan's "Unverified, load-bearing" list

Verified against Eve **v0.54.3**, using the framework's own version-matched docs bundled at `node_modules/eve/docs/` (authoritative) plus the compiled package source. This is the "verify first" pass from `CLAUDE.md`. Several plan/CLAUDE.md assumptions change — read this before building.

## Toolchain reality

- **Eve requires Node >= 24.** The `~/.nvm/versions/node/v22.17.0/bin` pinned in `CLAUDE.md` cannot run Eve 0.54.3 (`eve` aborts: "requires Node.js >=24"). Use **`~/.nvm/versions/node/v24.3.0/bin`** (already installed). Update CLAUDE.md's Environment note.
- **`eve init` refuses a non-empty directory.** It also writes its own `CLAUDE.md`/`AGENTS.md`/`README.md` and runs `git init`. We merged the scaffold into the repo root by hand: kept our project `CLAUDE.md`, saved Eve's coding-agent guide to `docs/eve-build-guide.md`, merged `.gitignore` (kept `dm/` ignored), renamed the package. `npm install` done; `eve info` reports **Compile ready, 0 errors, 10 tools**; `tsc` passes.
- App layout: app root = repo root, agent root = `agent/`. Default scaffold model is `openai/gpt-5.6-luna-fast` (set the interview/birth model deliberately via `eve set` or `agent/agent.ts`).

## The five load-bearing unknowns — resolved

### 1. Sandbox persistence — MORE persistent than assumed, but NOT durable truth
The sandbox is **not** re-seeded from git every turn. It is keyed per durable session and `/workspace` writes persist across turns, reconnects, and app redeploys (Vercel resumes after a 30-min idle timeout; Docker keeps a long-lived container). **However** the docs explicitly warn it is not reliable long-term storage: if Vercel loses the persisted snapshot, Eve silently rebuilds the sandbox from the template and **runtime-written files are lost**. "Persist important artifacts outside the sandbox." Seeding is via `agent/sandbox/workspace/**` (requires the folder layout `agent/sandbox/sandbox.ts`), mirrored 1:1 into `/workspace` at template build; adding new folders on disk works and reaches new sessions.
- **Implication:** the plan's "folder in git is state, sandbox re-seeds" is directionally right but Eve does **not** sync sandbox writes back to git for us. The midwife's `commit` step must be a real tool that writes the villager folder back to the repo (git add/commit, or write via app-runtime code). Do not treat sandbox `/workspace` as the source of truth for a birthed villager.

### 2. Runtime loading of a folder's `instructions.md` — YES, low risk
Built-in tools `read_file`, `write_file`, `bash` run with `/workspace` as cwd. The agent can read any villager folder's `instructions.md` at runtime and use it as context, and can write files at runtime (persistence caveat as in #1). Authored code can also use `ctx.getSandbox()` → `readTextFile`/`writeTextFile`.

### 3. Sessions compact or grow — COMPACT, automatically (on by default)
Compaction is on by default and triggers near the context window (default `thresholdPercent: 0.9`); Eve summarizes older turns (shortening oversized tool results first). Manual controls exist (`POST /eve/v1/session/:id/compact`, clear, reset) and `compaction.requested/completed` stream events. System-role instructions stay outside history.
- **Implication:** for core scope we do **not** need to hand-roll "restart the session and re-inject from pools." That whole caution drops to a non-issue for the hackathon.
- **Session identity:** one durable session **per Slack thread** (anchored to the first agent post's ts, resumes on later mentions), not per channel and not per message. Sessions last 30 days. The correct→approve→rerun learning loop naturally lives in one thread = one session.

### 4. Tool approval gating from Slack — NATIVE for buttons; 👍-reaction is NOT native
`defineTool({ approval: always() | once() | never() | <policy> })`. The Slack adapter **renders HITL approvals as native buttons/select menus automatically** — "you get this for free on every channel." Who may approve can be gated with an `approval.response` policy against an allowlist of `slack:TEAM:USER` ids, plus channel-level `allowedConversations`/`allowedUsers`.
- **But a 👍 emoji reaction approving a pending tool call is NOT supported.** HITL is buttons/selects only. `reaction_added` reaches only the generic `onEvent(ctx, event)` raw handler. To make 👍 approve, we must build the bridge ourselves: subscribe to `reaction_added`, detect it on the approval message, look up the pending `requestId`, and call `ctx.respond(inputResponses)`. Small but real, and the `reactions:read` scope is undocumented (add it manually).
- **Decision needed:** keep the 👍 gesture (build the bridge) vs use the free native approval **button** on camera.

### 5. `conversations.create` / posting under the villager's own name — NOT native
Eve's Slack surface is conversational (mention/DM/thread/HITL/reset). Workspace administration is absent from the documented API:
- **Post as a custom username/icon** (`chat:write.customize`): not native. `SlackPostInput` has no `username`/`icon` fields. Requires the raw escape hatch `ctx.slack.request("chat.postMessage", { username, icon_emoji, ... })` and adding the `chat:write.customize` scope. This is how a villager "posts under its own name."
- **Create a channel at birth** (`conversations.create` / `channels:manage`): not native. Raw `ctx.slack.request(...)` escape hatch + manual scope.
- **Invite users** (`conversations.invite`): not native. Same escape hatch.
- All three are buildable via `ctx.slack.request(...)` / `callSlackApi(...)`, but self-built and unscoped by the docs.

## The showstopper: NO SOCKET MODE
Eve's Slack channel is **HTTP Events API only**. There is no Socket Mode, no `SLACK_APP_TOKEN`, nowhere in the docs or package. It requires a public Request URL (`https://<host>/eve/v1/slack`) subscribed to `app_mention` + `message.im`. CLAUDE.md and the plan both say "run in socket mode locally" — **that is not possible with Eve as-is.**
Options to reach Slack:
1. **Vercel Connect** (`connectSlackCredentials(...)`) — the documented, recommended path; forwards Slack events to the agent without copying secrets into the project. Best fit if we have Vercel access.
2. **Public tunnel** (ngrok / cloudflared) in front of local `eve dev`, set as the Slack Request URL.
3. **Deploy to Vercel** (`eve deploy`) and use the deployment URL as the Request URL.
Slack setup itself: `eve add channel/slack` scaffolds `agent/channels/slack.ts`.

## Scopes we actually need (superset of the docs + our escape-hatch needs)
Documented by Eve: `app_mentions:read`, `chat:write`, `im:history`, `im:write`, `channels:history`, `groups:history`, `files:read`, `files:write`. Add for our escape-hatch features (not named by Eve, add manually to the Slack app): `chat:write.customize` (villager identity), `channels:manage` (create channel), `channels:read`, `reactions:read` (👍 bridge), `users:read`. Event subscriptions: `app_mention`, `message.im`, and `reaction_added`.

## Memory
Built-in `fileMemory()` (from `eve/memory/file`): one small document per resolved scope, recalled before each turn and after compaction, maintained by `save_memory`/`remove_memory` tools. Storage: Vercel Blob (prod) or in-memory (local `eve dev` — **not durable locally**); custom backend possible. Scope is a free-form resolver `(ctx) => string | [tenant, principal] | null`. `byPrincipal` ships built-in (per-user / DM-shaped). **Community brain (per Slack channel) and personal brain (per user/DM) are both achievable as two independent slots**, but per-channel scoping has no ready-made helper — we write a resolver that reads the Slack channel id. Note: this file-memory model is a small recalled document, not the append-only atoms/themes wiki the plan describes; the atoms/themes pool is our own layer on top (markdown files in the sandbox/repo), not `fileMemory()`.

## Net effect on the build
New work the plan under-counted, now explicit: (a) Slack connectivity without socket mode (Connect or tunnel); (b) escape-hatch Slack helpers for custom-username post, channel-create, invite; (c) the `reaction_added` → approval bridge if we keep 👍; (d) git-writeback so a birthed/edited villager folder is durable (sandbox is not truth); (e) memory scope resolvers for the two brains. What got easier: compaction is free; runtime file reads are trivial; native approval buttons are free if we don't insist on 👍.

## Deploy & Slack — proven live (Sep 12, hello-world round-trip working)
- **Slack via Vercel Connect works and is the clean path.** `vercel connect create slack --connection-method slack-app --name it-takes-a-village --triggers` provisions a **managed** Slack app (no manifest, no manually-created Slack app), opens a browser to authorize a workspace, installs it, and registers the event trigger at `/eve/v1/slack`. `agent/channels/slack.ts` references it via `connectSlackCredentials("slack/it-takes-a-village")`. This replaces the plan's earlier "build a Slack app + set the Request URL" assumption.
- **`eve deploy` is broken (v0.54.3).** It force-appends `--non-interactive` to its bundled Vercel CLI (v50.9.6), which rejects the flag, so every `eve deploy` fails "after channel setup" regardless of the flags you pass. **Workaround: `vercel deploy --prod --yes`** with a current Vercel CLI — the project is already detected as an eve app (build `eve build`, output `.output`), so it deploys correctly. The connector's trigger destination is registered at connector-create time, so skipping eve's deploy wrapper loses nothing.
- **Model funding, resolved.** The AI Gateway **free tier 403s premium models**; a *budget* is only a spend cap, not funds. Adding **AI Gateway credits** (we added $10) unlocks premium OpenAI and Anthropic models. `AI_GATEWAY_API_KEY` is the env var the AI SDK reads (not `VERCEL_API_GATEWAY_KEY`); it must also be set in the Vercel project's Production env for the deployment. Free ($0) models (e.g. `inclusionai/ling-3.0-flash-fin-free`) work with no credits. Current model: `openai/gpt-5.6-luna-fast`.
- **Deployment protection:** the production deployment is not behind Vercel Authentication, so Slack webhooks reach `/eve/v1/slack` (GET returns an eve JSON 404; unsigned POST returns `401 unauthorized`, i.e. the route exists and enforces Slack signature verification). Live URL: `https://it-takes-a-village-orpin.vercel.app`.
