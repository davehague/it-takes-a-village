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
