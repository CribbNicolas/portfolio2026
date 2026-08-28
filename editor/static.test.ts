/**
 * Serving the page's own files, and nothing else on the disk.
 *
 * The traversal guard carries this file. The editor process holds write access
 * to the project's single source of truth, so a URL that can walk out of
 * `editor/public/` is not a cosmetic bug — and `..` in a path is the oldest
 * trick there is.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveStatic } from "./static";

/** A throwaway public/ with one of each thing we serve, plus a secret outside it. */
async function fixture(): Promise<{ root: string; parent: string }> {
  const parent = await mkdtemp(join(tmpdir(), "editor-static-"));
  const root = join(parent, "public");
  await mkdir(root);
  await writeFile(join(root, "index.html"), "<!doctype html><title>editor</title>", "utf8");
  await writeFile(join(root, "editor.css"), "body { margin: 0 }", "utf8");
  await writeFile(join(root, "app.js"), "export const ready = true;", "utf8");
  await writeFile(join(parent, "secret.txt"), "not yours", "utf8");
  return { root, parent };
}

test("/ serves index.html as HTML", async () => {
  const { root } = await fixture();
  const hit = await resolveStatic(root, "/");
  assert.ok(hit);
  assert.match(hit.contentType, /text\/html/);
  assert.match(hit.body.toString("utf8"), /<title>editor<\/title>/);
});

test("a JavaScript module is served as JavaScript, or the browser refuses it", async () => {
  const { root } = await fixture();
  const hit = await resolveStatic(root, "/app.js");
  assert.ok(hit);
  // A module served as text/plain is blocked outright by the browser, and the
  // page fails with nothing in the network tab to explain why.
  assert.match(hit.contentType, /text\/javascript/);
});

test("CSS keeps its own type", async () => {
  const { root } = await fixture();
  assert.match((await resolveStatic(root, "/editor.css"))!.contentType, /text\/css/);
});

test("a missing file is null, not a throw", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/nope.js"), null);
});

test("a query string is not part of the filename", async () => {
  const { root } = await fixture();
  assert.ok(await resolveStatic(root, "/app.js?v=2"));
});

test("`..` cannot walk out of the root", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/../secret.txt"), null);
  assert.equal(await resolveStatic(root, "/../../secret.txt"), null);
  assert.equal(await resolveStatic(root, "/subdir/../../secret.txt"), null);
});

test("an encoded `..` cannot either: the decode happens before the guard", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/%2e%2e/secret.txt"), null);
});

test("a directory is not a file", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/subdir"), null);
});
