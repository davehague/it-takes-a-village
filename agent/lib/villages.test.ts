import test from "node:test";
import assert from "node:assert/strict";

import {
  MIDWIFE_CHANNELS,
  VILLAGES,
  registryFromJson,
  villagerForChannel,
} from "./villages.ts";

test("registry loads both existing villagers from villages.json", () => {
  assert.equal(villagerForChannel("C0C1GK8SGKT")?.slug, "exa-researcher");
  assert.equal(villagerForChannel("C0C1A8TE605")?.slug, "enterprise-architect");
  assert.equal(VILLAGES["C0C1GK8SGKT"].dir, "village/villagers/exa-researcher");
});

test("framing lines join into one string; missing framing stays undefined", () => {
  const exa = VILLAGES["C0C1GK8SGKT"];
  assert.ok(exa.framing?.startsWith("Your brain (the rules and open questions"));
  assert.ok(exa.framing?.includes("\n  cd village/villagers/exa-researcher\n"));
  assert.equal(VILLAGES["C0C1A8TE605"].framing, undefined);
});

test("midwife channels and unknown channels resolve to null", () => {
  assert.ok(MIDWIFE_CHANNELS.has("C0C0YRB5M47"));
  assert.equal(villagerForChannel("C0C0YRB5M47"), null);
  assert.equal(villagerForChannel("C0NOPE0000"), null);
  assert.equal(villagerForChannel(undefined), null);
});

test("registryFromJson maps records without mutating input", () => {
  const json = { C1: { slug: "a", name: "A", icon: ":a:", dir: "village/villagers/a", framing: ["x", "y"] } };
  const out = registryFromJson(json);
  assert.equal(out.C1.framing, "x\ny");
  assert.deepEqual(json.C1.framing, ["x", "y"]);
});
