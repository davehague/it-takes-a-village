/**
 * Commit a set of files to a branch via the GitHub Git Data API. This is how
 * runtime-learned memory reaches git (ADR 0003): neither the sandbox (firewall)
 * nor the plain app runtime has a repo checkout, so we write through the API with
 * a repo-scoped token. Multi-file atomic: blobs -> tree (on the branch head) ->
 * commit -> move ref; an optional expectedHeadSha pins the whole operation to
 * the head the caller read from.
 */

export const GITHUB_API = "https://api.github.com";

/** Standard headers for the GitHub REST API with a repo-scoped token. */
export function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function gh(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Current head sha of a branch, or null when the branch does not exist. */
export async function getBranchHead(opts: { repo: string; branch: string; token: string }): Promise<string | null> {
  const { repo, branch, token } = opts;
  if (!token) throw new Error("getBranchHead: a GitHub token is required");
  const res = await fetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${branch}`, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET git/ref/heads/${branch} failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { object?: { sha?: string } };
  if (typeof json.object?.sha !== "string") throw new Error(`GitHub git/ref/heads/${branch}: unexpected response shape`);
  return json.object.sha;
}

export async function commitFilesToBranch(opts: {
  repo: string;
  branch: string;
  files: { path: string; content: string }[];
  message: string;
  token: string;
  expectedHeadSha?: string;
}): Promise<{ commitSha: string; url: string }> {
  const { repo, branch, files, message, token, expectedHeadSha } = opts;
  if (!token) throw new Error("commitFilesToBranch: a GitHub token is required");
  if (files.length === 0) throw new Error("commitFilesToBranch: no files to commit");

  // Resolve the branch head (create the branch off the default branch if missing).
  let headSha: string;
  try {
    const ref = await gh(token, `/repos/${repo}/git/ref/heads/${branch}`);
    headSha = ref.object.sha;
  } catch {
    const repoInfo = await gh(token, `/repos/${repo}`);
    const base = await gh(token, `/repos/${repo}/git/ref/heads/${repoInfo.default_branch}`);
    headSha = base.object.sha;
    await gh(token, `/repos/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: headSha }),
    });
  }

  // A caller that read state from the branch (the birth tool reads villages.json
  // at a pinned sha) passes that sha here, so a push that lands in between fails
  // the whole commit instead of silently overwriting the other change.
  if (expectedHeadSha && headSha !== expectedHeadSha) {
    throw new Error(
      `${branch} moved while committing (expected ${expectedHeadSha.slice(0, 7)}, found ${headSha.slice(0, 7)}) — retry`,
    );
  }

  const baseCommit = await gh(token, `/repos/${repo}/git/commits/${headSha}`);

  const treeItems = await Promise.all(
    files.map(async (f) => {
      const blob = await gh(token, `/repos/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const tree = await gh(token, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }),
  });

  const commit = await gh(token, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });

  try {
    await gh(token, `/repos/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes(" 422 ")) throw new Error(`${branch} moved while committing — retry`);
    throw e;
  }

  return { commitSha: commit.sha, url: commit.html_url };
}
