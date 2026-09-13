/**
 * Maintain — the pure half of editing an existing villager's CODE (its
 * instructions.md, scripts, stages). Mirrors birth.ts: the update_villager tool
 * supplies the registry (read from main at a pinned sha) and does the git work;
 * this module validates and maps paths. Memory is never edited here — atoms
 * live in Blob (record_atom) and reach git via snapshot_memory (ADR 0003).
 */

import { VILLAGERS_ROOT } from "./birth.ts";
import type { VillagerRecord } from "./villages.ts";

export type MaintainFile = { path: string; content: string };

export type MaintainFiles = {
  /** Repo-relative files to commit. */
  files: { path: string; content: string }[];
  record: VillagerRecord;
  channelId: string;
};

/**
 * A path relative to the villager folder, normalized ("./a" -> "a"). Rejects
 * anything that could escape the folder or touch memory/.
 */
export function validateVillagerPath(path: string): string {
  const raw = path.trim();
  if (!raw) throw new Error("update_villager needs a non-empty path for every file.");
  if (raw.includes("\\")) throw new Error(`Path '${raw}' must use forward slashes.`);
  if (raw.startsWith("/")) throw new Error(`Path '${raw}' must be relative to the villager folder (no leading slash).`);
  const segments = raw.split("/");
  if (segments[0] === ".") segments.shift();
  if (segments.some((s) => s === "..")) throw new Error(`Path '${raw}' may not contain '..'.`);
  if (segments.some((s) => s === "" || s === ".")) throw new Error(`Path '${raw}' may not contain empty segments.`);
  if (segments[0] === "memory") {
    throw new Error(`Path '${raw}' is in memory/ — memory is managed by record_atom and snapshot_memory, not by code edits.`);
  }
  return segments.join("/");
}

/** Validate an edit and map its files to repo paths under the villager's folder. */
export function buildMaintainFiles(args: {
  registry: Record<string, VillagerRecord>;
  villagerSlug: string;
  files: MaintainFile[];
}): MaintainFiles {
  const { registry, villagerSlug, files } = args;
  const entry = Object.entries(registry).find(([, r]) => r.slug === villagerSlug);
  if (!entry) throw new Error(`Unknown villager '${villagerSlug}' — call list_villagers for the current slugs.`);
  const [channelId, record] = entry;
  if (files.length === 0) throw new Error("update_villager needs at least one file.");

  const seen = new Set<string>();
  const base = `${VILLAGERS_ROOT}/${villagerSlug}`;
  const out = files.map((f) => {
    const rel = validateVillagerPath(f.path);
    if (seen.has(rel)) throw new Error(`Path '${rel}' is listed twice.`);
    seen.add(rel);
    return { path: `${base}/${rel}`, content: f.content };
  });
  return { files: out, record, channelId };
}
