import { defineTool } from "eve/tools";
import { z } from "zod";
import { REGISTRY_PATH } from "../lib/birth";
import { getBranchHead } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { rosterFromRegistries } from "../lib/roster";
import { channelRef, lookupChannelName } from "../lib/slack-client";
import { MIDWIFE_CHANNELS, type VillagerRecord } from "../lib/villages";
import registry from "../../villages.json" with { type: "json" };

/**
 * The midwife's eyes on the village: every villager with its real Slack channel
 * (name + the `<#id|name>` link form), from the registry bundled into THIS
 * deployment (what routes right now) plus anything on main that hasn't
 * redeployed yet (status "deploying"). Replaces guessing channel names.
 */
export default defineTool({
  description:
    "List the villagers that live in the village: slug, name, emoji face, Slack channel (id, name, and a channelRef you can paste so Slack renders a clickable #channel link), folder, and status (live, or deploying if just born and the redeploy hasn't finished). Also lists the midwife's own channels. Call this whenever you need to say who exists or where they live — never guess channel names.",
  inputSchema: z.object({}),
  label: { start: () => "List villagers" },
  async execute() {
    const deployed = registry as Record<string, VillagerRecord>;

    // Best-effort peek at main so a just-born villager shows as "deploying".
    let onMain: Record<string, VillagerRecord> | null = null;
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      try {
        const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
        const branch = process.env.GITHUB_MAIN_BRANCH ?? "main";
        const headSha = await getBranchHead({ repo, branch, token });
        const raw = headSha ? await readFileFromBranch({ repo, branch: headSha, path: REGISTRY_PATH, token }) : null;
        if (raw) onMain = JSON.parse(raw) as Record<string, VillagerRecord>;
      } catch {
        onMain = null;
      }
    }

    const rows = rosterFromRegistries(deployed, onMain);
    const villagers = await Promise.all(
      rows.map(async (r) => {
        const channelName = await lookupChannelName(r.channelId);
        return { ...r, channelName, channelRef: channelRef(r.channelId, channelName) };
      }),
    );
    const midwifeChannels = await Promise.all(
      [...MIDWIFE_CHANNELS].map(async (channelId) => {
        const channelName = await lookupChannelName(channelId);
        return { channelId, channelName, channelRef: channelRef(channelId, channelName) };
      }),
    );

    return {
      villagers,
      midwifeChannels,
      note: "Refer to channels by channelRef so Slack renders the link. A 'deploying' villager answers in its channel once the redeploy finishes (~1–2 min after birth).",
    };
  },
});
