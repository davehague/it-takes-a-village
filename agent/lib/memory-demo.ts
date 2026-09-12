import { fileURLToPath } from "node:url";

import { createExampleRoom } from "./memory.ts";

// Resolved from this module, not the cwd, so it works wherever it is run from.
// A villager's memory lives inside its own folder (village/villagers/<slug>/memory) —
// one folder per villager, since one channel = one villager (no separate rooms/ tree).
const roomPath = fileURLToPath(
  new URL("../sandbox/workspace/village/villagers/exa-researcher/memory", import.meta.url),
);

await createExampleRoom(roomPath);
console.log(`Demo room created at ${roomPath}`);
