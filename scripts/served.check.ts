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
const get = async (path: string): Promise<Response> => {
  const url = `${SITE}${path}`;
  if (!cache.has(url)) cache.set(url, fetch(url));
  return (await cache.get(url)!).clone();
};

/**
 * The same fingerprints `no-client-js.check.ts` looks for over `dist/`. They
 * are repeated on purpose rather than imported: if they ever diverge, it is
 * because somebody touched one of the two and both need looking at.
 */
const ANALYTICS_FINGERPRINTS = ["clarity", "cloudflareinsights", "cf-beacon"];

/**
 * Both pages the PDF gets printed from. `/cv/` alone used to be the whole
 * list, from when it was the only one — `/en/cv/` is exactly as exposed to
 * an edge injection as its sibling, and nothing else here was watching it.
 */
const PRINTED_PAGES = ["/cv/", "/en/cv/"];

for (const path of PRINTED_PAGES) {
  test(`the served \`${path}\` executes no JavaScript`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200, `${path} returned ${res.status}`);
    const html = await res.text();

    const external = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
    assert.deepEqual(
      external,
      [],
      `the served ${path} loads JS: ${external.join(", ")}. The dist/ can be clean and ` +
        "this still happen: something injected it after the build. Suspect Web " +
        "Analytics enabled from the Pages dashboard (docs/05 §3 step 8).",
    );
  });

  test(`the served \`${path}\` carries no analytics`, async () => {
    const html = await (await get(path)).text();
    const found = ANALYTICS_FINGERPRINTS.filter((h) => html.toLowerCase().includes(h));
    assert.deepEqual(
      found,
      [],
      `the served ${path} mentions ${found.join(", ")}. The PDF comes out of that page: ` +
        "a third-party script there changes the render and no PDF test notices, " +
        "because the extracted text stays the same.",
    );
  });
}

/**
 * The headers `public/_headers` promises. This is the ONLY place they can be
 * verified: that file is inert text in `dist/` — it becomes behaviour when
 * Pages parses it, and a typo (a missing two-space indent, a rule under the
 * wrong path) produces no error anywhere, just a header that silently is not
 * there.
 */
test("the hashed assets are served immutable", async () => {
  // Read off the landing rather than hard-coded: the file name carries a
  // content hash, so any literal here would rot on the next build.
  const html = await (await get("/")).text();
  const asset = html.match(/\/_astro\/[A-Za-z0-9._-]+\.(?:js|css|woff2?)/)?.[0];
  assert.ok(asset, "the landing references no /_astro/ asset, which cannot be right");

  const cache = (await get(asset)).headers.get("cache-control") ?? "";
  assert.match(
    cache,
    /immutable/,
    `${asset} came back as \`${cache}\`. Those file names carry a content hash: ` +
      "served without `immutable` every visit revalidates a file that cannot change. " +
      "Check that `public/_headers` reached `dist/` and that its `/_astro/*` rule parses.",
  );
});

test("the landing carries its security headers", async () => {
  const res = await get("/");
  const csp = res.headers.get("content-security-policy") ?? "";

  assert.ok(csp, "no Content-Security-Policy. `public/_headers` did not take effect.");
  // Not the whole policy string: asserting it byte for byte would turn every
  // deliberate edit into a failing test. These three are the directives whose
  // absence changes what an attacker can do, not how the page looks.
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
    assert.ok(csp.includes(directive), `the CSP lost \`${directive}\`: ${csp}`);
  }

  for (const header of ["strict-transport-security", "permissions-policy", "x-content-type-options"]) {
    assert.ok(res.headers.get(header), `the served landing has no \`${header}\``);
  }
});

test("the printed pages are not framed either", async () => {
  // `/cv` is the page Browser Rendering prints from. It gets the same headers
  // as everything else — this asserts the `/*` rule really is site-wide and
  // not something that only matched the landing.
  const csp = (await get("/cv/")).headers.get("content-security-policy") ?? "";
  assert.match(csp, /frame-ancestors 'none'/, `/cv/ came back with CSP \`${csp}\``);
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
