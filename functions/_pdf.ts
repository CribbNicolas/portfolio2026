/**
 * The pure pieces shared by `functions/cv.pdf.ts` and `functions/en/cv.pdf.ts`.
 *
 * It lives with a leading underscore on purpose: Cloudflare Pages excludes
 * anything starting with `_` from routing, so this file can be imported without
 * showing up as a public URL. The handler (`_handler.ts`) keeps the part that
 * touches network and cache; everything decidable without I/O lives here, and
 * that is why it has tests (`_pdf.test.ts`) with no Worker to start.
 */

import type { Locale } from "../content/schema/content-schema";
import { PDF_OPTIONS, LOAD_WAIT } from "../scripts/pdf-options";
// Relative imports, not `@content`: a Cloudflare Worker build does not resolve
// that alias, only `astro build` does. Neither `pdf-filename.ts` nor
// `messages.ts` depends on the rest of the content layer, so importing them
// directly costs nothing — and both datasets are imported for ONE field each
// (`updatedAt`), same reasoning as before the split.
import datasetEs from "../content/data/content.es.json";
import datasetEn from "../content/data/content.en.json";
import { pdfFilename } from "../content/schema/pdf-filename";

/**
 * The page that gets printed, per locale. Same layout, two callers: `/cv`
 * prints `src/pages/cv.astro`, `/en/cv.pdf` prints `src/pages/en/cv.astro`. It
 * is the SAME pair `scripts/build-pdf.ts` prints locally.
 */
export const sourcePath = (locale: Locale): string => (locale === "es" ? "/cv" : `/${locale}/cv`);

/**
 * The name it is saved under, from THAT locale's own dataset — not the
 * Spanish one for both. The filename is always derived from `updatedAt`
 * to keep a file's saved name in sync with its content's date: a drift
 * (name vs content) has to be fixed in the data, not by rotating an env var.
 */
export const defaultFilename = (locale: Locale): string =>
  pdfFilename(locale, (locale === "es" ? datasetEs : datasetEn).updatedAt);

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
 *
 * `pdfOptions`/`gotoOptions` do not vary by locale — that is the whole reason
 * `pdf-options.ts` exists as a single source, and the two languages must not
 * drift from each other any more than the tested and served PDFs may.
 */
export function requestBody(origin: string, locale: Locale): string {
  return JSON.stringify({
    url: new URL(sourcePath(locale), origin).toString(),
    pdfOptions: PDF_OPTIONS,
    gotoOptions: { waitUntil: LOAD_WAIT },
  });
}

/**
 * The cache key, normalized.
 *
 * The query string is dropped: `/cv.pdf?utm_source=linkedin` is the same PDF as
 * `/cv.pdf`, and without normalizing, every campaign with its own parameter
 * would be a miss — that is, a paid render — per visitor. The locale already
 * lives in the path (`/cv.pdf` vs `/en/cv.pdf`), so the two never collide.
 */
export function cacheKey(requestedUrl: string): Request {
  const url = new URL(requestedUrl);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

/**
 * `attachment` and not `inline`: the landing button is "Descargar CV" (or its
 * English counterpart). `inline` plus the HTML `download` attribute makes
 * Chrome's download manager report the file as missing, and without
 * `download` the click opens the PDF in the tab — which looks like `/cv`. The
 * name still travels, so the save is not a nameless `download.pdf`.
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
