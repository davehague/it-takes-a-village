// agent/tools/birth_villager.ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildBirthFiles, REGISTRY_PATH } from "../lib/birth";
import { commitFilesToBranch } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { resolveChannelId } from "../lib/slack-client";
import type { VillagerRecord } from "../lib/villages";

/**
 * Birth a prose-only villager: resolve its channel, read the CURRENT registry
 * from main, build the folder + registry files, and land them in one commit on
 * main (spec: docs/superpowers/specs/2026-09-13-birth-pipeline-design.md).
 * main auto-redeploys, so the villager answers in its channel after ~1–2 min.
 * Memory needs no setup — Blob memory is created on the first record_atom.
 */
export default defineTool({
  description:
    "Birth a new prose-only villager into a Slack channel a human has already created. Commits the villager folder (instructions.md + empty memory) and its registry entry to main in one commit, which redeploys the app; the villager answers in its channel after the redeploy (~1–2 min). Call only after the human has confirmed your reflected summary. You write the prose (intro, whatIDo, voice); the tool appends the standard learning contract.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Display name, e.g. 'Copywriter'."),
    icon: z.string().min(1).describe("Slack emoji face in colon form, e.g. ':pencil:'."),
    channel: z
      .string()
      .min(1)
      .describe("The pre-created Slack channel: '#village-copywriter' or a channel id like C0123ABCD."),
    intro: z
      .string()
      .min(1)
      .describe("One paragraph in the villager's voice: 'I am **Copywriter** ✏️, a villager. I ...'."),
    whatIDo: z
      .string()
      .min(1)
      .describe("Markdown body of the 'What I do' section — what happens when someone tags it, step by step."),
    voice: z.string().optional().describe("Optional short paragraph on tone, rendered as 'How I sound'."),
    slug: z
      .string()
      .optional()
      .describe("Optional folder slug (lowercase-dashed). Defaults to one derived from the name."),
  }),
  label: { start: ({ name, channel }) => `Birth ${name} into ${channel}` },
  async execute({ name, icon, channel, intro, whatIDo, voice, slug }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set — the midwife cannot commit a birth.");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MAIN_BRANCH ?? "main";

    const { id: channelId, name: channelName } = await resolveChannelId(channel);

    const raw = await readFileFromBranch({ repo, branch, path: REGISTRY_PATH, token });
    if (raw === null) {
      throw new Error(`Registry ${REGISTRY_PATH} not found on ${branch} — refusing to birth without it.`);
    }
    let registry: Record<string, VillagerRecord>;
    try {
      registry = JSON.parse(raw) as Record<string, VillagerRecord>;
    } catch (e) {
      throw new Error(`Registry ${REGISTRY_PATH} on ${branch} is not valid JSON: ${(e as Error).message}`);
    }

    const built = buildBirthFiles({ registry, channelId, input: { name, icon, intro, whatIDo, voice, slug } });

    const where = channelName ? `#${channelName}` : channelId;
    const result = await commitFilesToBranch({
      repo,
      branch,
      files: built.files,
      message: `birth: ${name} (${built.slug}) in ${where}\n\nBorn by the midwife from a Slack interview. Prose-only villager: instructions.md + empty memory + registry entry.`,
      token,
    });

    return {
      ...result,
      slug: built.slug,
      dir: built.dir,
      channelId,
      channelName,
      branch,
      fileCount: built.files.length,
      note: `Committed to ${branch}; the villager is live in ${where} after the production redeploy (~1–2 min).`,
    };
  },
});
