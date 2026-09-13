import test from "node:test";
import assert from "node:assert/strict";

import { buildMaintainFiles, validateVillagerPath } from "./maintain.ts";

const registry = {
  C0C1GK8SGKT: { slug: "exa-researcher", name: "Exa Researcher", icon: ":mag:", dir: "village/villagers/exa-researcher" },
  C0C1BF8HGQK: { slug: "greeter", name: "Greeter", icon: ":wave:", dir: "village/villagers/greeter" },
};

test("validateVillagerPath accepts relative code paths and normalizes them", () => {
  assert.equal(validateVillagerPath("instructions.md"), "instructions.md");
  assert.equal(validateVillagerPath("scripts/search.sh"), "scripts/search.sh");
  assert.equal(validateVillagerPath("./stages/01-research/CONTEXT.md"), "stages/01-research/CONTEXT.md");
});

test("validateVillagerPath rejects absolute, traversal, backslash, and memory paths", () => {
  assert.throws(() => validateVillagerPath("/etc/passwd"), /relative to the villager folder/);
  assert.throws(() => validateVillagerPath("../exa-researcher/instructions.md"), /may not contain '\.\.'/);
  assert.throws(() => validateVillagerPath("scripts//x.sh"), /empty segments/);
  assert.throws(() => validateVillagerPath("scripts\\x.sh"), /forward slashes/);
  assert.throws(() => validateVillagerPath("memory/index.md"), /memory\//);
  assert.throws(() => validateVillagerPath("   "), /non-empty path/);
});

test("buildMaintainFiles maps files under the villager's repo folder and returns the record", () => {
  const out = buildMaintainFiles({
    registry,
    villagerSlug: "greeter",
    files: [
      { path: "instructions.md", content: "# Greeter\n" },
      { path: "scripts/hello.sh", content: "#!/bin/sh\necho hi\n" },
    ],
  });
  assert.equal(out.record.name, "Greeter");
  assert.equal(out.channelId, "C0C1BF8HGQK");
  assert.deepEqual(
    out.files.map((f) => f.path),
    [
      "agent/sandbox/workspace/village/villagers/greeter/instructions.md",
      "agent/sandbox/workspace/village/villagers/greeter/scripts/hello.sh",
    ],
  );
  assert.equal(out.files[0].content, "# Greeter\n");
});

test("buildMaintainFiles rejects an unknown slug, no files, and duplicate paths", () => {
  const one = [{ path: "instructions.md", content: "x" }];
  assert.throws(() => buildMaintainFiles({ registry, villagerSlug: "nobody", files: one }), /Unknown villager 'nobody'/);
  assert.throws(() => buildMaintainFiles({ registry, villagerSlug: "greeter", files: [] }), /at least one file/);
  assert.throws(
    () => buildMaintainFiles({ registry, villagerSlug: "greeter", files: [...one, { path: "./instructions.md", content: "y" }] }),
    /listed twice/,
  );
});
