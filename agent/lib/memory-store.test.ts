import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { localFsStore, memoryPrefix } from "./memory-store.ts";

test("memoryPrefix builds the villager memory path", () => {
  assert.equal(memoryPrefix("exa-researcher"), "village/villagers/exa-researcher/memory/");
});

test("localFsStore round-trips push -> pull -> readIndex", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-root-"));
  const store = localFsStore(root);

  await store.push("demo", [
    { path: "index.md", content: "# Research map\n\nhello\n" },
    { path: "atoms/rule-x.md", content: "---\nid: rule-x\n---\n\nbody\n" },
  ]);

  assert.equal(await store.readIndex("demo"), "# Research map\n\nhello\n");

  const dest = await mkdtemp(join(tmpdir(), "store-dest-"));
  await store.pull("demo", dest);
  assert.equal(await readFile(join(dest, "index.md"), "utf8"), "# Research map\n\nhello\n");
  assert.equal(await readFile(join(dest, "atoms", "rule-x.md"), "utf8"), "---\nid: rule-x\n---\n\nbody\n");

  await rm(root, { recursive: true, force: true });
  await rm(dest, { recursive: true, force: true });
});

test("readIndex returns null when the store has no memory for a slug", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-empty-"));
  assert.equal(await localFsStore(root).readIndex("nobody"), null);
  await rm(root, { recursive: true, force: true });
});

test("pull into a dir for an empty slug writes nothing and does not throw", async () => {
  const root = await mkdtemp(join(tmpdir(), "store-empty2-"));
  const dest = await mkdtemp(join(tmpdir(), "store-dest2-"));
  await localFsStore(root).pull("nobody", dest);
  await rm(root, { recursive: true, force: true });
  await rm(dest, { recursive: true, force: true });
});
