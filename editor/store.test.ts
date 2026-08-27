/**
 * The layer that reads and writes. The spec singles it out for tests because it
 * is where a datum gets lost.
 *
 * Every test runs against a COPY of the real dataset in a temp directory. The
 * committed file is never touched — a test that writes to the project's single
 * source of truth would be a worse bug than anything it could catch.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentDataset } from "../content/schema/content-schema";
import {
  DatasetStore,
  InvalidDatasetError,
  StaleEtagError,
  etagOf,
} from "./store";

const REAL_FILE = "content/data/content.es.json";
const canonical = (await readFile(REAL_FILE, "utf8")).replace(/\r\n/g, "\n");

/** A store over a throwaway copy of the real dataset. */
async function freshStore(): Promise<{ store: DatasetStore; file: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "editor-store-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");
  return { store: new DatasetStore(file), file, dir };
}

const readRaw = (file: string): Promise<string> => readFile(file, "utf8");

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

test("read returns the dataset and an etag", async () => {
  const { store } = await freshStore();
  const snapshot = await store.read();
  assert.equal(snapshot.data.locale, "es");
  assert.equal(snapshot.etag, etagOf(canonical));
});

test("the etag changes when the file changes", async () => {
  const { store, file } = await freshStore();
  const before = (await store.read()).etag;
  await writeFile(file, canonical.replace('"locale": "es"', '"locale": "es" '), "utf8");
  assert.notEqual((await store.read()).etag, before);
});

test("a CRLF file reads to the same etag as an LF one: the machine cannot change the verdict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "editor-store-crlf-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical.replace(/\n/g, "\r\n"), "utf8");
  assert.equal((await new DatasetStore(file).read()).etag, etagOf(canonical));
});

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

test("write persists a change and returns the new etag", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const edited = structuredClone(data) as ContentDataset;
  edited.identity.preferredName = "Nicolás";

  const after = await store.write(edited, etag);
  assert.notEqual(after.etag, etag);

  const onDisk = await readRaw(file);
  assert.ok(onDisk.includes('"preferredName": "Nicolás"'));
  assert.equal(after.etag, etagOf(onDisk));
});

test("what write puts on disk is canonical, so the format gate stays green", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  await store.write(data, etag);
  assert.equal(await readRaw(file), canonical);
});

test("a rule violation is refused and the file is left byte-identical", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  await assert.rejects(
    () => store.write(broken, etag),
    (err: unknown) => {
      assert.ok(err instanceof InvalidDatasetError);
      assert.ok(err.report.violations.some((v) => v.message.includes("does-not-exist")));
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a shape error is refused too, with the Zod issues attached", async () => {
  const { store, file } = await freshStore();
  const { etag } = await store.read();

  await assert.rejects(
    () => store.write({ locale: "es" }, etag),
    (err: unknown) => {
      assert.ok(err instanceof InvalidDatasetError);
      assert.ok(err.report.zodIssues.length > 0);
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a stale etag is refused: the file changed underneath", async () => {
  const { store, file } = await freshStore();
  const { data } = await store.read();

  await assert.rejects(
    () => store.write(data, "not-the-current-etag"),
    (err: unknown) => {
      assert.ok(err instanceof StaleEtagError);
      assert.equal(err.currentEtag, etagOf(canonical));
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a refused write leaves no temporary file behind", async () => {
  const { store, dir } = await freshStore();
  const { data } = await store.read();
  await assert.rejects(() => store.write(data, "stale"));
  assert.deepEqual(await readdir(dir), ["content.es.json"]);
});

test("writing twice with the returned etag works: the snapshot is usable, not decorative", async () => {
  const { store } = await freshStore();
  const first = await store.read();

  const edited = structuredClone(first.data) as ContentDataset;
  edited.identity.preferredName = "Uno";
  const second = await store.write(edited, first.etag);

  const again = structuredClone(second.data) as ContentDataset;
  again.identity.preferredName = "Dos";
  const third = await store.write(again, second.etag);

  assert.equal((await store.read()).etag, third.etag);
});

// ---------------------------------------------------------------------------
// Concurrent writes on the same instance
// ---------------------------------------------------------------------------

test("two write() calls issued without awaiting the first: exactly one wins, the loser sees a stale etag", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const editedA = structuredClone(data) as ContentDataset;
  editedA.identity.preferredName = "A";
  const editedB = structuredClone(data) as ContentDataset;
  editedB.identity.preferredName = "B";

  // Neither call is awaited before the other starts: this is the race itself,
  // not a simulation of it.
  const [a, b] = await Promise.allSettled([
    store.write(editedA, etag),
    store.write(editedB, etag),
  ]);

  const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
  const rejected = [a, b].filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactly one of the two overlapping writes should succeed");
  assert.equal(rejected.length, 1, "the other should be refused, not silently discarded");
  assert.ok(rejected[0].status === "rejected" && rejected[0].reason instanceof StaleEtagError);

  const winner = fulfilled[0].status === "fulfilled" ? fulfilled[0].value : undefined;
  assert.ok(winner);
  assert.equal(winner.etag, etagOf(await readRaw(file)));
});

// ---------------------------------------------------------------------------
// The cleanup path
// ---------------------------------------------------------------------------

test("a writeFile failure is cleaned up: no .tmp file survives it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "editor-store-nodir-"));
  // The parent of this path is never created, so writeFile(tmp, ...) fails —
  // this is what makes the catch branch in write() actually run, rather than
  // the etag check refusing the write before any tmp file is attempted.
  const file = join(dir, "missing-subdir", "content.es.json");
  const store = new DatasetStore(file);
  const data = JSON.parse(canonical) as ContentDataset;

  await assert.rejects(() => store.write(data, "irrelevant"));
  assert.deepEqual(await readdir(dir), []);
});
