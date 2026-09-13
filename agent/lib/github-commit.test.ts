import test from "node:test";
import assert from "node:assert/strict";
import { commitFilesToBranch } from "./github-commit.ts";

test("commitFilesToBranch rejects an empty token", async () => {
  await assert.rejects(
    () => commitFilesToBranch({ repo: "a/b", branch: "x", files: [], message: "m", token: "" }),
    /token/i,
  );
});

test("commitFilesToBranch rejects when no files are given", async () => {
  await assert.rejects(
    () => commitFilesToBranch({ repo: "a/b", branch: "x", files: [], message: "m", token: "t" }),
    /no files/i,
  );
});
