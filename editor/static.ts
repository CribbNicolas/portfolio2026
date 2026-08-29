/**
 * The page's own files, and nothing else on the disk.
 *
 * `resolveStatic` returns `null` rather than throwing for anything it will not
 * serve — a missing file, a directory, a path that tried to leave the root —
 * so the caller has one branch for "no" and does not have to tell the reasons
 * apart. It should not: a 404 is the right answer to all of them, and a
 * distinct error for a traversal attempt would confirm the guess.
 *
 * The order matters: decode first, then resolve, then check containment.
 * Checking for `..` in the raw string instead would miss `%2e%2e`, and
 * checking after resolving is what makes the guard about where the path
 * actually lands rather than what it looks like.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `editor/public`, resolved from this file so the cwd does not matter. */
export const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "public");

export interface StaticHit {
  body: Buffer;
  contentType: string;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function resolveStatic(root: string, urlPath: string): Promise<StaticHit | null> {
  const withoutQuery = urlPath.split("?")[0];

  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // A malformed escape is not a file either.
    return null;
  }

  const rootDir = resolve(root);
  const candidate = resolve(rootDir, `.${decoded === "/" ? "/index.html" : decoded}`);

  // The guard: where it LANDS, not what it looked like. The separator check
  // stops `public-secrets/` from passing as a prefix match of `public/`.
  if (candidate !== rootDir && !candidate.startsWith(rootDir + "\\") && !candidate.startsWith(rootDir + "/")) {
    return null;
  }

  try {
    const info = await stat(candidate);
    if (!info.isFile()) return null;
  } catch {
    return null;
  }

  const dot = candidate.lastIndexOf(".");
  const extension = dot === -1 ? "" : candidate.slice(dot).toLowerCase();

  return {
    body: await readFile(candidate),
    contentType: TYPES[extension] ?? "application/octet-stream",
  };
}
