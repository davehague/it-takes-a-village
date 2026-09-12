import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createExampleRoom } from "./memory.ts";

// A format demo only — it writes a fully-populated example brain to a throwaway
// scratch dir so you can eyeball the compiled atoms/themes/index. It deliberately
// does NOT write into a live villager's memory: a real villager (e.g.
// village/villagers/exa-researcher/memory) starts EMPTY and learns its atoms in
// public from actual channel conversation, so seeding it would fabricate
// attributions no human ever said.
const roomPath = join(await mkdtemp(join(tmpdir(), "village-memory-demo-")), "example-room");

await createExampleRoom(roomPath);
console.log(`Example brain created at ${roomPath}`);
