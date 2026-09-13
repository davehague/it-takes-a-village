import { defineTool } from "eve/tools";
import { z } from "zod";
import { REGISTRY_PATH } from "../lib/birth";
import { commitFilesToBranch, getBranchHead } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { buildMaintainFiles } from "../lib/maintain";
import type { VillagerRecord } from "../lib/villages";

/**
 * Maintain an existing villager: write files inside its folder and/or change
 * its registry entry (description, name, face), landing in one commit on main
 * (auto-redeploy), pinned to the head sha the registry was read at — the same
 * guard birth_villager uses. Memory paths are refused (ADR 0003).
 */
export default defineTool({
  description:
    "Update an existing villager: write full file contents into its folder (instructions.md, scripts, stage files — paths relative to the folder; memory/ refused) and/or change its registry entry (description, name, icon). One commit to main, which redeploys the app (~1–2 min). Read the current file with read_villager_file first, and call only after the human has confirmed the change you reflected back. A new shell script committed this way is not executable yet.",
  inputSchema: z.object({
    villagerSlug: z.string().min(1).describe("The villager to edit, e.g. 'greeter' (see list_villagers)."),
    files: z
      .array(
        z.object({
          path: z.string().min(1).describe("Path relative to the villager folder, e.g. 'instructions.md'."),
          content: z.string().describe("The complete new file content (full replacement, not a diff)."),
        }),
      )
      .optional()
      .describe("Files to write, each a full replacement of that path. Omit when only changing registry fields."),
    meta: z
      .object({
        description: z.string().max(200).optional().describe("One line, third person: what this villager does (shown by list_villagers)."),
        name: z.string().max(60).optional().describe("New display name."),
        icon: z.string().max(60).optional().describe("New Slack emoji face in colon form, e.g. ':wave:'."),
      })
      .optional()
      .describe("Registry fields to change. Omit when only writing files."),
    summary: z.string().min(1).max(120).describe("One line for the commit message: what changed and why."),
  }),
  label: {
    start: ({ villagerSlug, files }) => `Update ${villagerSlug}${files?.length ? ` (${files.length} file${files.length === 1 ? "" : "s"})` : ""}`,
  },
  async execute({ villagerSlug, files, meta, summary }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set — the midwife cannot commit a villager edit.");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MAIN_BRANCH ?? "main";

    // Pin to one snapshot of the branch (see birth_villager): read the registry
    // at this sha and require the same sha as the commit's parent.
    const headSha = await getBranchHead({ repo, branch, token });
    if (!headSha) throw new Error(`Branch ${branch} not found in ${repo}.`);
    const raw = await readFileFromBranch({ repo, branch: headSha, path: REGISTRY_PATH, token });
    if (raw === null) throw new Error(`Registry ${REGISTRY_PATH} not found on ${branch} — refusing to edit without it.`);
    let registry: Record<string, VillagerRecord>;
    try {
      registry = JSON.parse(raw) as Record<string, VillagerRecord>;
    } catch (e) {
      throw new Error(`Registry ${REGISTRY_PATH} on ${branch} is not valid JSON: ${(e as Error).message}`);
    }

    const built = buildMaintainFiles({ registry, villagerSlug, files, meta });
    const what = [...built.written, ...(built.registryChanged ? ["registry entry"] : [])].join(", ");
    const result = await commitFilesToBranch({
      repo,
      branch,
      files: built.files,
      message: `maintain: ${built.record.name} (${villagerSlug}) — ${summary.trim()}\n\nEdited by the midwife with a human's go-ahead. Changed: ${what}.`,
      token,
      expectedHeadSha: headSha,
    });

    return {
      ...result,
      slug: villagerSlug,
      name: built.record.name,
      channelId: built.channelId,
      files: built.written,
      registryChanged: built.registryChanged,
      branch,
      note: `Committed to ${branch}; ${built.record.name} runs the new code after the production redeploy (~1–2 min).`,
    };
  },
});
