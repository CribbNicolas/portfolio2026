/**
 * Every route, without a socket.
 *
 * Routing is a pure function from a request to a response, so it is tested as
 * one. What an HTTP server adds on top — parsing a body, writing a status line —
 * is tested once in `server.test.ts` and does not need repeating per route.
 */

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ContentDataset } from "../content/schema/content-schema";
import { DatasetStore } from "./store";
import { handleApi } from "./api";
import { createTempDirs } from "./temp-dir";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

const tmp = createTempDirs();
after(() => tmp.cleanup());

async function freshStore(): Promise<{ store: DatasetStore; file: string }> {
  const dir = await tmp.dir("editor-api-");
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");
  return { store: new DatasetStore(file), file };
}

test("GET /api/schema hands over the descriptor tree", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "GET", path: "/api/schema" }, store);
  assert.equal(res.status, 200);
  const body = res.body as { schema: { kind: string; fields: Array<{ key: string }> } };
  assert.equal(body.schema.kind, "object");
  assert.equal(body.schema.fields[0].key, "schemaVersion");

  const withHints = res.body as { hints: Record<string, { widget: string }> };
  assert.equal(withHints.hints["achievements[].skillIds"].widget, "reference-list");
});

test("GET /api/dataset hands over the data and its etag", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "GET", path: "/api/dataset" }, store);
  assert.equal(res.status, 200);
  const body = res.body as { data: ContentDataset; etag: string };
  assert.equal(body.data.locale, "es");
  assert.ok(body.etag.length > 0);
});

test("GET of a dataset that is already invalid on disk is 422 with the report, not a thrown 500", async () => {
  const dir = await tmp.dir("editor-api-");
  const file = join(dir, "content.es.json");
  await writeFile(file, "{}\n", "utf8");
  const store = new DatasetStore(file);

  const res = await handleApi({ method: "GET", path: "/api/dataset" }, store);
  assert.equal(res.status, 422);
  const body = res.body as { zodIssues: Array<{ path: string }>; violations: unknown[] };
  assert.ok(body.zodIssues.length > 0, "the report that PUT already returns has to travel with GET too");
  assert.ok(Array.isArray(body.violations));
});

test("POST /api/validate answers 200 with a clean report for a good dataset", async () => {
  const { store } = await freshStore();
  const { data } = (await store.read());
  const res = await handleApi({ method: "POST", path: "/api/validate", body: data }, store);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, zodIssues: [], violations: [] });
});

test("POST /api/validate answers 200 for a BAD dataset too: a report is not an error", async () => {
  const { store } = await freshStore();
  const { data } = await store.read();
  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  const res = await handleApi({ method: "POST", path: "/api/validate", body: broken }, store);
  assert.equal(res.status, 200);
  const body = res.body as { ok: boolean; violations: Array<{ message: string }> };
  assert.equal(body.ok, false);
  assert.ok(body.violations.some((v) => v.message.includes("does-not-exist")));
});

test("PUT /api/dataset saves and returns the new etag", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  const edited = structuredClone(data) as ContentDataset;
  edited.identity.preferredName = "Nicolás";

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data: edited, etag } },
    store,
  );
  assert.equal(res.status, 200);
  assert.ok((await readFile(file, "utf8")).includes('"preferredName": "Nicolás"'));
});

test("PUT with a rule violation is 422 and writes nothing", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data: broken, etag } },
    store,
  );
  assert.equal(res.status, 422);
  const body = res.body as { violations: Array<{ message: string }> };
  assert.ok(body.violations.some((v) => v.message.includes("does-not-exist")));
  assert.equal(await readFile(file, "utf8"), canonical);
});

test("PUT with a stale etag is 409 and hands back the current one", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data, etag: "stale" } },
    store,
  );
  assert.equal(res.status, 409);
  assert.equal((res.body as { etag: string }).etag, etag);
  assert.equal(await readFile(file, "utf8"), canonical);
});

test("PUT without the envelope is 400, not a crash", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "PUT", path: "/api/dataset", body: { data: {} } }, store);
  assert.equal(res.status, 400);
});

test("a known path with the wrong method is 405", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "DELETE", path: "/api/dataset" }, store);
  assert.equal(res.status, 405);
});

test("an unknown path is 404", async () => {
  const { store } = await freshStore();
  assert.equal((await handleApi({ method: "GET", path: "/api/nope" }, store)).status, 404);
});

test("handleApi accepts a structural store, not only DatasetStore", async () => {
  await assert.rejects(
    () =>
      handleApi(
        { method: "GET", path: "/api/dataset" },
        {
          read: async () => {
            throw new Error("boom");
          },
          write: async () => {
            throw new Error("boom");
          },
        },
      ),
    { message: "boom" },
  );
});
