import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { list, put } from "@vercel/blob";

/**
 * Where memory lives, and how it moves between the runtime store and a local
 * directory. Per ADR 0003: Vercel Blob is the live store in production; a local
 * filesystem store backs dev/test. Callers work in a local dir (so Ren's
 * file-based compiler in memory.ts applies unchanged) and pull/push around it.
 */

export function memoryPrefix(slug: string): string {
  return `village/villagers/${slug}/memory/`;
}

export interface MemoryStore {
  /** Write every stored memory file for `slug` into `destDir` at its relative path. */
  pull(slug: string, destDir: string): Promise<void>;
  /** Persist each file (path relative to the memory root, e.g. "atoms/x.md"). */
  push(slug: string, files: { path: string; content: string }[]): Promise<void>;
  /** The current index.md text, or null if the villager has no memory yet. */
  readIndex(slug: string): Promise<string | null>;
}

/** Recursively list files under a dir as paths relative to it (posix-style). */
async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

export function localFsStore(root: string): MemoryStore {
  const memRoot = (slug: string) => join(root, "village", "villagers", slug, "memory");
  return {
    async pull(slug, destDir) {
      const src = memRoot(slug);
      for (const rel of await walk(src)) {
        const content = await readFile(join(src, rel), "utf8");
        const target = join(destDir, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
    },
    async push(slug, files) {
      for (const f of files) {
        const target = join(memRoot(slug), f.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, f.content, "utf8");
      }
    },
    async readIndex(slug) {
      return readFile(join(memRoot(slug), "index.md"), "utf8").catch(() => null);
    },
  };
}

export function blobStore(token: string): MemoryStore {
  const prefix = memoryPrefix;
  return {
    async pull(slug, destDir) {
      const { blobs } = await list({ prefix: prefix(slug), token });
      for (const b of blobs) {
        const rel = b.pathname.slice(prefix(slug).length);
        if (!rel) continue;
        const content = await (await fetch(b.url)).text();
        const target = join(destDir, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
    },
    async push(slug, files) {
      for (const f of files) {
        await put(prefix(slug) + f.path, f.content, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
      }
    },
    async readIndex(slug) {
      const { blobs } = await list({ prefix: prefix(slug) + "index.md", token });
      const hit = blobs.find((b) => b.pathname === prefix(slug) + "index.md");
      return hit ? await (await fetch(hit.url)).text() : null;
    },
  };
}

/** Blob in production (token set), local filesystem otherwise. */
export function getMemoryStore(): MemoryStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return blobStore(token);
  const workspace = join(dirname(fileURLToPath(import.meta.url)), "..", "sandbox", "workspace");
  return localFsStore(workspace);
}
