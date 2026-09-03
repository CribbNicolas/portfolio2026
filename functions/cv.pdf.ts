/**
 * `/cv.pdf` — the Spanish CV printed on demand.
 *
 * The route is this file's own path: Pages Functions map file location to
 * URL, so `createPdfHandler("es")` living HERE is what makes it answer `/cv`
 * and not `/en/cv`. The handler itself — cache, Browser Rendering, error
 * shapes — lives in `_handler.ts`, shared with `functions/en/cv.pdf.ts`; see
 * that file's header for why a factory and not a copy-paste.
 */

import { createPdfHandler } from "./_handler";

export const onRequestGet = createPdfHandler("es");

/**
 * HEAD answers the same as GET, without a body.
 *
 * Without this, Pages does not match the request against the Function —
 * `onRequestGet` is GET ONLY — and the static asset handler serves it. Measured
 * against the deploy: `HEAD /cv.pdf` returned `200 text/html`, byte for byte
 * the same response as `HEAD /a-route-that-does-not-exist`. Anyone doing a HEAD
 * before downloading — link unfurlers, recruiting crawlers, monitoring checks —
 * saw an HTML page where they expected a PDF.
 *
 * Reusing the handler is correct: the runtime discards the body of a response
 * to HEAD. And it does not duplicate renders, because `cacheKey` always builds
 * a GET, so a HEAD after the first render hits the same cache.
 */
export const onRequestHead = onRequestGet;
