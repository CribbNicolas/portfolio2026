/**
 * Tests of the pure pieces of `/cv.pdf`.
 *
 * They deliberately do not start a Worker: what can break silently here is the
 * BODY sent to Browser Rendering (the served PDF no longer asking for the same
 * options as the tested PDF) and the cache key (every `?utm_source=` spending a
 * render). Both are verified with no network.
 *
 * That the resulting PDF parses is verified by `pdf-output.check.ts`, which
 * runs against the real bytes — locally against `dist/cv.pdf` and post-deploy
 * against the published URL.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_OPTIONS, LOAD_WAIT } from "../scripts/pdf-options";
import {
  DEFAULT_FILENAME,
  SOURCE_PATH,
  CACHE_SECONDS,
  pdfHeaders,
  cacheKey,
  requestBody,
  browserRenderingEndpoint,
} from "./_pdf";

test("the body asks for exactly the same options as the PDF under test", () => {
  // This is THE test of the file. If someone touches the options on one side
  // only, the PDF people download stops being the PDF that passed `test:pdf`
  // and nobody finds out. That is why `pdf-options.ts` is a single source and
  // this guards it.
  const body = JSON.parse(requestBody("https://example.com"));
  assert.deepEqual(body.pdfOptions, PDF_OPTIONS);
  assert.equal(body.gotoOptions.waitUntil, LOAD_WAIT);
});

test("tagged and outline travel in the request", () => {
  // Deliberately redundant with the test above: if someone decided to remove
  // `tagged` from `PDF_OPTIONS`, that test would stay green (it compares
  // against the same constant that changed). This one fails, and the message
  // says what was lost.
  const { pdfOptions } = JSON.parse(requestBody("https://example.com"));
  assert.equal(pdfOptions.tagged, true, "without tagged the PDF loses its explicit reading order");
  assert.equal(pdfOptions.outline, true, "without outline the PDF has no per-section bookmarks");
});

test("it prints /cv from the SAME origin that received the request", () => {
  // A hard-coded origin would make a preview's smoke test the production PDF,
  // which is exactly the bug the smoke exists to catch.
  const { url } = JSON.parse(requestBody("https://staging.portfolio2026.pages.dev"));
  assert.equal(url, `https://staging.portfolio2026.pages.dev${SOURCE_PATH}`);
});

test("the origin is respected even with a port or a path", () => {
  const { url } = JSON.parse(requestBody("http://127.0.0.1:8788"));
  assert.equal(url, `http://127.0.0.1:8788${SOURCE_PATH}`);
});

test("the endpoint points at the account it is given", () => {
  assert.equal(
    browserRenderingEndpoint("abc123"),
    "https://api.cloudflare.com/client/v4/accounts/abc123/browser-rendering/pdf",
  );
});

test("the cache key drops the query string", () => {
  // Without this, every campaign with its own `utm_` is a paid render per
  // visitor and the daily budget goes on traffic asking for the same file.
  const withQuery = cacheKey("https://example.com/cv.pdf?utm_source=linkedin");
  const withoutQuery = cacheKey("https://example.com/cv.pdf");
  assert.equal(withQuery.url, withoutQuery.url);
  assert.equal(withQuery.url, "https://example.com/cv.pdf");
});

test("the cache key drops the fragment", () => {
  const withHash = cacheKey("https://example.com/cv.pdf#page2");
  assert.equal(withHash.url, "https://example.com/cv.pdf");
});

test("the headers declare PDF, filename and TTL", () => {
  const h = pdfHeaders(DEFAULT_FILENAME);
  assert.match(
    h.get("content-disposition") ?? "",
    /^attachment; filename="Cribb_Nicolas_CV_\d{4}-\d{2}-\d{2}\.pdf"$/,
  );
  assert.equal(h.get("content-type"), "application/pdf");
  assert.equal(h.get("cache-control"), `public, max-age=${CACHE_SECONDS}`);
  assert.equal(h.get("x-content-type-options"), "nosniff");
});

test("the default filename is a .pdf", () => {
  // `content-disposition` with an extensionless name makes Windows save a file
  // that opens with nothing.
  assert.match(DEFAULT_FILENAME, /\.pdf$/);
});
