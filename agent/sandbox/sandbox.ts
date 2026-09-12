import { defineSandbox } from "eve/sandbox";

// The folder layout (`agent/sandbox/sandbox.ts`, not the `agent/sandbox.ts` shorthand) is what
// makes Eve seed `agent/sandbox/workspace/**` into the sandbox cwd. Without this file the village
// tree never reaches `/workspace`. No backend override — the runtime falls back to defaultBackend().
export default defineSandbox({});
