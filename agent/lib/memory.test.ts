import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildProgressiveContext, compileRoomMemory } from "./memory.ts";

test("compileRoomMemory creates themes and graph", async () => {
  const roomPath = join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");

  await compileRoomMemory(roomPath, [
    {
      id: "a1",
      author: "ren",
      source: "slack",
      text: "When the ticket is missing the customer email, ask for the email before proceeding.",
    },
    {
      id: "a2",
      author: "david",
      source: "slack",
      text: "Escalate blocked tickets when customer contact is missing.",
    },
  ]);

  const context = await buildProgressiveContext(roomPath, "email");

  assert.ok(context.themes.length > 0);
  assert.ok(context.atoms.length > 0);
  assert.ok(context.graph.nodes.length > 0);

  await rm(roomPath, { recursive: true, force: true });
});
