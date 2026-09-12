import { fileURLToPath } from "node:url";

import { createExampleRoom } from "./memory.ts";

// Resolved from this module, not the cwd, so it works wherever it is run from.
const roomPath = fileURLToPath(new URL("../sandbox/workspace/village/rooms/demo-room", import.meta.url));

await createExampleRoom(roomPath);
console.log(`Demo room created at ${roomPath}`);
