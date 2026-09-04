/**
 * The routes, as a pure function from a request to a response.
 *
 * Nothing here imports `node:http`. That is what lets every route be tested
 * without binding a port, and it keeps the HTTP layer down to what HTTP
 * actually is: reading a body, writing a status.
 *
 * The status codes carry meaning the form depends on. 422 is "your data is
 * wrong, here is where"; 409 is "the file moved underneath you, reload"; a
 * validation REPORT is 200, because being told your draft is invalid is a
 * successful request.
 */

import { datasetDescriptor } from "./schema-adapter";
import { HINTS } from "./hints";
import { inspectDataset } from "./inspect";
// DatasetApi is structural: a test can pass `{ read, write }` without
// constructing a DatasetStore. The class's private members would make that
// a compile error if this were typed as DatasetStore itself.
import type { DatasetApi } from "./store";
import { InvalidDatasetError, StaleEtagError } from "./store";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const json = (status: number, body: unknown): ApiResponse => ({ status, body });

/** The report the form renders. GET and PUT have to return the same shape. */
function refused(err: unknown): ApiResponse | null {
  if (err instanceof InvalidDatasetError) {
    return json(422, { zodIssues: err.report.zodIssues, violations: err.report.violations });
  }
  return null;
}

/** `{ data, etag }`, or null when the client sent something else. */
function readEnvelope(body: unknown): { data: unknown; etag: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as { data?: unknown; etag?: unknown };
  if (typeof candidate.etag !== "string") return null;
  if (!("data" in candidate)) return null;
  return { data: candidate.data, etag: candidate.etag };
}

export async function handleApi(request: ApiRequest, store: DatasetApi): Promise<ApiResponse> {
  const { method, path } = request;

  if (path === "/api/schema") {
    if (method !== "GET") return json(405, { message: "GET only." });
    return json(200, { schema: datasetDescriptor, hints: HINTS });
  }

  if (path === "/api/validate") {
    if (method !== "POST") return json(405, { message: "POST only." });
    return json(200, inspectDataset(request.body));
  }

  if (path === "/api/dataset") {
    if (method === "GET") {
      try {
        return json(200, await store.read());
      } catch (err) {
        // Opening the editor after a bad merge has to show what is wrong,
        // not a bare 500 whose message is the exception's constructor name.
        const response = refused(err);
        if (response) return response;
        throw err;
      }
    }

    if (method === "PUT") {
      const envelope = readEnvelope(request.body);
      if (!envelope) {
        return json(400, { message: 'Expected a body shaped { "data": ..., "etag": "..." }.' });
      }
      try {
        return json(200, await store.write(envelope.data, envelope.etag));
      } catch (err) {
        const response = refused(err);
        if (response) return response;
        if (err instanceof StaleEtagError) {
          return json(409, { message: err.message, etag: err.currentEtag });
        }
        // SerializationError (and anything else) is not ours to interpret —
        // it means our own code produced text that does not round-trip, a bug
        // rather than a bad request, so it escapes to the server's 500.
        throw err;
      }
    }

    return json(405, { message: "GET or PUT only." });
  }

  return json(404, { message: `No route for ${method} ${path}.` });
}
