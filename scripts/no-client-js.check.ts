/**
 * Client JavaScript policy, page by page, over ALL of `dist/`.
 *
 * It replaces the old criterion (`grep -c "<script" dist/cv/index.html`), which
 * had two problems: it was never automated — it lived as a row in a table in a
 * doc — and it counted the wrong thing. Astro can put JS in a page without
 * emitting a `<script src>` that grep would match: `<link rel="modulepreload">`,
 * `prefetch`, or a `<ClientRouter/>` in the layout. And the other way around:
 * the graph's `<script type="application/json">` would match the grep without
 * being executable code.
 *
 * Why shielding /cv in particular matters: the PDF is rendered from there with
 * Playwright waiting on `networkidle`. A script slipping in changes the PDF
 * render silently.
 *
 * The name does NOT end in `.test.ts` on purpose: it needs a prior build. Same
 * reason as `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const DIST = "dist";

/**
 * The ONLY pages allowed to ship JavaScript. Adding one is an explicit decision
 * in a diff, not an accident nobody notices.
 *
 * `en/index.html` joined `index.html` when the English landing shipped: it
 * renders the same knowledge map, so it needs the same script. `/cv` and
 * `/en/cv` are deliberately absent — both stay at zero JS, because the PDF is
 * printed from them.
 */
const PAGES_WITH_JS = new Set(["index.html", "en/index.html"]);

/** `<script>` types that are NOT code: they are data for crawlers and agents. */
const DATA_TYPES = new Set(["application/ld+json", "application/json"]);

async function htmls(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmls(p)));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const pages = await htmls(DIST);

test("there are pages to verify (the build ran)", () => {
  assert.ok(pages.length > 0, `no .html found in ${DIST}/ — did you run the build?`);
});

for (const file of pages) {
  const path = relative(DIST, file).split(sep).join("/");
  const html = await readFile(file, "utf8");
  const allowed = PAGES_WITH_JS.has(path);

  test(`${path}: every <script> without src is data, not code`, () => {
    for (const m of html.matchAll(/<script([^>]*)>/g)) {
      const attrs = m[1] ?? "";
      if (/\ssrc=/.test(attrs)) continue;
      const type = /type=["']([^"']+)["']/.exec(attrs)?.[1];
      assert.ok(
        type && DATA_TYPES.has(type),
        `${path} has an executable inline <script${attrs}>. ` +
        `Only ${[...DATA_TYPES].join(" and ")} are allowed.`,
      );
    }
  });

  if (allowed) continue;

  test(`${path}: loads no external script`, () => {
    const external = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
    assert.deepEqual(
      external, [],
      `${path} cannot load JS. If that is on purpose, add it to PAGES_WITH_JS and say why.`,
    );
  });

  test(`${path}: no modulepreload and no prefetch`, () => {
    // These are the routes through which Astro injects JS without emitting a
    // <script src>.
    const preloads = [...html.matchAll(/<link[^>]*rel=["'](modulepreload|prefetch)["'][^>]*>/g)];
    assert.equal(
      preloads.length, 0,
      `${path} has ${preloads.length} module preload link(s). ` +
      `Check whether \`prefetch\` or \`experimental.clientPrerender\` got enabled in astro.config.mjs.`,
    );
  });

  test(`${path}: references no /_astro/ bundles`, () => {
    const refs = [...html.matchAll(/["'](\/_astro\/[^"']+\.js)["']/g)].map((m) => m[1]);
    assert.deepEqual(refs, [], `${path} references JS bundles: ${refs.join(", ")}`);
  });
}

/**
 * The fingerprint of each analytics provider in the served HTML.
 *
 * They are listed one by one and not with a generic pattern like "analytics":
 * if a third one ever arrives and nobody adds it here, it is better for the
 * test to be visibly incomplete than to pass by accident.
 */
const ANALYTICS_FINGERPRINTS = [
  { mark: "clarity", name: "Microsoft Clarity" },
  { mark: "cloudflareinsights", name: "Cloudflare Web Analytics" },
  { mark: "cf-beacon", name: "Cloudflare Web Analytics" },
];

test("analytics live ONLY on the landing", async () => {
  // The tests above already cover this indirectly: analytics in `Base.astro`
  // would make `/cv` emit a `<script src>` and several would fail. But they
  // would fail saying "cv/index.html cannot load JS", and whoever reads that
  // will go looking for the problem in the map, not in the measurement.
  //
  // This names the risk: `/cv` is where Browser Rendering prints the PDF from,
  // and a third-party script there changes the production render without any
  // PDF test noticing — the extracted text stays the same.
  const offenders: string[] = [];
  for (const file of pages) {
    const path = relative(DIST, file).split(sep).join("/");
    // Both landings run the map's boot script, which calls `startAnalytics()`
    // first (see `src/pages/index.astro`'s ordering comment) — so both are
    // expected to carry the fingerprints. `PAGES_WITH_JS` is the same
    // allowlist for the same reason: shipping JS here is a decision, not an
    // accident.
    if (PAGES_WITH_JS.has(path)) continue;
    const html = await readFile(file, "utf8");
    for (const { mark, name } of ANALYTICS_FINGERPRINTS) {
      if (html.toLowerCase().includes(mark)) offenders.push(`${path} (${name})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `analytics reached ${offenders.join(", ")}. They go ONLY in the landings' own ` +
      "pages: if they moved to Base.astro, /cv or /en/cv stopped being at zero JS " +
      "and the PDF is printed from there.",
  );
});
