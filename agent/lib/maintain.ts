/**
 * Maintain — the pure half of editing an existing villager (its CODE: the
 * instructions.md, scripts, stages — and its registry entry: description, name,
 * face). Mirrors birth.ts: the update_villager tool supplies the registry (read
 * from main at a pinned sha) and does the git work; this module validates and
 * maps paths. Memory is never edited here — atoms live in Blob (record_atom)
 * and reach git via snapshot_memory (ADR 0003).
 */

import { ICON_RE, REGISTRY_PATH, VILLAGERS_ROOT } from "./birth.ts";
import type { VillagerRecord } from "./villages.ts";

export type MaintainFile = { path: string; content: string };

/** Registry fields the midwife may change without touching the folder. */
export type MaintainMeta = { description?: string; name?: string; icon?: string };

export type MaintainFiles = {
  /** Repo-relative files to commit (folder files, then villages.json if meta changed). */
  files: { path: string; content: string }[];
  /** The registry entry AFTER the edit. */
  record: VillagerRecord;
  channelId: string;
  /** Folder-relative paths that were written (excludes the registry). */
  written: string[];
  registryChanged: boolean;
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

function applyMeta(record: VillagerRecord, meta: MaintainMeta): { record: VillagerRecord; changed: boolean } {
  const next: VillagerRecord = { ...record };
  let changed = false;
  if (meta.description !== undefined) {
    const d = meta.description.trim();
    if (!d) throw new Error("A villager's description can't be empty.");
    if (d !== record.description) (next.description = d), (changed = true);
  }
  if (meta.name !== undefined) {
    const n = meta.name.trim();
    if (!n) throw new Error("A villager's name can't be empty.");
    if (n !== record.name) (next.name = n), (changed = true);
  }
  if (meta.icon !== undefined) {
    const i = meta.icon.trim();
    if (!ICON_RE.test(i)) throw new Error(`Icon '${i}' must be a Slack emoji in colon form, e.g. ':pencil:'.`);
    if (i !== record.icon) (next.icon = i), (changed = true);
  }
  return { record: next, changed };
}

/** Validate an edit and map its files to repo paths under the villager's folder. */
export function buildMaintainFiles(args: {
  registry: Record<string, VillagerRecord>;
  villagerSlug: string;
  files?: MaintainFile[];
  meta?: MaintainMeta;
}): MaintainFiles {
  const { registry, villagerSlug, files = [], meta = {} } = args;
  const entry = Object.entries(registry).find(([, r]) => r.slug === villagerSlug);
  if (!entry) throw new Error(`Unknown villager '${villagerSlug}' — call list_villagers for the current slugs.`);
  const [channelId, current] = entry;

  const { record, changed } = applyMeta(current, meta);
  if (files.length === 0 && !changed) {
    throw new Error("update_villager needs at least one file to write or a registry change (description, name, icon).");
  }

  const seen = new Set<string>();
  const base = `${VILLAGERS_ROOT}/${villagerSlug}`;
  const written: string[] = [];
  const out = files.map((f) => {
    const rel = validateVillagerPath(f.path);
    if (seen.has(rel)) throw new Error(`Path '${rel}' is listed twice.`);
    seen.add(rel);
    written.push(rel);
    return { path: `${base}/${rel}`, content: f.content };
  });
  if (changed) {
    const next: Record<string, VillagerRecord> = { ...registry, [channelId]: record };
    out.push({ path: REGISTRY_PATH, content: JSON.stringify(next, null, 2) + "\n" });
  }
  return { files: out, record, channelId, written, registryChanged: changed };
}
