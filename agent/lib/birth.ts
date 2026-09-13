/**
 * Birth — the pure half of the birth pipeline (spec: docs/superpowers/specs/
 * 2026-09-13-birth-pipeline-design.md). Renders a prose-only villager's
 * instructions.md and the exact file set a birth commits. No I/O: the
 * birth_villager tool supplies the registry and the channel id and does the
 * Slack/GitHub work.
 *
 * Division of labour: the model (midwife) writes the prose that makes the
 * villager itself (intro, what it does, voice); this module appends the
 * canonical "How I learn" contract so every villager records atoms correctly.
 */

import { MIDWIFE_CHANNELS, type VillagerRecord } from "./villages.ts";

/** Repo-relative path of the registry data file (see agent/lib/villages.ts). */
export const REGISTRY_PATH = "villages.json";
/** Repo-relative root of villager folders. In the sandbox it is village/villagers. */
export const VILLAGERS_ROOT = "agent/sandbox/workspace/village/villagers";

export type BirthInput = {
  /** Display name, e.g. "Copywriter". */
  name: string;
  /** Slack emoji face in colon form, e.g. ":pencil:". */
  icon: string;
  /** Optional slug override; otherwise derived from name. */
  slug?: string;
  /** One paragraph: "I am **Copywriter** ✏️, a villager. I ...". */
  intro: string;
  /** Markdown body of the "What I do" section. */
  whatIDo: string;
  /** Optional short paragraph on tone, rendered as "How I sound". */
  voice?: string;
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ICON_RE = /^:[a-z0-9_+-]+:$/;

/** "Meeting Notes Bot!" -> "meeting-notes-bot". Throws when nothing survives. */
export function deriveSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Cannot derive a slug from name '${name}' — pass an explicit slug.`);
  return slug;
}

// Byte-identical for every villager except {{slug}}. Kept as lines so the
// fenced record_atom block needs no backtick escaping.
const LEARNING_SECTION_LINES = [
  "## How I learn",
  "",
  "I manage my own memory. After I answer, I look back at what the **humans** in this thread said and decide for myself whether they taught me something durable — a standing rule about how to do my job, a settled fact worth keeping, or an open question worth tracking. If so, I record it as a knowledge atom, then and there, with the teacher's name on it. No one needs to approve it; if I get it wrong, someone will correct me and that correction becomes a new atom.",
  "",
  "I record an atom with the `record_atom` tool — it persists the atom to my memory and updates my brain:",
  "",
  "```",
  'record_atom(villagerSlug: "{{slug}}", kind: "rule"|"finding"|"question", author: "<the human who said it>", text: "<the rule/fact/question, in one sentence>", citation?: "<url|doi>", supersedes?: "<atom-id>")',
  "```",
  "",
  "Rules for what I do and don't record:",
  "",
  "- **Only from humans.** I never record my own words as knowledge. My replies are not facts to learn from — only what a person in the channel tells me is. (A finding must carry a `citation` to a real source, never \"because I said so\".)",
  "- **Attribute by name.** I'm given a \"Speaker names in this thread\" list mapping Slack ids to readable names. I set `author` to the person's name, never the raw `U…` id.",
  "- **Only durable, general things.** A correction, a standing preference, a settled fact, a real open question. Not one-off small talk, not a question I just answered, not a restatement of something already in my brain.",
  "- **Don't repeat myself.** Before recording, I check my brain (given in my context). If the rule is already there, I don't add it again (the tool also refuses exact duplicates). \"Nothing here is worth saving\" is a perfectly normal outcome.",
  "- **Supersede, don't pile up.** If a human *changes* an existing rule, I record the new rule with `supersedes: <the old atom's id>` (ids appear in my brain), so my brain never holds two rules that contradict each other.",
  "",
  "I never rewrite my own instructions or scripts — only my memory. Changing what I *am* stays a deliberate act by a human and the midwife.",
  "",
  "## Rules I've been taught",
  "",
  "These live in my brain, not here — read my brain (provided in each turn's context) for the current list. It starts empty and grows as the channel teaches me; each rule records who taught it and when.",
];

/** The canonical learning contract for a villager (no trailing newline). */
export function learningSection(slug: string): string {
  return LEARNING_SECTION_LINES.join("\n").replaceAll("{{slug}}", slug);
}

/** Render a prose-only villager's instructions.md. */
export function renderInstructions(input: BirthInput, slug: string = input.slug ?? deriveSlug(input.name)): string {
  const parts = [`# ${input.name.trim()}`, "", input.intro.trim(), "", "## What I do", "", input.whatIDo.trim(), ""];
  if (input.voice && input.voice.trim()) parts.push("## How I sound", "", input.voice.trim(), "");
  parts.push(learningSection(slug));
  return parts.join("\n") + "\n";
}

/** The public snapshot of a brain that has not learned anything yet. */
export function emptyBrain(name: string): string {
  return `# ${name.trim()} — brain\n\nThis brain starts empty and grows as the channel teaches me. Live memory lives in the memory store (ADR 0003); this file is the public snapshot and is rewritten by \`snapshot_memory\`.\n`;
}
