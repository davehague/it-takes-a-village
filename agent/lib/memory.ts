import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The community brain for a research villager.
 *
 * Everything is markdown on disk, and the room only ever grows: each finding the
 * villager turns up, each question it cannot yet answer, and each rule the humans
 * teach it becomes one more atom file. `themes/`, `index.md` and `graph.json` are
 * derived from those atoms, so they are rewritten on every compile while the atoms
 * themselves are append-only.
 */

/**
 * What a research atom is. A `finding` is a sourced claim and should carry a
 * citation; a `question` is something the room wants chased down; a `rule` is how
 * these humans want research done — that is what a correction in the channel
 * becomes, and it is why the next run is better than the last.
 */
export type AtomKind = "finding" | "question" | "rule";

export type MemoryEntry = {
  id?: string;
  author?: string;
  source: string;
  text: string;
  createdAt?: string;
  themes?: string[];
  kind?: AtomKind;
  /** Where a finding came from: a URL, DOI, or arXiv id. Findings without one are hearsay. */
  citation?: string;
};

export type MemoryAtom = {
  id: string;
  author: string;
  source: string;
  createdAt: string;
  summary: string;
  evidence: string;
  themes: string[];
  tags: string[];
  kind: AtomKind;
  citation: string | null;
};

export type MemoryTheme = {
  name: string;
  summary: string;
  atoms: string[];
};

export type ProgressiveContext = {
  themes: Array<{ name: string; summary: string }>;
  atoms: Array<{
    id: string;
    author: string;
    source: string;
    summary: string;
    evidence: string;
    themes: string[];
    kind: AtomKind;
    citation: string | null;
  }>;
  graph: {
    nodes: Array<{ id: string; type: "theme" | "atom"; label: string }>;
    edges: Array<{ from: string; to: string; relation: "contains" | "related" }>;
  };
};

/** A research vocabulary. Themes stay small and always-loaded; atoms are the detail below them. */
const DEFAULT_THEME_KEYWORDS: Record<string, string[]> = {
  sources: ["citation", "cite", "doi", "arxiv", "preprint", "paper", "journal", "url"],
  findings: ["found", "shows", "result", "evidence", "measured", "reported", "data", "outperform", "improved", "higher", "lower", "degraded", "effect", "score"],
  methods: ["method", "benchmark", "dataset", "protocol", "sample", "replication", "ablation", "baseline"],
  open_questions: ["unclear", "unknown", "unanswered", "open question", "untested", "todo", "not sure"],
  contradictions: ["contradicts", "disagrees", "conflicting", "refutes", "disputed", "however", "fails to replicate"],
  terminology: ["means", "definition", "defined", "term", "acronym", "refers to", "jargon"],
  scope: ["only", "exclude", "include", "ignore", "since", "recent", "limit to", "out of scope"],
  quality: ["peer-reviewed", "retracted", "primary source", "secondary", "credible", "low quality", "blog post"],
};

const RULE_MARKERS = [
  "always",
  "never",
  "prefer",
  "don't",
  "do not",
  "must",
  "only",
  "ignore",
  "exclude",
  "stop",
  "instead of",
];

const QUESTION_MARKERS = ["open question", "unclear", "unknown", "we don't know", "need to check", "untested"];

/** Atom ids, theme names and kinds become filenames, and all of them can originate in Slack text. */
function toSafeName(value: string, fallback: string): string {
  const safe = value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);

  return safe.length > 0 ? safe : fallback;
}

function splitDocument(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: "", body: content.trim() };
  }

  return { frontmatter: match[1], body: match[2].trim() };
}

/** Handles the two shapes we write: `key: value` scalars and `key:` followed by `  - item` lists. */
function parseFrontmatter(frontmatter: string): {
  scalars: Record<string, string>;
  lists: Record<string, string[]>;
} {
  const scalars: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let openList: string | null = null;

  for (const line of frontmatter.split("\n")) {
    if (line.trim().length === 0) continue;

    const item = line.match(/^\s+-\s*(.*)$/);
    if (item && openList) {
      const value = item[1].trim();
      if (value.length > 0) lists[openList].push(value);
      continue;
    }

    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;

    const [, key, value] = field;
    if (value.trim().length > 0) {
      scalars[key] = value.trim();
      openList = null;
    } else {
      openList = key;
      lists[key] = [];
    }
  }

  return { scalars, lists };
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function summarizeText(text: string): string {
  const clean = normalizeText(text);
  if (clean.length <= 200) {
    return clean;
  }

  return `${clean.slice(0, 197).trimEnd()}...`;
}

export function inferThemes(text: string): string[] {
  const lowered = text.toLowerCase();
  const matches = Object.entries(DEFAULT_THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => lowered.includes(keyword)))
    .map(([theme]) => theme);

  return matches.length > 0 ? matches : ["general"];
}

/** A stopgap until the midwife's maintainer classifies atoms with a model. */
export function inferKind(text: string): AtomKind {
  const lowered = normalizeText(text).toLowerCase();
  if (lowered.endsWith("?") || QUESTION_MARKERS.some((marker) => lowered.includes(marker))) {
    return "question";
  }
  if (RULE_MARKERS.some((marker) => lowered.includes(marker))) {
    return "rule";
  }
  return "finding";
}

export function createAtom(entry: MemoryEntry): MemoryAtom {
  const fallbackId = `atom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const id = toSafeName(entry.id ?? fallbackId, fallbackId);
  const createdAt = entry.createdAt ?? new Date().toISOString();
  const evidence = normalizeText(entry.text);
  const explicit = (entry.themes ?? []).map((theme) => toSafeName(theme, "general"));
  const themes = explicit.length > 0 ? explicit : inferThemes(evidence);
  const citation = entry.citation ? normalizeText(entry.citation) : null;

  return {
    id,
    author: entry.author ?? "unknown",
    source: entry.source,
    createdAt,
    summary: summarizeText(evidence),
    evidence,
    themes,
    tags: themes,
    kind: entry.kind ?? inferKind(evidence),
    citation,
  };
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, content, "utf8");
  }
}

/** Creates the room layout without touching anything already there — atoms are append-only. */
export async function ensureRoomStructure(roomPath: string): Promise<void> {
  await mkdir(join(roomPath, "raw"), { recursive: true });
  await mkdir(join(roomPath, "atoms"), { recursive: true });
  await mkdir(join(roomPath, "themes"), { recursive: true });

  await writeIfMissing(
    join(roomPath, "index.md"),
    "# Room memory\n\nThis file is generated by the memory compiler.\n",
  );

  await writeIfMissing(join(roomPath, "graph.json"), `${JSON.stringify({ nodes: [], edges: [] }, null, 2)}\n`);
}

async function writeAtomFile(atomPath: string, atom: MemoryAtom): Promise<void> {
  const themes = atom.themes.length > 0 ? atom.themes : ["general"];
  const themeLines = themes.map((theme) => `  - ${theme}`).join("\n");
  const citationLine = atom.citation ? `citation: ${atom.citation}\n` : "";
  const content = `---\nid: ${atom.id}\nkind: ${atom.kind}\nauthor: ${atom.author}\nsource: ${atom.source}\n${citationLine}created_at: ${atom.createdAt}\nthemes:\n${themeLines}\n---\n\n${atom.evidence}\n`;
  await writeFile(atomPath, content, "utf8");
}

function atomLine(atom: MemoryAtom): string {
  const cite = atom.citation ? ` — ${atom.citation}` : "";
  return `- **${atom.kind}** \`${atom.id}\` (${atom.author}): ${atom.summary}${cite}`;
}

async function writeThemeFile(themePath: string, themeName: string, atoms: MemoryAtom[]): Promise<void> {
  const counts = countKinds(atoms);
  const summary = `${themeName} — ${atoms.length} atom${atoms.length === 1 ? "" : "s"} (${counts.finding} findings, ${counts.question} questions, ${counts.rule} rules)`;

  const content = `---\ntheme: ${themeName}\nsummary: ${summary}\natoms:\n${atoms
    .map((atom) => `  - ${atom.id}`)
    .join("\n")}\n---\n\n${atoms.map(atomLine).join("\n")}\n`;

  await writeFile(themePath, content, "utf8");
}

function countKinds(atoms: MemoryAtom[]): Record<AtomKind, number> {
  const counts: Record<AtomKind, number> = { finding: 0, question: 0, rule: 0 };
  for (const atom of atoms) counts[atom.kind] += 1;
  return counts;
}

/** Reads the atoms already in a room. The atom files are the source of truth. */
export async function readAtoms(roomPath: string): Promise<MemoryAtom[]> {
  const atomDir = join(roomPath, "atoms");
  const files = (await readdir(atomDir).catch(() => [])).filter((file) => file.endsWith(".md"));

  const atoms = await Promise.all(
    files.map(async (file): Promise<MemoryAtom | null> => {
      const content = await readFile(join(atomDir, file), "utf8").catch(() => "");
      const { frontmatter, body } = splitDocument(content);
      const evidence = normalizeText(body);
      if (evidence.length === 0) return null;

      const { scalars, lists } = parseFrontmatter(frontmatter);
      // An atom a newer one superseded is no longer active — drop it so the
      // canonical compile matches the villager's live index (record-atom marks
      // the old atom `superseded_by: <newid>`; see agent/lib/record-atom.ts).
      if (scalars.superseded_by) return null;
      const themes = lists.themes?.length ? lists.themes : inferThemes(evidence);
      const kind = scalars.kind as AtomKind | undefined;

      return {
        id: scalars.id ?? file.replace(/\.md$/, ""),
        author: scalars.author ?? "unknown",
        source: scalars.source ?? "unknown",
        createdAt: scalars.created_at ?? new Date(0).toISOString(),
        summary: summarizeText(evidence),
        evidence,
        themes,
        tags: themes,
        kind: kind === "finding" || kind === "question" || kind === "rule" ? kind : inferKind(evidence),
        citation: scalars.citation ?? null,
      };
    }),
  );

  return atoms
    .filter((atom): atom is MemoryAtom => atom !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * Compiles `entries` into the room. Atoms already on disk survive — research
 * accumulates, so a new finding never displaces an older one. `themes/`,
 * `index.md` and `graph.json` are regenerated from the full set.
 */
export async function compileRoomMemory(roomPath: string, entries: MemoryEntry[]): Promise<MemoryTheme[]> {
  await ensureRoomStructure(roomPath);

  const incoming = entries.map(createAtom);
  const byId = new Map<string, MemoryAtom>();
  for (const atom of await readAtoms(roomPath)) byId.set(atom.id, atom);
  for (const atom of incoming) byId.set(atom.id, atom);

  const atoms = [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );

  for (const atom of incoming) {
    await writeAtomFile(join(roomPath, "atoms", `${atom.id}.md`), atom);
  }

  const themeMap = new Map<string, MemoryAtom[]>();
  for (const atom of atoms) {
    for (const theme of atom.themes) {
      const existing = themeMap.get(theme) ?? [];
      existing.push(atom);
      themeMap.set(theme, existing);
    }
  }

  const themeEntries: MemoryTheme[] = [];
  const themeDir = join(roomPath, "themes");
  const written = new Set<string>();

  for (const [themeName, themeAtoms] of [...themeMap].sort(([a], [b]) => a.localeCompare(b))) {
    const counts = countKinds(themeAtoms);
    themeEntries.push({
      name: themeName,
      summary: `${themeAtoms.length} atom${themeAtoms.length === 1 ? "" : "s"} — ${counts.finding} findings, ${counts.question} questions, ${counts.rule} rules`,
      atoms: themeAtoms.map((atom) => atom.id),
    });

    const fileName = `${toSafeName(themeName, "general")}.md`;
    written.add(fileName);
    await writeThemeFile(join(themeDir, fileName), themeName, themeAtoms);
  }

  // Themes are derived, so a theme no atom claims any more is stale and must not linger.
  const stale = (await readdir(themeDir).catch(() => [])).filter(
    (file) => file.endsWith(".md") && !written.has(file),
  );
  for (const file of stale) {
    await rm(join(themeDir, file), { force: true });
  }

  const graph = {
    nodes: [
      ...themeEntries.map((theme) => ({ id: `theme:${theme.name}`, type: "theme" as const, label: theme.name })),
      ...atoms.map((atom) => ({ id: `atom:${atom.id}`, type: "atom" as const, label: atom.summary })),
    ],
    edges: atoms.flatMap((atom) =>
      atom.themes.map((themeName) => ({
        from: `theme:${themeName}`,
        to: `atom:${atom.id}`,
        relation: "contains" as const,
      })),
    ),
  };

  const counts = countKinds(atoms);
  const open = atoms.filter((atom) => atom.kind === "question");
  const rules = atoms.filter((atom) => atom.kind === "rule");
  const uncited = atoms.filter((atom) => atom.kind === "finding" && atom.citation === null);

  const indexLines = [
    "# Research map",
    "",
    `${atoms.length} atoms — ${counts.finding} findings, ${counts.question} open questions, ${counts.rule} rules taught by the room.`,
    "",
  ];

  if (rules.length > 0) {
    indexLines.push("## How this room wants research done", "");
    for (const atom of rules) indexLines.push(`- ${atom.summary} — *${atom.author}*`);
    indexLines.push("");
  }

  if (open.length > 0) {
    indexLines.push("## Open questions", "");
    for (const atom of open) indexLines.push(`- ${atom.summary} — *${atom.author}*`);
    indexLines.push("");
  }

  indexLines.push("## Themes", "");
  for (const theme of themeEntries) {
    indexLines.push(`### ${theme.name}`);
    indexLines.push(`- ${theme.summary}`);
    indexLines.push(`- atoms: ${theme.atoms.join(", ")}`);
    indexLines.push("");
  }

  if (uncited.length > 0) {
    indexLines.push("## Findings still missing a citation", "");
    for (const atom of uncited) indexLines.push(`- \`${atom.id}\`: ${atom.summary}`);
    indexLines.push("");
  }

  await writeFile(join(roomPath, "index.md"), indexLines.join("\n"), "utf8");
  await writeFile(join(roomPath, "graph.json"), `${JSON.stringify(graph, null, 2)}\n`, "utf8");

  return themeEntries;
}

/**
 * Adds one atom as research develops and rebuilds the derived files around it.
 * This is the call a villager's run step makes per finding, and the call the
 * learning loop makes when a human's correction is confirmed as a rule.
 */
export async function recordAtom(roomPath: string, entry: MemoryEntry): Promise<MemoryAtom> {
  const atom = createAtom(entry);
  await compileRoomMemory(roomPath, [{ ...entry, id: atom.id, createdAt: atom.createdAt }]);
  return atom;
}

/**
 * Appends a raw research trace — a search's results, a run's output — to a
 * dated, append-only file under `raw/`. Nothing here is ever edited or
 * summarized in place: it is the evidence trail an atom points back to.
 */
export async function appendRawTrace(roomPath: string, label: string, text: string): Promise<string> {
  await ensureRoomStructure(roomPath);

  const day = new Date().toISOString().slice(0, 10);
  const path = join(roomPath, "raw", `${day}.md`);
  const stamp = new Date().toISOString();

  await appendFile(path, `\n## ${stamp} — ${normalizeText(label)}\n\n${text.trim()}\n`, "utf8");
  return path;
}

function queryTerms(query: string): string[] {
  return normalizeText(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}

function scoreText(text: string, terms: string[]): number {
  const lowered = text.toLowerCase();
  return terms.filter((term) => lowered.includes(term)).length;
}

/**
 * Layer 1 is the generated theme list, layer 2 atom summaries, layer 3 the exact
 * evidence and its citation. Themes are ranked by the atoms that claim them, not
 * by their filename. Rules always come back regardless of the query — how the room
 * wants research done applies to every run, not just a matching one.
 */
export async function buildProgressiveContext(
  roomPath: string,
  query: string,
  options: { limitThemes?: number; limitAtoms?: number } = {},
): Promise<ProgressiveContext> {
  const limitThemes = options.limitThemes ?? 5;
  const limitAtoms = options.limitAtoms ?? 5;
  const terms = queryTerms(query);

  const atoms = await readAtoms(roomPath);

  const graphRaw = await readFile(join(roomPath, "graph.json"), "utf8").catch(() => "");
  let graph: ProgressiveContext["graph"] = { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(graphRaw);
    if (Array.isArray(parsed?.nodes) && Array.isArray(parsed?.edges)) graph = parsed;
  } catch {
    // A malformed or missing graph is recoverable — recompiling the room regenerates it.
  }

  const atomScores = new Map<string, number>();
  for (const atom of atoms) {
    const score =
      scoreText(atom.evidence, terms) * 2 +
      atom.themes.reduce((total, theme) => total + scoreText(theme, terms), 0) +
      (atom.citation ? scoreText(atom.citation, terms) : 0);
    atomScores.set(atom.id, score);
  }

  const themeDir = join(roomPath, "themes");
  const themeFiles = (await readdir(themeDir).catch(() => [])).filter((file) => file.endsWith(".md"));

  const themeDocs = await Promise.all(
    themeFiles.map(async (file) => {
      const content = await readFile(join(themeDir, file), "utf8").catch(() => "");
      const { scalars } = parseFrontmatter(splitDocument(content).frontmatter);
      const name = scalars.theme ?? file.replace(/\.md$/, "");
      const claimed = atoms.filter((atom) => atom.themes.includes(name));
      const score =
        scoreText(name, terms) * 2 +
        claimed.reduce((total, atom) => total + (atomScores.get(atom.id) ?? 0), 0);

      return { name, summary: scalars.summary ?? `${name} (${claimed.length} atoms)`, score };
    }),
  );

  const themes = themeDocs
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limitThemes)
    .map(({ name, summary }) => ({ name, summary }));

  const project = (atom: MemoryAtom) => ({
    id: atom.id,
    author: atom.author,
    source: atom.source,
    summary: atom.summary,
    evidence: atom.evidence,
    themes: atom.themes,
    kind: atom.kind,
    citation: atom.citation,
  });

  const rules = atoms.filter((atom) => atom.kind === "rule");
  const ruleIds = new Set(rules.map((atom) => atom.id));

  const ranked = atoms
    .filter((atom) => !ruleIds.has(atom.id))
    .sort(
      (a, b) =>
        (atomScores.get(b.id) ?? 0) - (atomScores.get(a.id) ?? 0) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limitAtoms)
    .map(project);

  return { themes, atoms: [...rules.map(project), ...ranked], graph };
}

/**
 * Seeds a room shaped like the Exa Researcher's: sourced findings, an open
 * question, and the rules the humans in the channel taught it. Synthetic —
 * the one citation is the paper `docs/plan.md` already cites.
 */
export async function createExampleRoom(roomPath: string): Promise<void> {
  await ensureRoomStructure(roomPath);

  const entries: MemoryEntry[] = [
    {
      id: "atom-1",
      author: "ren",
      source: "exa",
      kind: "finding",
      citation: "arXiv:2608.27454",
      createdAt: "2026-09-12T18:00:00.000Z",
      text: "Skills evolved against a 4B model improved a 9B model without retraining, which is evidence that the maintained text carries the capability rather than the weights.",
    },
    {
      id: "atom-2",
      author: "david",
      source: "slack",
      kind: "rule",
      createdAt: "2026-09-12T18:05:00.000Z",
      text: "Prefer primary sources: a blog post summarizing a paper is not the paper. Cite the paper or say you could not reach it.",
    },
    {
      id: "atom-3",
      author: "ren",
      source: "slack",
      kind: "rule",
      createdAt: "2026-09-12T18:10:00.000Z",
      text: "Only include work from the last 24 months unless it is foundational to the question, and say which it is.",
    },
    {
      id: "atom-4",
      author: "david",
      source: "slack",
      kind: "question",
      createdAt: "2026-09-12T18:15:00.000Z",
      text: "Open question: does the cross-model transfer result hold when the harness changes too, not just the model? Untested as far as we can tell.",
    },
    {
      id: "atom-5",
      author: "ren",
      source: "exa",
      kind: "finding",
      createdAt: "2026-09-12T18:20:00.000Z",
      text: "Giving the executing agent write access to its own wiki during evolution degraded final skill quality, so execution and maintenance were kept as separate roles.",
      citation: "arXiv:2608.27454",
    },
  ];

  await compileRoomMemory(roomPath, entries);
  await appendRawTrace(
    roomPath,
    "seed trace — how this room was started",
    "Seeded by `agent/lib/memory-demo.ts`. Real traces land here as the villager searches: the query, the results it kept, and the run output an atom points back to. Append-only.",
  );
}
