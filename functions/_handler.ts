/**
 * The shared body of `/cv.pdf` and `/en/cv.pdf` — the CV printed on demand.
 *
 * This used to be a static file `pnpm run build` generated with Playwright.
 * That tied the build to an installed Chromium, which is why the build could
 * not run on Cloudflare. Now the build is `astro build` and nothing else, and
 * printing moved to runtime: this Function asks Browser Rendering to print our
 * own `/cv` (or `/en/cv`) and returns the bytes.
 *
 * Intended consequence beyond the build: the day the data comes from an API,
 * the PDF is up to date without anybody regenerating a file. All that is needed
 * is for the source page to be up to date, and the deploy takes care of that.
 *
 * The Browser Rendering binding is NOT available in Pages Functions (only KV,
 * D1, R2, DO, Queues, AI and service bindings). That is why the REST API with a
 * token is used, which is an ordinary `fetch`.
 *
 * The source page has to stay at zero JavaScript, in EITHER locale. A script
 * slipping in used to break your build; now it breaks the PDF in production.
 * The invariant did not change, its price went up.
 * `scripts/no-client-js.check.ts` verifies it.
 *
 * The messages returned to the visitor follow the locale being printed: they
 * are site-facing text, same as the CV content (`content/schema/messages.ts`).
 *
 * ONE factory and not two files with a copy-pasted body: a copy-paste is
 * exactly how the Spanish handler would end up serving the Spanish CV under
 * `/en/cv.pdf` the day someone edited one and forgot the other.
 * `functions/cv.pdf.ts` and `functions/en/cv.pdf.ts` are three-line callers of
 * `createPdfHandler`; Pages routes by the file's own path, so where each of
 * those two files LIVES is what makes the route.
 */

import type { Locale } from "../content/schema/content-schema";
import { MESSAGES } from "../content/schema/messages";
import {
  defaultFilename,
  TIMEOUT_MS,
  pdfHeaders,
  cacheKey,
  requestBody,
  browserRenderingEndpoint,
} from "./_pdf";

interface Env {
  /** Cloudflare Account ID. Not a secret, but configured anyway. */
  BROWSER_RENDERING_ACCOUNT_ID?: string;
  /** Token with ONE permission: Browser Rendering → Edit. Goes in as a secret. */
  BROWSER_RENDERING_TOKEN?: string;
  /** Optional. The name it is saved under by whoever downloads it. */
  PDF_FILENAME?: string;
}

/**
 * The context Pages hands to the Function. Declared by hand rather than pulling
 * in `@cloudflare/workers-types`: that package redefines DOM globals and the
 * `tsconfig` here compiles `src/` with `lib: ["ES2022","DOM"]`. Three fields do
 * not justify fighting with that.
 */
interface Context {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

/** `caches.default` is Cloudflare's and is not in the DOM `CacheStorage`. */
const edgeCache = (caches as unknown as { default: Cache }).default;

function error(status: number, message: string): Response {
  // No permissive `cache-control`: a failure is not cached. And the body
  // re-exposes nothing from the API response — the account ID can be in there.
  return new Response(`${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Builds the `onRequestGet` handler for one locale. `functions/cv.pdf.ts` is
 * `createPdfHandler("es")`; `functions/en/cv.pdf.ts` is
 * `createPdfHandler("en")`. Everything below was, before this task, the body
 * of `functions/cv.pdf.ts` itself, with `SOURCE_PATH`/`DEFAULT_FILENAME`/the
 * Spanish literals replaced by their locale-aware equivalents.
 */
export function createPdfHandler(locale: Locale) {
  const m = MESSAGES[locale];

  return async function onRequestGet(context: Context): Promise<Response> {
    const { request, env, waitUntil } = context;

    const account = env.BROWSER_RENDERING_ACCOUNT_ID;
    const token = env.BROWSER_RENDERING_TOKEN;
    if (!account || !token) {
      // 503 and not 500: the site is fine, configuration is missing. It is
      // told apart in the logs from a Browser Rendering failure, which is 502.
      return error(503, m.pdfUnconfigured);
    }

    const key = cacheKey(request.url);
    const cached = await edgeCache.match(key);
    if (cached) return cached;

    let response: Response;
    try {
      response = await fetch(browserRenderingEndpoint(account), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: requestBody(new URL(request.url).origin, locale),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Timeout or network down. 504 so it is clear this is not a 4xx of ours.
      return error(504, m.pdfTimeout);
    }

    if (!response.ok) {
      // 429 = the daily Browser Rendering budget is used up. It is propagated
      // as is, with Retry-After if it came, because it is the only signal
      // telling "quota" apart from "broken" when somebody looks at this in six
      // months.
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const r = error(429, m.pdfQuotaExceeded);
        if (retryAfter) r.headers.set("retry-after", retryAfter);
        return r;
      }
      return error(502, m.pdfGenerationFailed);
    }

    const bytes = await response.arrayBuffer();
    const pdf = new Response(bytes, {
      headers: pdfHeaders(env.PDF_FILENAME ?? defaultFilename(locale)),
    });

    // `clone()` because a Response can be read once and we have to return one
    // and store the other. `waitUntil` so the visitor does not wait for the
    // cache write.
    waitUntil(edgeCache.put(key, pdf.clone()));
    return pdf;
  };
}
