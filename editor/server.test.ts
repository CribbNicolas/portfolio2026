/**
 * What the HTTP layer adds on top of `handleApi`: reading a body, writing a
 * status, refusing a body too large to be a dataset.
 *
 * One pass over the wire. The routes themselves are covered in `api.test.ts`
 * and are not repeated here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import type { AddressInfo } from "node:net";

import { DatasetStore } from "./store";
import { createEditorServer } from "./server";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

/** Binds port 0 — the OS picks a free one, so the test never collides with 4322. */
async function serve(): Promise<{ base: string; close: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "editor-server-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");

  const server = createEditorServer(new DatasetStore(file));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
  };
}

test("GET /api/dataset answers JSON over the wire", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/api/dataset`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as { data: { locale: string }; etag: string };
    assert.equal(body.data.locale, "es");
  } finally {
    await close();
  }
});

test("a PUT with a stale etag comes back as 409", async () => {
  const { base, close } = await serve();
  try {
    const current = (await (await fetch(`${base}/api/dataset`)).json()) as { data: unknown };
    const res = await fetch(`${base}/api/dataset`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: current.data, etag: "stale" }),
    });
    assert.equal(res.status, 409);
  } finally {
    await close();
  }
});

test("a body that is not JSON is 400, not a crash", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("a path with no file behind it is a 404", async () => {
  const { base, close } = await serve();
  try {
    // `editor/public/` arrives in the next task; until then every path is a
    // miss, and a miss must be a clean 404 rather than a crash.
    assert.equal((await fetch(`${base}/nope.js`)).status, 404);
    assert.equal((await fetch(`${base}/`)).status, 404);
  } finally {
    await close();
  }
});

test("a client that disconnects mid-body does not take the server down", async () => {
  const { base, close } = await serve();
  try {
    const { port } = new URL(base);

    // Open a raw connection so we can send a Content-Length the body never
    // reaches: `fetch` has no way to abandon a request mid-stream the way a
    // closed tab or a killed curl does.
    await new Promise<void>((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port: Number(port) }, () => {
        const head =
          "PUT /api/dataset HTTP/1.1\r\n" +
          "Host: 127.0.0.1\r\n" +
          "Content-Type: application/json\r\n" +
          "Content-Length: 1000000\r\n" +
          "\r\n" +
          '{"data":';
        // Destroy only once the bytes are actually handed to the kernel —
        // destroying right after `.write()` can race the write and leave the
        // server with nothing to have received at all.
        socket.write(head, () => socket.destroy());
      });
      socket.on("close", () => resolve());
      // A reset from the far end is exactly what this test is causing.
      socket.on("error", () => {});
    });

    // The real assertion: the server is still alive and answering. If the
    // process had died on the unhandled rejection, or the handler had wedged
    // on the aborted read, this request would never come back.
    const res = await fetch(`${base}/api/dataset`);
    assert.equal(res.status, 200);
  } finally {
    await close();
  }
});
