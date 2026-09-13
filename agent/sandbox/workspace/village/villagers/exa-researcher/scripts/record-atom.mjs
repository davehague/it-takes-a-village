#!/usr/bin/env node
//
// Record one knowledge atom into the villager's memory. Deterministic write side
// of the learning loop (see docs/adrs/0001-knowledge-ingestion-model.md).
//
// The villager runs this during its own turn when a HUMAN teaches it something
// durable. It never records the villager's own prose — the caller is responsible
// for the human-only filter; this script just writes what it is told, but it
// enforces two guards so autonomous calls stay safe:
//   - DEDUP: if an active atom with the same kind and same text already exists,
//     it is a no-op (so calling repeatedly never piles up duplicates).
//   - SUPERSESSION: --supersedes <id> marks the older atom superseded_by the new
//     one; superseded atoms drop out of index.md so rules never contradict.
//
// Atom files use the exact frontmatter of agent/lib/memory.ts, so the midwife's
// compileRoomMemory() can later regenerate the full index/themes/graph at commit.
//
// Usage:
//   record-atom.mjs --kind rule|finding|question --author "<name>" --text "<...>"
//                   [--citation "<url|doi|arxiv>"] [--source slack|exa] \
//                   [--themes a,b] [--supersedes <atom-id>]
// Env:
//   MEMORY_DIR   memory root (default: ../memory relative to this script)
// Exit: 0 on success or dedup no-op, 1 on a usage/validation error.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KINDS = new Set(["finding", "question", "rule"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = value;
      i += 1;
    }
  }
  return args;
}

function die(message) {
  process.stderr.write(`record-atom: ${message}\n`);
  process.exit(1);
}

const normalize = (text) => String(text).replace(/\s+/g, " ").trim();

function summarize(text) {
  const clean = normalize(text);
  return clean.length <= 200 ? clean : `${clean.slice(0, 197).trimEnd()}...`;
}

function safeName(value, fallback) {
  const safe = String(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/, "");
  return safe.length > 0 ? safe : fallback;
}

// Minimal frontmatter reader — we only need a few scalars plus the body.
function readAtom(path) {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const frontmatter = match ? match[1] : "";
  const body = normalize(match ? match[2] : raw);
  const scalars = {};
  for (const line of frontmatter.split("\n")) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (field) scalars[field[1]] = field[2].trim();
  }
  return { scalars, body };
}

function loadAtoms(atomsDir) {
  if (!existsSync(atomsDir)) return [];
  return readdirSync(atomsDir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { scalars, body } = readAtom(join(atomsDir, file));
      return {
        file,
        id: scalars.id ?? file.replace(/\.md$/, ""),
        kind: scalars.kind ?? "finding",
        author: scalars.author ?? "unknown",
        createdAt: scalars.created_at ?? "",
        supersededBy: scalars.superseded_by ?? null,
        body,
      };
    });
}

const args = parseArgs(process.argv.slice(2));
const kind = args.kind;
const author = args.author && args.author !== true ? String(args.author) : null;
const text = args.text && args.text !== true ? normalize(args.text) : null;
const citation = args.citation && args.citation !== true ? normalize(args.citation) : null;
const source = args.source && args.source !== true ? safeName(args.source, "slack") : "slack";
const themes = args.themes && args.themes !== true
  ? String(args.themes).split(",").map((t) => safeName(t, "general")).filter(Boolean)
  : ["general"];
const supersedes = args.supersedes && args.supersedes !== true ? String(args.supersedes) : null;

if (!kind || !KINDS.has(kind)) die(`--kind must be one of ${[...KINDS].join(", ")}`);
if (!author) die("--author is required (the human who taught this)");
if (!text) die("--text is required");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const memoryDir = process.env.MEMORY_DIR
  ? process.env.MEMORY_DIR
  : join(scriptDir, "..", "memory");
const atomsDir = join(memoryDir, "atoms");
mkdirSync(atomsDir, { recursive: true });

const atoms = loadAtoms(atomsDir);
const active = atoms.filter((a) => !a.supersededBy);

// DEDUP guard: identical active knowledge is a no-op, so repeated autonomous
// calls never accumulate duplicates.
const dup = active.find((a) => a.kind === kind && a.body === text);
if (dup) {
  process.stdout.write(`record-atom: already known (${dup.id}); nothing recorded\n`);
  process.exit(0);
}

const now = new Date().toISOString();
const id = `${kind}-${safeName(text, "atom")}-${createHash("sha256")
  .update(`${text}|${now}`)
  .digest("hex")
  .slice(0, 6)}`;

// SUPERSESSION: mark the older atom so it drops out of the active set / index.
if (supersedes) {
  const target = atoms.find((a) => a.id === supersedes);
  if (!target) die(`--supersedes ${supersedes} not found among existing atoms`);
  const targetPath = join(atomsDir, target.file);
  let content = readFileSync(targetPath, "utf8");
  content = content.replace(/^superseded_by:.*\n/m, "");
  content = content.replace(/^(---\n[\s\S]*?)(\n---)/m, `$1\nsuperseded_by: ${id}$2`);
  writeFileSync(targetPath, content, "utf8");
}

const lines = ["---", `id: ${id}`, `kind: ${kind}`, `author: ${author}`, `source: ${source}`];
if (citation) lines.push(`citation: ${citation}`);
if (supersedes) lines.push(`supersedes: ${supersedes}`);
lines.push(`created_at: ${now}`, "themes:");
for (const theme of themes) lines.push(`  - ${theme}`);
lines.push("---", "", text, "");
writeFileSync(join(atomsDir, `${id}.md`), lines.join("\n"), "utf8");

// Rebuild the sections the villager reads. This is a live, in-thread view of the
// ACTIVE atoms; the midwife's compileRoomMemory() regenerates the full index,
// themes and graph.json when it commits the folder to git.
const updated = loadAtoms(atomsDir).filter((a) => !a.supersededBy);
const rules = updated.filter((a) => a.kind === "rule");
const questions = updated.filter((a) => a.kind === "question");
const findings = updated.filter((a) => a.kind === "finding");

let index;
if (updated.length === 0) {
  index = `# Research map\n\n0 atoms — the channel hasn't taught me anything yet.\n`;
} else {
  const out = [
    "# Research map",
    "",
    `${updated.length} atoms — ${findings.length} findings, ${questions.length} open questions, ${rules.length} rules taught by the room.`,
    "",
    "_Live in-thread view of the active atoms; the midwife recompiles the full map (themes, graph) at commit._",
    "",
  ];
  out.push("## How this room wants research done", "");
  out.push(rules.length ? rules.map((a) => `- ${summarize(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_");
  out.push("", "## Open questions", "");
  out.push(questions.length ? questions.map((a) => `- ${summarize(a.body)} — *${a.author}*`).join("\n") : "_(none yet)_");
  out.push("");
  index = out.join("\n");
}
writeFileSync(join(memoryDir, "index.md"), index, "utf8");

process.stdout.write(
  `record-atom: saved ${id} (${kind}, by ${author})${supersedes ? ` superseding ${supersedes}` : ""}\n`,
);
