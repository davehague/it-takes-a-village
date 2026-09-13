import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getMemoryStore } from "../lib/memory-store";
import { recordAtomInDir } from "../lib/record-atom";
import { VILLAGES } from "../lib/villages";

const slugs = new Set(Object.values(VILLAGES).map((v) => v.slug));

/**
 * Record one knowledge atom into a villager's live memory (Vercel Blob in prod,
 * local fs in dev — ADR 0003). The villager calls this at end of turn when a
 * HUMAN taught it something durable. Dedup + supersession are enforced in
 * recordAtomInDir; the caller (framing/instructions) enforces human-only sourcing.
 */
export default defineTool({
  description:
    "Record ONE durable knowledge atom you learned from a HUMAN in this channel (a research rule, a settled fact/finding, or an open question). Never record your own words. Dedups exact repeats and supersedes an older atom when a human changes a rule. Recording nothing is normal.",
  inputSchema: z.object({
    villagerSlug: z
      .string()
      .min(1)
      .describe("This villager's folder slug, e.g. 'exa-researcher' (given in your framing)."),
    kind: z
      .enum(["rule", "finding", "question"])
      .describe("rule = how to research; finding = a sourced fact (needs citation); question = something to chase."),
    author: z
      .string()
      .min(1)
      .describe("The readable NAME of the human who taught this (from the Speaker names list), never a raw Slack id."),
    text: z.string().min(1).describe("The rule/fact/question in one clear sentence."),
    citation: z
      .string()
      .optional()
      .describe("For a finding: the URL/DOI/arXiv id it came from. Required for findings."),
    source: z
      .string()
      .optional()
      .describe("Where it came from: 'slack' (a human said it) or 'exa' (a cited web result). Default slack."),
    themes: z.array(z.string()).optional().describe("Optional theme tags, e.g. ['scope','sources']."),
    supersedes: z
      .string()
      .optional()
      .describe("The id of an existing atom this replaces, when a human changed a prior rule."),
  }),
  label: {
    start: ({ kind, author }) => `Record ${kind} atom (taught by ${author})`,
  },
  async execute(input) {
    if (!slugs.has(input.villagerSlug)) {
      throw new Error(`Unknown villagerSlug '${input.villagerSlug}'`);
    }
    const store = getMemoryStore();
    const dir = await mkdtemp(join(tmpdir(), "village-mem-"));
    try {
      await store.pull(input.villagerSlug, dir);
      const result = await recordAtomInDir(dir, {
        kind: input.kind,
        author: input.author,
        text: input.text,
        citation: input.citation ?? null,
        source: input.source,
        themes: input.themes,
        supersedes: input.supersedes ?? null,
      });
      if (result.status === "recorded") {
        const files = await Promise.all(
          result.changedFiles.map(async (path) => ({
            path,
            content: await readFile(join(dir, path), "utf8"),
          })),
        );
        await store.push(input.villagerSlug, files);
      }
      return { status: result.status, id: result.id };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
