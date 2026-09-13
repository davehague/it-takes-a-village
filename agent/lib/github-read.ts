/**
 * Read one file from a branch via the GitHub contents API. The birth tool uses
 * it to load the CURRENT registry from main (never the possibly-stale copy
 * bundled into the running deployment) before adding a villager to it.
 */

import { GITHUB_API, ghHeaders } from "./github-commit.ts";

export async function readFileFromBranch(opts: {
  repo: string;
  branch: string;
  path: string;
  token: string;
}): Promise<string | null> {
  const { repo, branch, path, token } = opts;
  if (!token) throw new Error("readFileFromBranch: a GitHub token is required");
  if (!path) throw new Error("readFileFromBranch: a path is required");

  const url = `${GITHUB_API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET contents/${path}@${branch} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { encoding?: string; content?: string };
  if (json.encoding !== "base64" || typeof json.content !== "string") {
    throw new Error(`GitHub contents/${path}@${branch}: unexpected response shape`);
  }
  return Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
}
