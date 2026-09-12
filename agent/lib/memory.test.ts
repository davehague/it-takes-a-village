import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildProgressiveContext, compileRoomMemory, ensureRoomStructure, readAtoms } from "./memory.ts";

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

test("a later correction adds to the room without wiping earlier atoms", async () => {
  const roomPath = join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");

  await compileRoomMemory(roomPath, [
    { id: "a1", author: "ren", source: "slack", text: "Ask for the customer email before proceeding." },
  ]);

  // The learning loop compiles one new atom at a time; the first must survive.
  await compileRoomMemory(roomPath, [
    { id: "a2", author: "david", source: "slack", text: "Escalate blocked tickets after 24 hours." },
  ]);

  const atoms = await readAtoms(roomPath);
  assert.deepEqual(
    atoms.map((atom) => atom.id).sort(),
    ["a1", "a2"],
  );

  const index = await readFile(join(roomPath, "index.md"), "utf8");
  assert.match(index, /a1/);
  assert.match(index, /a2/);

  await rm(roomPath, { recursive: true, force: true });
});

test("progressive context ranks by content and keeps attribution", async () => {
  const roomPath = join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");

  await compileRoomMemory(roomPath, [
    { id: "a1", author: "ren", source: "slack", text: "Ask for the customer email before proceeding." },
    { id: "a2", author: "david", source: "slack", text: "Escalate blocked tickets after 24 hours." },
  ]);

  const context = await buildProgressiveContext(roomPath, "email");

  // "email" lives in the atom body and only in the customer_data theme — never in a filename.
  assert.equal(context.atoms[0].id, "a1");
  assert.equal(context.atoms[0].author, "ren");
  assert.equal(context.themes[0].name, "customer_data");

  await rm(roomPath, { recursive: true, force: true });
});

test("ensureRoomStructure leaves a compiled room intact", async () => {
  const roomPath = join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");

  await compileRoomMemory(roomPath, [
    { id: "a1", author: "ren", source: "slack", text: "Ask for the customer email before proceeding." },
  ]);
  await ensureRoomStructure(roomPath);

  const index = await readFile(join(roomPath, "index.md"), "utf8");
  assert.match(index, /a1/);

  await rm(roomPath, { recursive: true, force: true });
});

test("atom ids from chat text cannot escape the atoms directory", async () => {
  const roomPath = join(await mkdtemp(join(tmpdir(), "memory-room-")), "room");

  await compileRoomMemory(roomPath, [
    { id: "../../escaped", author: "ren", source: "slack", text: "A rule with a hostile id." },
  ]);

  const atoms = await readAtoms(roomPath);
  assert.equal(atoms.length, 1);
  assert.doesNotMatch(atoms[0].id, /[/\\]/);

  await rm(roomPath, { recursive: true, force: true });
});
