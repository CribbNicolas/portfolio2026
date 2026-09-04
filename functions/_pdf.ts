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
import { sourcePath } from "../src/lib/anchors";
// Re-export so existing callers (`_pdf.test.ts`, `pdf-check-locales.ts`) keep
// one import. The definition lives next to ANCHORS: a third locale is a
// compile error in that table, not a ternary that silently returns English.
export { sourcePath };

/**
 * The name it is saved under, from THAT locale's own dataset — not the
 * Spanish one for both. The filename is always derived from `updatedAt`
 * to keep a file's saved name in sync with its content's date: a drift
 * (name vs content) has to be fixed in the data, not by rotating an env var.
 */
export const defaultFilename = (locale: Locale): string =>
  pdfFilename(locale, (locale === "es" ? datasetEs : datasetEn).updatedAt);

/**
 * How long the EDGE keeps a rendered PDF: thirty days.
 *
 * It used to be one hour, and one hour was a bad trade. Every expiry hands the
 * next visitor a render, each render eats the Browser Rendering budget (10
 * browser minutes a day on the free plan, ~3-5 s each), and when that budget
 * is gone the visitor gets `pdfQuotaExceeded` instead of a CV. Observed in
 * production on 2026-09-04, during a day of deploys: `/cv.pdf` answered 429.
 * A month of edge cache makes the steady-state cost one render per deploy per
 * colo, which is what it should always have been.
 *
 * A month is only safe because the key is deploy-scoped — see `cacheKey`.
 * Without that, editing the dataset would leave the old CV downloadable for a
 * month, which is a far worse failure than a 429.
 */
export const CACHE_SECONDS = 2_592_000;

/**
 * How long the VISITOR'S BROWSER keeps it: one hour.
 *
 * Deliberately not `CACHE_SECONDS`. The edge cache is keyed by deploy and a
 * new deploy makes a new key; a browser cache is keyed by URL and `/cv.pdf`
 * never changes, so a month there would mean a returning visitor holding a
 * superseded CV with no way for us to reach it. `s-maxage` in the same header
 * is what lets the two differ: shared caches take it, browsers ignore it.
 */
export const BROWSER_CACHE_SECONDS = 3600;

/**
 * The query parameter that forces a re-render, and the ONLY one `cacheKey`
 * does not strip.
 *
 * It is worth a token because it is a paid button: without one, a bored
 * visitor with `?refresh=1` in a loop spends the day's Browser Rendering
 * budget and every real download after that answers 429. With a wrong or
 * missing token the parameter is ignored exactly like `utm_source`, so a probe
 * cannot tell it from any other unknown parameter.
 */
export const REFRESH_PARAM = "refresh";

/**
 * Does this request ask for a fresh render, with the right token?
 *
 * The comparison is not constant-time and does not need to be: the secret
 * guards a render, not data, and the attack it would enable — learning the
 * token one character at a time through response timing across the public
 * internet — costs more renders than simply making requests.
 */
export function isRefreshRequest(requestedUrl: string, token: string | undefined): boolean {
  if (!token) return false;
  return new URL(requestedUrl).searchParams.get(REFRESH_PARAM) === token;
}

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
 * The cache key: normalized, and scoped to the deploy that produced the bytes.
 *
 * The query string is dropped: `/cv.pdf?utm_source=linkedin` is the same PDF as
 * `/cv.pdf`, and without normalizing, every campaign with its own parameter
 * would be a miss — that is, a paid render — per visitor. The locale already
 * lives in the path (`/cv.pdf` vs `/en/cv.pdf`), so the two never collide.
 *
 * `version` is the published commit, and it is what makes a thirty-day TTL
 * safe: a dataset edit ships as a deploy, a deploy is a new commit, a new
 * commit is a new key, and the first request after it renders again. Nobody
 * has to remember to purge anything. When the version cannot be read the key
 * falls back to an explicit `unknown` rather than to no version at all — a
 * missing segment would collide with whatever a previous deploy stored under
 * that same shorter key.
 */
export function cacheKey(requestedUrl: string, version = "unknown"): Request {
  const url = new URL(requestedUrl);
  url.search = "";
  url.hash = "";
  // A query parameter and not a path segment: the key is never fetched, only
  // compared, and this keeps the URL recognizable in a cache inspector.
  url.searchParams.set("v", version);
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
    "cache-control": `public, max-age=${BROWSER_CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    // The CV is public and is consumed by agents and recruiting scrapers.
    "access-control-allow-origin": "*",
    // The PDF comes from our own `/cv`. If the content-type ever arrived wrong,
    // do not let the browser guess.
    "x-content-type-options": "nosniff",
  });
}
