import { defineTool } from "eve/tools";
import { z } from "zod";
import { REGISTRY_PATH, VILLAGERS_ROOT } from "../lib/birth";
import { getBranchHead } from "../lib/github-commit";
import { readFileFromBranch } from "../lib/github-read";
import { validateVillagerPath } from "../lib/maintain";
import type { VillagerRecord } from "../lib/villages";

/**
 * Read a villager's file as it is on main right now. The sandbox copy of the
 * workspace is only as fresh as the last deploy, so between a commit and its
 * redeploy it is stale; edits must be read-modify-write against main.
 */
export default defineTool({
  description:
    "Read the current content of one of a villager's code files (instructions.md, a script, a stage file) straight from the main branch — the source of truth, fresher than your sandbox copy. Use before update_villager so an edit starts from the real current file. memory/ paths are refused (memory lives in the store).",
  inputSchema: z.object({
    villagerSlug: z.string().min(1).describe("The villager, e.g. 'greeter' (see list_villagers)."),
    path: z.string().min(1).describe("Path relative to the villager folder, e.g. 'instructions.md' or 'scripts/search.sh'."),
  }),
  label: { start: ({ villagerSlug, path }) => `Read ${villagerSlug}/${path}` },
  async execute({ villagerSlug, path }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set — cannot read from the repository.");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MAIN_BRANCH ?? "main";
    const rel = validateVillagerPath(path);

    const headSha = await getBranchHead({ repo, branch, token });
    if (!headSha) throw new Error(`Branch ${branch} not found in ${repo}.`);
    const rawRegistry = await readFileFromBranch({ repo, branch: headSha, path: REGISTRY_PATH, token });
    const registry = rawRegistry ? (JSON.parse(rawRegistry) as Record<string, VillagerRecord>) : {};
    if (!Object.values(registry).some((r) => r.slug === villagerSlug)) {
      throw new Error(`Unknown villager '${villagerSlug}' — call list_villagers for the current slugs.`);
    }

    const repoPath = `${VILLAGERS_ROOT}/${villagerSlug}/${rel}`;
    const content = await readFileFromBranch({ repo, branch: headSha, path: repoPath, token });
    if (content === null) throw new Error(`${villagerSlug}/${rel} does not exist on ${branch}.`);
    return { slug: villagerSlug, path: rel, branch, headSha, content };
  },
});
