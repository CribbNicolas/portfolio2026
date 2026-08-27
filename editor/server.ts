/**
 * The HTTP layer, and nothing more: read a body, hand it to `handleApi`, write
 * the answer.
 *
 * Standard library only. The precedent is `scripts/build-pdf.ts`, whose
 * thirty-line server carries the comment that adding a dependency for this
 * would be more maintenance surface than the problem it solves.
 *
 * It does not call `listen`: `scripts/editor.ts` binds the port. That split is
 * what lets the test bind port 0 instead of fighting over 4322.
 *
 * Static files are not served yet — `editor/public/` arrives with the page in
 * PR 3, and serving a directory that does not exist would be scaffolding no
 * test could hold down.
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";

import { handleApi } from "./api";
import type { DatasetStore } from "./store";

/** The editor's port. 4322 sits next to Astro's 4321 on purpose. */
export const EDITOR_PORT = 4322;

/** The dataset is ~30 KB. Anything near this ceiling is a mistake, not an edit. */
export const MAX_BODY_BYTES = 5_000_000;

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createEditorServer(store: DatasetStore): Server {
  return createServer((req, res) => {
    void (async () => {
      const send = (status: number, body: unknown): void => {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body, null, 2));
      };

      const path = (req.url ?? "/").split("?")[0];
      const method = req.method ?? "GET";

      if (!path.startsWith("/api/")) {
        send(404, {
          message: "The editor page arrives in PR 3. The API is under /api/.",
        });
        return;
      }

      let body: unknown;
      if (method === "POST" || method === "PUT") {
        let raw: string;
        try {
          raw = await readBody(req);
        } catch (err) {
          if (err instanceof BodyTooLargeError) {
            send(413, { message: `Body over ${MAX_BODY_BYTES} bytes.` });
            return;
          }
          throw err;
        }
        try {
          body = JSON.parse(raw);
        } catch {
          send(400, { message: "The body is not valid JSON." });
          return;
        }
      }

      try {
        const answer = await handleApi({ method, path, body }, store);
        send(answer.status, answer.body);
      } catch (err) {
        // Nothing was written: `store.write` refuses before it touches the file.
        // Surfacing the message beats a hung request with no explanation.
        send(500, { message: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
}
