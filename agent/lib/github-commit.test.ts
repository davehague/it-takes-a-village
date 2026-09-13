import test from "node:test";
import assert from "node:assert/strict";
import { commitFilesToBranch, getBranchHead } from "./github-commit.ts";

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

test("getBranchHead rejects an empty token before any network call", async () => {
  await assert.rejects(getBranchHead({ repo: "x/y", branch: "main", token: "" }), /GitHub token is required/);
});

test("commitFilesToBranch refuses when the branch head moved past expectedHeadSha, before writing anything", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/git/ref/heads/main")) {
      return new Response(JSON.stringify({ object: { sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  await assert.rejects(
    commitFilesToBranch({
      repo: "x/y",
      branch: "main",
      files: [{ path: "a.txt", content: "a" }],
      message: "m",
      token: "t",
      expectedHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }),
    /main moved while committing \(expected aaaaaaa, found bbbbbbb\) — retry/,
  );
  assert.deepEqual(calls, ["https://api.github.com/repos/x/y/git/ref/heads/main"]);
});
