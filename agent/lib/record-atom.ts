import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeText, summarizeText, type AtomKind } from "./memory.ts";

/**
 * Deterministic write side of the learning loop (ADR 0001 store stage, ADR 0003
 * substrate). Ported from the retired scripts/record-atom.mjs so the logic lives
 * in the app runtime where the memory store (Blob) is reachable. Pure over a
 * directory: the caller hydrates `memoryDir` from the store, calls this, then
 * pushes `changedFiles` back. Atom files use memory.ts frontmatter so the
 * canonical compiler (compileRoomMemory) can regenerate the full map at snapshot.
 *
 * Guards (so autonomous calls stay safe):
 *  - DEDUP: an active atom with the same kind and same normalized text -> no-op.
 *  - SUPERSESSION: `supersedes` marks the older atom superseded_by the new one;
 *    superseded atoms drop out of the active set and the index.
 */

export type RecordAtomInput = {
  kind: AtomKind;
  author: string;
  text: string;
  citation?: string | null;
  source?: string;
  themes?: string[];
  supersedes?: string | null;
};

export type RecordAtomResult = {
  status: "recorded" | "duplicate";
  id: string;
  changedFiles: string[];
};

function safeName(value: string, fallback: string): string {
  const safe = String(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/, "");
  return safe.length > 0 ? safe : fallback;
}

type LoadedAtom = {
  file: string;
  id: string;
  kind: string;
  author: string;
  supersededBy: string | null;
  body: string;
};

async function loadAtoms(atomsDir: string): Promise<LoadedAtom[]> {
  const files = (await readdir(atomsDir).catch(() => [])).filter((f) => f.endsWith(".md"));
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(atomsDir, file), "utf8");
      const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      const frontmatter = match ? match[1] : "";
      const body = normalizeText(match ? match[2] : raw);
      const scalars: Record<string, string> = {};
      for (const line of frontmatter.split("\n")) {
        const field = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
        if (field) scalars[field[1]] = field[2].trim();
      }
      return {
        file,
        id: scalars.id ?? file.replace(/\.md$/, ""),
        kind: scalars.kind ?? "finding",
        author: scalars.author ?? "unknown",
        supersededBy: scalars.superseded_by ?? null,
        body,
      };
    }),
  );
}

function buildIndex(active: LoadedAtom[]): string {
  if (active.length === 0) {
    return "# Research map\n\n0 atoms — the channel hasn't taught me anything yet.\n";
  }
  const rules = active.filter((a) => a.kind === "rule");
  const questions = active.filter((a) => a.kind === "question");
  const findings = active.filter((a) => a.kind === "finding");
  const out = [
    "# Research map",
    "",
    `${active.length} atoms — ${findings.length} findings, ${questions.length} open questions, ${rules.length} rules taught by the room.`,
    "",
    "_Live view of the active atoms; the midwife recompiles the full map (themes, graph) at snapshot._",
    "",
    "## How this room wants research done",
    "",
    rules.length ? rules.map((a) => `- ${summarizeText(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_",
    "",
    "## Open questions",
    "",
    questions.length ? questions.map((a) => `- ${summarizeText(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_",
    "",
  ];
  return out.join("\n");
}

export async function recordAtomInDir(
  memoryDir: string,
  input: RecordAtomInput,
): Promise<RecordAtomResult> {
  const atomsDir = join(memoryDir, "atoms");
  await mkdir(atomsDir, { recursive: true });

  const text = normalizeText(input.text);
  const kind = input.kind;
  const citation = input.citation ? normalizeText(input.citation) : null;
  const source = input.source ? safeName(input.source, "slack") : "slack";
  const themes = input.themes && input.themes.length
    ? input.themes.map((t) => safeName(t, "general")).filter(Boolean)
    : ["general"];

  const atoms = await loadAtoms(atomsDir);
  const active = atoms.filter((a) => !a.supersededBy);

  const dup = active.find((a) => a.kind === kind && a.body === text);
  if (dup) return { status: "duplicate", id: dup.id, changedFiles: [] };

  const now = new Date().toISOString();
  const id = `${kind}-${safeName(text, "atom")}-${createHash("sha256").update(`${text}|${now}`).digest("hex").slice(0, 6)}`;
  const changed: string[] = [];

  if (input.supersedes) {
    const target = atoms.find((a) => a.id === input.supersedes);
    if (!target) throw new Error(`supersedes: atom ${input.supersedes} not found`);
    const path = join(atomsDir, target.file);
    let content = await readFile(path, "utf8");
    content = content.replace(/^superseded_by:.*\n/m, "");
    content = content.replace(/^(---\n[\s\S]*?)(\n---)/m, `$1\nsuperseded_by: ${id}$2`);
    await writeFile(path, content, "utf8");
    changed.push(`atoms/${target.file}`);
  }

  const lines = ["---", `id: ${id}`, `kind: ${kind}`, `author: ${input.author}`, `source: ${source}`];
  if (citation) lines.push(`citation: ${citation}`);
  if (input.supersedes) lines.push(`supersedes: ${input.supersedes}`);
  lines.push(`created_at: ${now}`, "themes:");
  for (const theme of themes) lines.push(`  - ${theme}`);
  lines.push("---", "", text, "");
  await writeFile(join(atomsDir, `${id}.md`), lines.join("\n"), "utf8");
  changed.push(`atoms/${id}.md`);

  const updated = (await loadAtoms(atomsDir)).filter((a) => !a.supersededBy);
  await writeFile(join(memoryDir, "index.md"), buildIndex(updated), "utf8");
  changed.push("index.md");

  return { status: "recorded", id, changedFiles: changed };
}
