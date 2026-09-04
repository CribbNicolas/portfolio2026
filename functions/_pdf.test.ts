/**
 * Tests of the pure pieces shared by `/cv.pdf` and `/en/cv.pdf`.
 *
 * They deliberately do not start a Worker: what can break silently here is the
 * BODY sent to Browser Rendering (the served PDF no longer asking for the same
 * options as the tested PDF, or the two locales drifting from each other), the
 * cache key (every `?utm_source=` spending a render), and — since this task —
 * the English route quietly printing the Spanish page. Both are verified with
 * no network.
 *
 * That the resulting PDF parses is verified by `pdf-output.check.ts`, which
 * runs against the real bytes — locally against `dist/{,en/}cv.pdf` and
 * post-deploy against the published URLs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_OPTIONS, LOAD_WAIT } from "../scripts/pdf-options";
import {
  defaultFilename,
  sourcePath,
  CACHE_SECONDS,
  pdfHeaders,
  cacheKey,
  requestBody,
  browserRenderingEndpoint,
} from "./_pdf";

test("the English handler prints the English page", () => {
  // A copy-paste of the Spanish handler would serve the SPANISH CV under an
  // English URL, and every other test in this file would still pass.
  const body = JSON.parse(requestBody("https://example.com", "en"));
  assert.equal(body.url, "https://example.com/en/cv");
});

test("the Spanish handler is unchanged", () => {
  assert.equal(JSON.parse(requestBody("https://example.com", "es")).url, "https://example.com/cv");
});

test("both print with the same options", () => {
  // The whole reason `pdf-options.ts` exists: the tested PDF and the served one
  // cannot diverge. Neither can the two languages.
  const es = JSON.parse(requestBody("https://example.com", "es"));
  const en = JSON.parse(requestBody("https://example.com", "en"));
  assert.deepEqual(es.pdfOptions, en.pdfOptions);
  assert.deepEqual(es.gotoOptions, en.gotoOptions);
});

test("the body asks for exactly the same options as the PDF under test", () => {
  // This is THE test of the file. If someone touches the options on one side
  // only, the PDF people download stops being the PDF that passed `test:pdf`
  // and nobody finds out. That is why `pdf-options.ts` is a single source and
  // this guards it.
  const body = JSON.parse(requestBody("https://example.com", "es"));
  assert.deepEqual(body.pdfOptions, PDF_OPTIONS);
  assert.equal(body.gotoOptions.waitUntil, LOAD_WAIT);
});

test("tagged and outline travel in the request", () => {
  // Deliberately redundant with the test above: if someone decided to remove
  // `tagged` from `PDF_OPTIONS`, that test would stay green (it compares
  // against the same constant that changed). This one fails, and the message
  // says what was lost.
  const { pdfOptions } = JSON.parse(requestBody("https://example.com", "es"));
  assert.equal(pdfOptions.tagged, true, "without tagged the PDF loses its explicit reading order");
  assert.equal(pdfOptions.outline, true, "without outline the PDF has no per-section bookmarks");
});

test("it prints /cv from the SAME origin that received the request", () => {
  // A hard-coded origin would make a preview's smoke test the production PDF,
  // which is exactly the bug the smoke exists to catch.
  const { url } = JSON.parse(requestBody("https://staging.portfolio2026.pages.dev", "es"));
  assert.equal(url, `https://staging.portfolio2026.pages.dev${sourcePath("es")}`);
});

test("it prints /en/cv from the SAME origin that received the request", () => {
  const { url } = JSON.parse(requestBody("https://staging.portfolio2026.pages.dev", "en"));
  assert.equal(url, `https://staging.portfolio2026.pages.dev${sourcePath("en")}`);
});

test("the origin is respected even with a port or a path", () => {
  const { url } = JSON.parse(requestBody("http://127.0.0.1:8788", "es"));
  assert.equal(url, `http://127.0.0.1:8788${sourcePath("es")}`);
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

test("the cache key keeps the two locales apart", () => {
  // `/cv.pdf` and `/en/cv.pdf` are different files; the locale already lives
  // in the path, so this just confirms nothing normalizes it away.
  const es = cacheKey("https://example.com/cv.pdf");
  const en = cacheKey("https://example.com/en/cv.pdf");
  assert.notEqual(es.url, en.url);
});

test("the headers declare PDF, filename and TTL", () => {
  const h = pdfHeaders(defaultFilename("es"));
  assert.match(
    h.get("content-disposition") ?? "",
    /^attachment; filename="Cribb_Nicolas_CV_\d{4}-\d{2}-\d{2}\.pdf"$/,
  );
  assert.equal(h.get("content-type"), "application/pdf");
  assert.equal(h.get("cache-control"), `public, max-age=${CACHE_SECONDS}`);
  assert.equal(h.get("x-content-type-options"), "nosniff");
});

test("the default filename is a .pdf, per locale", () => {
  // `content-disposition` with an extensionless name makes Windows save a file
  // that opens with nothing.
  assert.match(defaultFilename("es"), /\.pdf$/);
  assert.match(defaultFilename("en"), /\.pdf$/);
});

test("the English filename carries the EN tag, the Spanish one does not", () => {
  // `pdfFilename` already tests this in isolation; this confirms the Function
  // actually calls it per-locale rather than reusing one constant for both.
  assert.match(defaultFilename("en"), /_EN_\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.doesNotMatch(defaultFilename("es"), /_EN_/);
});
