/**
 * Byte budget for every page that ships JavaScript, and the scroll rule.
 *
 * The pages measured come from `PAGES_WITH_JS` (`pages-with-js.ts`), the same
 * list `no-client-js.check.ts` uses to decide which pages may ship a script at
 * all. Before this shared list existed, the byte ceiling read `dist/index.html`
 * by path: when `/en/` shipped a second landing, it got no budget at all,
 * silently.
 *
 * The "critical path" for each page is not just its `<script src>`: Rollup can
 * point that tag at a few-byte wrapper while the real payload lives one static
 * `import` away. `criticalChunks` below follows static `import` specifiers
 * transitively from each page's entry chunk — but never a dynamic `import()`,
 * which is the deliberate boundary for what may load late. Skipping that walk is exactly how this check went blind
 * once already: it kept scanning a 44-byte wrapper while the chunk that
 * actually runs sat one hop away, unread.
 *
 * The thresholds come from the stage 3 measurement (2026-10-29; the table is
 * in docs/TODO.md as of commit 0961036, deleted once landing v2 shipped)
 * plus margin. When one fails, the message states the measured value, the
 * ceiling and what to look at. Going over can be right; then raise the
 * constant in the same diff, with the reason.
 *
 * The name does NOT end in `.test.ts` on purpose: it needs a prior build.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { basename, join } from "node:path";

import { content } from "../content/source/index";
import { PAGES_WITH_JS, SCROLL_DRIVEN_PAGES } from "./pages-with-js";

const DIST = "dist";
const ASTRO = join(DIST, "_astro");

/**
 * Critical JS, gzip. The landing runs GSAP, ScrollTrigger, SplitText, Lenis,
 * d3-delaunay and its chapters up front, under the loader: 71.6 KB measured.
 * The brief view only boots the reveal and the analytics: 1.5 KB measured.
 */
const CRITICAL_BUDGET_KB = (page: string): number => (SCROLL_DRIVEN_PAGES.has(page) ? 80 : 4);

/** Any chunk a page loads later through `import()`. None today (the brief
 *  view's background moved to CSS); a new one starts under this ceiling. */
const DEFERRED_BUDGET_KB = 8;

/**
 * HTML, gzip, stylesheets included (`inlineStylesheets: "always"` traded two
 * render-blocking requests, ~670 ms on the published page, for CSS in every
 * response). The landing carries every chapter's markup and v2.css: 49 KB
 * measured. The brief view: 19 KB. Deliberately NOT generous: the point of a
 * byte budget on a page whose CSS travels with every response is that the
 * next thing to cross it gets noticed.
 */
const HTML_BUDGET_KB = (page: string): number => (SCROLL_DRIVEN_PAGES.has(page) ? 55 : 24);

const kb = (b: Buffer): number => Math.round((gzipSync(b).length / 1024) * 10) / 10;

const chunks = (await readdir(ASTRO)).filter((f) => f.endsWith(".js"));

const read = async (f: string) => readFile(join(ASTRO, f));

/** The `<script src>` a page loads up front — its entry chunk(s). */
const scriptSrcs = (html: string): string[] =>
  [...html.matchAll(/<script[^>]*\ssrc=["']\/_astro\/([^"']+)["']/g)].map((m) => m[1]!);

/**
 * A STATIC `import ... from "./x.js"` (or bare `import "./x.js"`) specifier.
 * Deliberately does not match `import("./x.js")`: the required `["']`
 * immediately after the optional `from` clause cannot follow the `(` a
 * dynamic call opens with, so dynamic imports never enter the critical walk.
 */
const STATIC_IMPORT_RE = /import\s*(?:[^"'();]*?\bfrom\s*)?["'](\.[^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /import\(\s*["'](\.[^"']+)["']\s*\)/g;

/**
 * Every chunk a page's entry script(s) reach through STATIC imports only,
 * followed transitively — "the critical path" — and the chunks those load
 * later through a dynamic `import()`.
 */
async function walk(html: string): Promise<{ critical: string[]; deferred: string[] }> {
  const seen = new Set<string>();
  const deferred = new Set<string>();
  const queue = scriptSrcs(html);
  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = (await read(f)).toString("utf8");
    // Chunks live flat in `_astro/`, so a relative specifier's basename is
    // its filename regardless of how many `./`/`../` segments precede it.
    for (const m of src.matchAll(STATIC_IMPORT_RE)) queue.push(basename(m[1]!));
    for (const m of src.matchAll(DYNAMIC_IMPORT_RE)) deferred.add(basename(m[1]!));
  }
  return { critical: [...seen], deferred: [...deferred].filter((f) => !seen.has(f)) };
}

const walks = new Map<string, { critical: string[]; deferred: string[] }>();
for (const page of PAGES_WITH_JS) walks.set(page, await walk(await readFile(join(DIST, page), "utf8")));

for (const page of PAGES_WITH_JS) {
  const html = await readFile(join(DIST, page), "utf8");
  const { critical, deferred } = walks.get(page)!;

  test(`${page}: the critical JS fits its ceiling`, async () => {
    let total = 0;
    for (const f of critical) total += kb(await read(f));
    const ceiling = CRITICAL_BUDGET_KB(page);
    assert.ok(
      total <= ceiling,
      `${page}'s critical JS weighs ${total} KB gzip, ceiling ${ceiling} KB. ` +
        `Chunks: ${critical.join(", ")}. A static import that should be dynamic, or a dependency that grew.`,
    );
  });

  test(`${page}: every deferred chunk fits its ceiling`, async () => {
    for (const f of deferred) {
      const weight = kb(await read(f));
      assert.ok(weight <= DEFERRED_BUDGET_KB, `${page} defers ${f}: ${weight} KB gzip, ceiling ${DEFERRED_BUDGET_KB} KB.`);
    }
  });

  test(`${page}: the HTML fits the budget`, () => {
    const weight = kb(Buffer.from(html, "utf8"));
    const ceiling = HTML_BUDGET_KB(page);
    assert.ok(weight <= ceiling, `${page} weighs ${weight} KB gzip of HTML, ceiling ${ceiling} KB.`);
  });
}

test("no chunk took zod or the dataset to the browser", async () => {
  // A single `import ... from "@content"` in client code drags both:
  // `json-source.ts` imports them statically. Checked once against the
  // Spanish view: `identity.fullName` is a proper name, not translated text,
  // so it is the same string a leaked English dataset would also carry — the
  // fingerprint does not depend on which locale leaked.
  const view = await content.getView("portfolio", "es");
  for (const f of chunks) {
    const src = (await read(f)).toString("utf8");
    assert.ok(!src.includes("ZodObject"), `zod ended up in bundle ${f} — somebody imported \`@content\` from the client`);
    assert.ok(
      !src.includes(view.identity.fullName),
      `the dataset ended up in bundle ${f} — somebody imported \`@content\` from the client`,
    );
  }
});

test("only the landing's code listens for wheel or touchmove", async () => {
  // A `wheel` or `touchmove` listener is the doorway to scroll hijacking, so
  // the doorway is forbidden — with ONE named exception, CLAUDE.md invariant
  // 7: the landing's scroll-driven chapters (Lenis, held scenes). A chunk is
  // exempt only when no other page loads it, so the exception cannot leak to
  // the brief view through a shared chunk.
  const landing = new Set<string>();
  const others = new Set<string>();
  for (const [page, { critical, deferred }] of walks) {
    for (const f of [...critical, ...deferred]) (SCROLL_DRIVEN_PAGES.has(page) ? landing : others).add(f);
  }
  for (const f of chunks) {
    if (landing.has(f) && !others.has(f)) continue;
    const src = (await read(f)).toString("utf8");
    for (const event of ["wheel", "touchmove"]) {
      assert.ok(
        !src.includes(`"${event}"`) && !src.includes(`'${event}'`),
        `chunk ${f} registers a \`${event}\` listener and is not the landing's alone. ` +
          "The scroll exception is the landing's (scripts/pages-with-js.ts SCROLL_DRIVEN_PAGES).",
      );
    }
  }
});
