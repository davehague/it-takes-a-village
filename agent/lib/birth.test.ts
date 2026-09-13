import test from "node:test";
import assert from "node:assert/strict";

import { deriveSlug, learningSection, renderInstructions } from "./birth.ts";

test("deriveSlug lowercases, dashes punctuation and spaces, trims dashes", () => {
  assert.equal(deriveSlug("Copywriter"), "copywriter");
  assert.equal(deriveSlug("  Meeting  Notes Bot! "), "meeting-notes-bot");
  assert.equal(deriveSlug("Café Critic"), "cafe-critic");
  assert.throws(() => deriveSlug("!!!"), /Cannot derive a slug/);
});

test("learningSection carries the slug into the record_atom line", () => {
  const s = learningSection("copywriter");
  assert.ok(s.startsWith("## How I learn\n"));
  assert.ok(s.includes('record_atom(villagerSlug: "copywriter", kind: "rule"|"finding"|"question"'));
  assert.ok(s.includes("## Rules I've been taught"));
  assert.ok(!s.endsWith("\n"));
});

test("renderInstructions assembles heading, intro, what-i-do, and the learning contract", () => {
  const md = renderInstructions({
    name: "Copywriter",
    icon: ":pencil:",
    intro: "I am **Copywriter** ✏️, a villager. I turn rough notes into tight copy.",
    whatIDo: "1. Read the notes.\n2. Draft.\n3. Tighten.",
  });
  assert.ok(md.startsWith("# Copywriter\n\nI am **Copywriter**"));
  assert.ok(md.includes("\n## What I do\n\n1. Read the notes.\n2. Draft.\n3. Tighten.\n"));
  assert.ok(!md.includes("## How I sound"));
  assert.ok(md.includes('villagerSlug: "copywriter"'));
  assert.ok(md.endsWith("who taught it and when.\n"));
});

test("renderInstructions includes 'How I sound' only when voice is given", () => {
  const md = renderInstructions({
    name: "Copywriter",
    icon: ":pencil:",
    intro: "I am Copywriter.",
    whatIDo: "Draft copy.",
    voice: "Dry, short sentences.",
  });
  assert.ok(md.includes("\n## How I sound\n\nDry, short sentences.\n\n## How I learn\n"));
});

import { buildBirthFiles, REGISTRY_PATH } from "./birth.ts";

const registry = {
  C0C1GK8SGKT: { slug: "exa-researcher", name: "Exa Researcher", icon: ":mag:", dir: "village/villagers/exa-researcher" },
};
const input = {
  name: "Copywriter",
  icon: ":pencil:",
  intro: "I am **Copywriter** ✏️, a villager.",
  whatIDo: "Draft copy.",
  description: "Turns rough notes into tight copy.",
};

test("buildBirthFiles returns the four repo files and a registry with exactly one new key", () => {
  const out = buildBirthFiles({ registry, channelId: "C0NEW00001", input });
  assert.equal(out.slug, "copywriter");
  assert.equal(out.dir, "village/villagers/copywriter");
  assert.deepEqual(
    out.files.map((f) => f.path),
    [
      "agent/sandbox/workspace/village/villagers/copywriter/instructions.md",
      "agent/sandbox/workspace/village/villagers/copywriter/memory/index.md",
      "agent/sandbox/workspace/village/villagers/copywriter/memory/atoms/.gitkeep",
      REGISTRY_PATH,
    ],
  );
  const written = JSON.parse(out.files[3].content);
  assert.deepEqual(Object.keys(written), ["C0C1GK8SGKT", "C0NEW00001"]);
  assert.deepEqual(written.C0NEW00001, {
    slug: "copywriter",
    name: "Copywriter",
    icon: ":pencil:",
    dir: "village/villagers/copywriter",
    description: "Turns rough notes into tight copy.",
  });
  assert.ok(out.files[3].content.endsWith("}\n"));
  assert.equal(out.files[2].content, "");
  assert.ok(out.files[1].content.startsWith("# Copywriter — brain\n"));
  assert.ok(out.files[0].content.includes('villagerSlug: "copywriter"'));
  // input registry untouched
  assert.deepEqual(Object.keys(registry), ["C0C1GK8SGKT"]);
});

test("buildBirthFiles honours an explicit slug", () => {
  const out = buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, slug: "copy-bot" } });
  assert.equal(out.slug, "copy-bot");
  assert.ok(out.files[0].path.includes("/copy-bot/"));
});

test("buildBirthFiles rejects a slug already in use", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, name: "Exa Researcher" } }),
    /Slug 'exa-researcher' is already used/,
  );
});

test("buildBirthFiles rejects a channel that already has a villager", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0C1GK8SGKT", input }),
    /Channel C0C1GK8SGKT already has a villager \('Exa Researcher'/,
  );
});

test("buildBirthFiles rejects a midwife channel", () => {
  assert.throws(
    () => buildBirthFiles({ registry, channelId: "C0C0YRB5M47", input }),
    /is a midwife channel/,
  );
});

test("buildBirthFiles rejects a bad icon, a bad slug, and empty prose", () => {
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, icon: "pencil" } }), /colon form/);
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, slug: "Copy Bot" } }), /Slug 'Copy Bot' is invalid/);
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, whatIDo: "  " } }), /non-empty whatIDo/);
  assert.throws(() => buildBirthFiles({ registry, channelId: "C0NEW00001", input: { ...input, description: "" } }), /non-empty description/);
});
