import { defineTool } from "eve/tools";
import { z } from "zod";
import { REGISTRY_PATH } from "../lib/birth";
import { commitFilesToBranch, getBranchHead } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { buildMaintainFiles } from "../lib/maintain";
import type { VillagerRecord } from "../lib/villages";

/**
 * Maintain an existing villager's code: write one or more files inside its
 * folder and land them in one commit on main (auto-redeploy), pinned to the
 * head sha the registry was read at — the same guard birth_villager uses.
 * Memory paths are refused (memory is Blob + snapshot_memory, ADR 0003).
 */
export default defineTool({
  description:
    "Update an existing villager's code — its instructions.md, scripts, or stage files — by writing full file contents into its folder and committing them to main in one commit, which redeploys the app (~1–2 min). Paths are relative to the villager folder (e.g. 'instructions.md', 'scripts/search.sh'); memory/ paths are refused. Call only after the human has confirmed the change you reflected back. A new shell script committed this way is not executable yet.",
  inputSchema: z.object({
    villagerSlug: z.string().min(1).describe("The villager to edit, e.g. 'greeter' (see list_villagers)."),
    files: z
      .array(
        z.object({
          path: z.string().min(1).describe("Path relative to the villager folder, e.g. 'instructions.md'."),
          content: z.string().describe("The complete new file content (full replacement, not a diff)."),
        }),
      )
      .min(1)
      .describe("Files to write. Each is a full replacement of that path."),
    summary: z.string().min(1).max(120).describe("One line for the commit message: what changed and why."),
  }),
  label: { start: ({ villagerSlug, files }) => `Update ${villagerSlug} (${files.length} file${files.length === 1 ? "" : "s"})` },
  async execute({ villagerSlug, files, summary }) {
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

    const built = buildMaintainFiles({ registry, villagerSlug, files });
    const paths = built.files.map((f) => f.path.slice(f.path.indexOf(`/${villagerSlug}/`) + villagerSlug.length + 2));
    const result = await commitFilesToBranch({
      repo,
      branch,
      files: built.files,
      message: `maintain: ${built.record.name} (${villagerSlug}) — ${summary.trim()}\n\nEdited by the midwife with a human's go-ahead. Files: ${paths.join(", ")}.`,
      token,
      expectedHeadSha: headSha,
    });

    return {
      ...result,
      slug: villagerSlug,
      name: built.record.name,
      channelId: built.channelId,
      files: paths,
      branch,
      note: `Committed to ${branch}; ${built.record.name} runs the new code after the production redeploy (~1–2 min).`,
    };
  },
});
