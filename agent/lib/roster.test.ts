import test from "node:test";
import assert from "node:assert/strict";

import { rosterFromRegistries } from "./roster.ts";

const exa = { slug: "exa-researcher", name: "Exa Researcher", icon: ":mag:", dir: "village/villagers/exa-researcher" };
const ea = { slug: "enterprise-architect", name: "Enterprise Architect", icon: ":triangular_ruler:", dir: "village/villagers/enterprise-architect" };
const greeter = { slug: "greeter", name: "Greeter", icon: ":wave:", dir: "village/villagers/greeter" };

test("deployed villagers are live, in registry order, with their channel ids", () => {
  const rows = rosterFromRegistries({ C1: exa, C2: ea }, { C1: exa, C2: ea });
  assert.deepEqual(
    rows.map((r) => [r.slug, r.channelId, r.status]),
    [
      ["exa-researcher", "C1", "live"],
      ["enterprise-architect", "C2", "live"],
    ],
  );
  assert.equal(rows[0].icon, ":mag:");
  assert.equal(rows[0].dir, "village/villagers/exa-researcher");
});

test("a villager on main but not yet deployed is flagged deploying, after the live ones", () => {
  const rows = rosterFromRegistries({ C1: exa }, { C1: exa, C3: greeter });
  assert.deepEqual(
    rows.map((r) => [r.slug, r.status]),
    [
      ["exa-researcher", "live"],
      ["greeter", "deploying"],
    ],
  );
});

test("without a main snapshot every deployed villager is simply live", () => {
  const rows = rosterFromRegistries({ C1: exa, C2: ea }, null);
  assert.deepEqual(rows.map((r) => r.status), ["live", "live"]);
});
