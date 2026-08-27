/**
 * Verifies the PUBLISHED site, not the `dist/` the build produced.
 *
 * It exists because of a concrete blind spot: `no-client-js.check.ts` and the
 * other checks read files from `dist/`. Anything happening after the build — a
 * Cloudflare injection at the edge, a transform rule, a misplaced `_headers` —
 * is invisible to them.
 *
 * The case that motivated it is not hypothetical: enabling Cloudflare Web
 * Analytics from the Pages dashboard injects its beacon into the WHOLE site on
 * the next deploy. That would put JavaScript on `/cv`, which is where Browser
 * Rendering prints the PDF from, and all five checks would stay green because
 * `dist/` did not change (docs/05 §3 step 8).
 *
 * It runs from `smoke-deploy.yml`, after every deploy, against the real URL.
 *
 * `SITE` is the base with no trailing slash:
 * `SITE=https://cribbnicolas.pages.dev`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const SITE = process.env.SITE?.replace(/\/+$/, "");

if (!SITE) {
  throw new Error(
    "SITE is missing. Example: SITE=https://cribbnicolas.pages.dev pnpm run test:served",
  );
}

/** One read per route: every extra test would be another request. */
const cache = new Map<string, Promise<Response>>();
const get = (path: string): Promise<Response> => {
  const url = `${SITE}${path}`;
  if (!cache.has(url)) cache.set(url, fetch(url));
  return cache.get(url)!.then((r) => r.clone());
};

/**
 * The same fingerprints `no-client-js.check.ts` looks for over `dist/`. They
 * are repeated on purpose rather than imported: if they ever diverge, it is
 * because somebody touched one of the two and both need looking at.
 */
const ANALYTICS_FINGERPRINTS = ["clarity", "cloudflareinsights", "cf-beacon"];

test("the served `/cv` executes no JavaScript", async () => {
  const res = await get("/cv/");
  assert.equal(res.status, 200, `/cv/ returned ${res.status}`);
  const html = await res.text();

  const external = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
  assert.deepEqual(
    external,
    [],
    `the served /cv loads JS: ${external.join(", ")}. The dist/ can be clean and ` +
      "this still happen: something injected it after the build. Suspect Web " +
      "Analytics enabled from the Pages dashboard (docs/05 §3 step 8).",
  );
});

test("the served `/cv` carries no analytics", async () => {
  const html = await (await get("/cv/")).text();
  const found = ANALYTICS_FINGERPRINTS.filter((h) => html.toLowerCase().includes(h));
  assert.deepEqual(
    found,
    [],
    `the served /cv mentions ${found.join(", ")}. The PDF comes out of that page: ` +
      "a third-party script there changes the render and no PDF test notices, " +
      "because the extracted text stays the same.",
  );
});

test("a non-existent route returns 404, not 200", async () => {
  // The soft 404 we fixed with `src/pages/404.astro`. That the file exists is
  // verified by `single-landing.check.ts`; that Pages serves it with the right
  // status can only be seen from the outside.
  const res = await get("/this-route-never-exists");
  assert.equal(
    res.status,
    404,
    `a made-up route returned ${res.status}. With a 200 the soft 404 is back: ` +
      "crawlers treat the broken URL as a valid page.",
  );
});
