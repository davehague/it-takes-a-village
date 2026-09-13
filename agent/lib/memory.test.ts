import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendRawTrace,
  buildProgressiveContext,
  compileRoomMemory,
  ensureRoomStructure,
  inferKind,
  readAtoms,
  recordAtom,
} from "./memory.ts";

async function room(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");
}

const FINDING = {
  id: "a1",
  author: "ren",
  source: "exa",
  citation: "arXiv:2608.27454",
  text: "Skills evolved on a smaller model improved a larger one, so the text carries the capability.",
};

const RULE = {
  id: "a2",
  author: "david",
  source: "slack",
  text: "Prefer primary sources: a blog post summarizing a paper is not the paper.",
};

test("compileRoomMemory creates themes and graph", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [FINDING, RULE]);
  const context = await buildProgressiveContext(roomPath, "skills");

  assert.ok(context.themes.length > 0);
  assert.ok(context.atoms.length > 0);
  assert.ok(context.graph.nodes.length > 0);

  await rm(roomPath, { recursive: true, force: true });
});

test("research accumulates — a new finding never displaces an older one", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [FINDING]);
  await recordAtom(roomPath, {
    id: "a3",
    author: "ren",
    source: "exa",
    citation: "https://example.org/synthetic-report",
    text: "A second sourced result found later in the same investigation.",
  });

  const atoms = await readAtoms(roomPath);
  assert.deepEqual(atoms.map((atom) => atom.id).sort(), ["a1", "a3"]);

  const index = await readFile(join(roomPath, "index.md"), "utf8");
  assert.match(index, /a1|smaller model/);
  assert.match(index, /a3|second sourced/);

  await rm(roomPath, { recursive: true, force: true });
});

test("a finding keeps its citation and its author through to context", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [FINDING]);
  const context = await buildProgressiveContext(roomPath, "skills");
  const atom = context.atoms.find((candidate) => candidate.id === "a1");

  assert.ok(atom);
  assert.equal(atom.kind, "finding");
  assert.equal(atom.citation, "arXiv:2608.27454");
  assert.equal(atom.author, "ren");

  await rm(roomPath, { recursive: true, force: true });
});

test("the room's rules load on every run, even when the query does not match them", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [FINDING, RULE]);
  // Nothing in the rule mentions photosynthesis; it still has to shape the run.
  const context = await buildProgressiveContext(roomPath, "photosynthesis");

  assert.equal(context.atoms[0].kind, "rule");
  assert.equal(context.atoms[0].author, "david");

  await rm(roomPath, { recursive: true, force: true });
});

test("kinds are inferred from how people write", async () => {
  assert.equal(inferKind("Does the transfer result hold across harnesses?"), "question");
  assert.equal(inferKind("Never cite a preprint without saying it is one."), "rule");
  assert.equal(inferKind("The 9B model scored 12 points higher on the benchmark."), "finding");
});

test("index.md surfaces open questions and uncited findings", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [
    { id: "q1", author: "david", source: "slack", kind: "question", text: "Open question: does this replicate?" },
    { id: "f1", author: "ren", source: "exa", kind: "finding", text: "An unsourced claim we still need to back up." },
  ]);

  const index = await readFile(join(roomPath, "index.md"), "utf8");
  assert.match(index, /Open questions/);
  assert.match(index, /missing a citation/);
  assert.match(index, /f1/);

  await rm(roomPath, { recursive: true, force: true });
});

test("raw traces append rather than overwrite", async () => {
  const roomPath = await room();

  const path = await appendRawTrace(roomPath, "first search", "results A");
  await appendRawTrace(roomPath, "second search", "results B");

  const raw = await readFile(path, "utf8");
  assert.match(raw, /results A/);
  assert.match(raw, /results B/);

  await rm(roomPath, { recursive: true, force: true });
});

test("ensureRoomStructure leaves a compiled room intact", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [FINDING]);
  await ensureRoomStructure(roomPath);

  const index = await readFile(join(roomPath, "index.md"), "utf8");
  assert.match(index, /a1/);

  await rm(roomPath, { recursive: true, force: true });
});

test("readAtoms drops atoms marked superseded_by", async () => {
  const roomPath = await room();
  await compileRoomMemory(roomPath, [
    { id: "old", author: "ren", source: "slack", kind: "rule", text: "Only the last 12 months." },
  ]);
  // Manually mark it superseded, as record-atom does.
  const p = join(roomPath, "atoms", "old.md");
  const raw = await readFile(p, "utf8");
  const fs = await import("node:fs/promises");
  await fs.writeFile(p, raw.replace(/^(---\n[\s\S]*?)(\n---)/m, "$1\nsuperseded_by: new$2"), "utf8");

  const atoms = await readAtoms(roomPath);
  assert.equal(atoms.find((a) => a.id === "old"), undefined);

  await rm(roomPath, { recursive: true, force: true });
});

test("atom ids from chat text cannot escape the atoms directory", async () => {
  const roomPath = await room();

  await compileRoomMemory(roomPath, [
    { id: "../../escaped", author: "ren", source: "slack", text: "A rule with a hostile id." },
  ]);

  const atoms = await readAtoms(roomPath);
  assert.equal(atoms.length, 1);
  assert.doesNotMatch(atoms[0].id, /[/\\]/);

  await rm(roomPath, { recursive: true, force: true });
});
