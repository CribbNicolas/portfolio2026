/**
 * The pure pieces of `functions/cv.pdf.ts`.
 *
 * It lives with a leading underscore on purpose: Cloudflare Pages excludes
 * anything starting with `_` from routing, so this file can be imported without
 * showing up as a public URL. The handler keeps the part that touches network
 * and cache; everything decidable without I/O lives here, and that is why it
 * has tests (`_pdf.test.ts`) with no Worker to start.
 */

import { PDF_OPTIONS, LOAD_WAIT } from "../scripts/pdf-options";

/**
 * The page that gets printed. It is the SAME one `scripts/build-pdf.ts` prints
 * locally: one layout, `src/pages/cv.astro`, and both PDFs come out of it.
 */
export const SOURCE_PATH = "/cv";

/** The name it is saved under when `PDF_FILENAME` is not configured. */
export const DEFAULT_FILENAME = "cv.pdf";

/**
 * One hour. The dataset changes per deploy, not per minute, and every miss eats
 * into the Browser Rendering budget (10 browser minutes per day on the free
 * plan, ~3-5 s per render). With this TTL the real cost is one render per
 * deploy plus the odd miss per colo.
 */
export const CACHE_SECONDS = 3600;

/** How long we wait for Browser Rendering before cutting off and returning 504. */
export const TIMEOUT_MS = 45_000;

export function browserRenderingEndpoint(account: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/pdf`;
}

/**
 * The body of the POST to Browser Rendering.
 *
 * `url` is built from the request's origin and not from a constant: that way
 * the Function prints the preview when it runs in a Pages preview and
 * production when it runs in production, with no per-environment config. A
 * hard-coded `SITE_URL` would make a branch's smoke test main's PDF, which is
 * exactly the bug the smoke exists to catch.
 */
export function requestBody(origin: string): string {
  return JSON.stringify({
    url: new URL(SOURCE_PATH, origin).toString(),
    pdfOptions: PDF_OPTIONS,
    gotoOptions: { waitUntil: LOAD_WAIT },
  });
}

/**
 * The cache key, normalized.
 *
 * The query string is dropped: `/cv.pdf?utm_source=linkedin` is the same PDF as
 * `/cv.pdf`, and without normalizing, every campaign with its own parameter
 * would be a miss — that is, a paid render — per visitor.
 */
export function cacheKey(requestedUrl: string): Request {
  const url = new URL(requestedUrl);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

/**
 * `attachment` and not `inline`: the landing button is "Descargar CV".
 * `inline` plus the HTML `download` attribute makes Chrome's download
 * manager report the file as missing, and without `download` the click
 * opens `/cv.pdf` in the tab — which looks like `/cv`. The name still
 * travels, so the save is not a nameless `download.pdf`.
 */
export function pdfHeaders(filename: string): Headers {
  return new Headers({
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": `public, max-age=${CACHE_SECONDS}`,
    // The CV is public and is consumed by agents and recruiting scrapers.
    "access-control-allow-origin": "*",
    // The PDF comes from our own `/cv`. If the content-type ever arrived wrong,
    // do not let the browser guess.
    "x-content-type-options": "nosniff",
  });
}
