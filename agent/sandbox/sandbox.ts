import { defineSandbox } from "eve/sandbox";
import type { SandboxNetworkPolicy } from "eve/sandbox";

/**
 * Sandbox for the midwife. Two jobs:
 *
 * 1. Seed the village into /workspace. Everything under
 *    `agent/sandbox/workspace/**` mirrors 1:1 into the sandbox, so the villager
 *    folders and community brains live at `/workspace/village/...` at runtime.
 *    Git is still the source of truth — the midwife's commit tool writes changes
 *    back to this path (the sandbox is not durable).
 *
 * 2. Broker the Exa API key. Secrets never enter the sandbox: the firewall
 *    injects `x-api-key` for api.exa.ai via a per-domain transform, so a
 *    villager's `search.sh` calls Exa with no key in it. Brokering is a Vercel /
 *    microsandbox capability (Docker/just-bash only do allow-all/deny-all), and
 *    on Vercel the default backend IS the Vercel Sandbox — so we apply the
 *    policy only under VERCEL and let `search.sh` fall back to an EXA_API_KEY env
 *    var for local runs.
 */
export default defineSandbox({
  async onSession({ use }) {
    const sandbox = await use();

    const exaKey = process.env.EXA_API_KEY;
    if (process.env.VERCEL && exaKey) {
      const policy: SandboxNetworkPolicy = {
        allow: {
          "api.exa.ai": [{ transform: [{ headers: { "x-api-key": exaKey } }] }],
          "*": [],
        },
      };
      await sandbox.setNetworkPolicy(policy);
    }
  },
});
