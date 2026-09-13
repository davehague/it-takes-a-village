import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordAtomInDir } from "./record-atom.ts";

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "record-atom-"));
}

test("records a rule, writes an atom file and a rules section", async () => {
  const d = await dir();
  const r = await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Exclude vendor blogs." });
  assert.equal(r.status, "recorded");
  assert.ok(r.id.startsWith("rule-"));
  assert.ok(r.changedFiles.includes("index.md"));
  assert.ok(r.changedFiles.some((f) => f.startsWith("atoms/")));

  const files = await readdir(join(d, "atoms"));
  assert.equal(files.length, 1);
  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /How this room wants research done/);
  assert.match(index, /Exclude vendor blogs\. — \*David Hague\*/);
  await rm(d, { recursive: true, force: true });
});

test("dedup: same kind + same text is a no-op", async () => {
  const d = await dir();
  await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Only the last 12 months." });
  const again = await recordAtomInDir(d, { kind: "rule", author: "David Hague", text: "Only the last 12 months." });
  assert.equal(again.status, "duplicate");
  assert.deepEqual(again.changedFiles, []);
  assert.equal((await readdir(join(d, "atoms"))).length, 1);
  await rm(d, { recursive: true, force: true });
});

test("supersession: superseded atom drops out of the index", async () => {
  const d = await dir();
  const first = await recordAtomInDir(d, { kind: "rule", author: "Ren", text: "Only the last 12 months." });
  const second = await recordAtomInDir(d, {
    kind: "rule", author: "Ren", text: "Only the last 18 months.", supersedes: first.id,
  });
  assert.equal(second.status, "recorded");

  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /18 months/);
  assert.doesNotMatch(index, /12 months/);

  const oldFile = await readFile(join(d, "atoms", `${first.id}.md`), "utf8");
  assert.match(oldFile, new RegExp(`superseded_by: ${second.id}`));
  await rm(d, { recursive: true, force: true });
});

test("findings and questions land in their sections", async () => {
  const d = await dir();
  await recordAtomInDir(d, { kind: "question", author: "David Hague", text: "Does this replicate across harnesses?" });
  const index = await readFile(join(d, "index.md"), "utf8");
  assert.match(index, /Open questions/);
  assert.match(index, /replicate across harnesses/);
  await rm(d, { recursive: true, force: true });
});
