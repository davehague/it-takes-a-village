import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getMemoryStore } from "../lib/memory-store";
import { commitFilesToBranch } from "../lib/github-commit";
import { compileRoomMemory, readAtoms } from "../lib/memory";
import { VILLAGES } from "../lib/villages";

const slugs = new Set(Object.values(VILLAGES).map((v) => v.slug));

async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

/**
 * Snapshot a villager's live memory (from the store) to git — the public
 * "learn in public" record (ADR 0003). Runs Ren's canonical compiler so the
 * committed index/themes/graph match the atoms, then commits the folder to the
 * non-deploying GITHUB_MEMORY_BRANCH via the Git Data API.
 */
export default defineTool({
  description:
    "Snapshot a villager's learned memory (atoms) to git as the public record. Reads the live memory store, recompiles the canonical map, and commits the memory folder to the memory branch. Use when asked to make a villager's learning permanent/public.",
  inputSchema: z.object({
    villagerSlug: z
      .string()
      .min(1)
      .describe("The villager whose memory to snapshot, e.g. 'exa-researcher'."),
  }),
  label: { start: ({ villagerSlug }) => `Snapshot ${villagerSlug} memory to git` },
  async execute({ villagerSlug }) {
    if (!slugs.has(villagerSlug)) throw new Error(`Unknown villagerSlug '${villagerSlug}'`);
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set");
    const repo = process.env.GITHUB_REPO ?? "davehague/it-takes-a-village";
    const branch = process.env.GITHUB_MEMORY_BRANCH ?? "village-memory";

    const store = getMemoryStore();
    const dir = await mkdtemp(join(tmpdir(), "village-snap-"));
    try {
      await store.pull(villagerSlug, dir);
      // Canonical recompile: regenerate index/themes/graph from the atoms on disk.
      await compileRoomMemory(dir, []);

      const repoPrefix = `agent/sandbox/workspace/village/villagers/${villagerSlug}/memory/`;
      const files = await Promise.all(
        (await walk(dir)).map(async (rel) => ({
          path: repoPrefix + rel,
          content: await readFile(join(dir, rel), "utf8"),
        })),
      );
      if (files.length === 0) throw new Error(`No memory to snapshot for '${villagerSlug}'`);

      const atomCount = (await readAtoms(dir)).length;
      const result = await commitFilesToBranch({
        repo,
        branch,
        files,
        message: `memory: snapshot ${villagerSlug} (${atomCount} atoms)`,
        token,
      });
      return { ...result, fileCount: files.length, branch };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
