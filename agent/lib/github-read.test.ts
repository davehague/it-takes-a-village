import test from "node:test";
import assert from "node:assert/strict";

import { readFileFromBranch } from "./github-read.ts";

test("readFileFromBranch rejects an empty token before any network call", async () => {
  await assert.rejects(
    readFileFromBranch({ repo: "x/y", branch: "main", path: "villages.json", token: "" }),
    /GitHub token is required/,
  );
});

test("readFileFromBranch rejects an empty path", async () => {
  await assert.rejects(
    readFileFromBranch({ repo: "x/y", branch: "main", path: "", token: "t" }),
    /path is required/,
  );
});
