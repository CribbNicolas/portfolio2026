/**
 * Byte budget for every page that ships JavaScript.
 *
 * PENDING (docs/TODO.md, stage 5): the ceilings below were measured for the
 * old landing and its 3D map, which is gone (author, 2026-10-29). The landing
 * now runs scroll-driven chapters (GSAP, Lenis): its chunk gets a ceiling
 * measured in stage 3, and the wheel/touchmove rule an explicit exception for
 * it. Until then those tests fail on purpose instead of being loosened.
 *
 * The pages measured come from `PAGES_WITH_JS` (`pages-with-js.ts`), the same
 * list `no-client-js.check.ts` uses to decide which pages may ship a script at
 * all. Before this shared list existed, the byte ceiling read `dist/index.html`
 * by path: when `/en/` shipped a second landing with the same map, it got no
 * budget at all, silently.
 *
 * The "critical path" for each page is not just its `<script src>`: Rollup
 * shares the boot logic between the two landings, so that tag can point at a
 * few-byte wrapper while the real payload lives one static `import` away, in a
 * chunk the wrapper alone never reveals. `criticalChunks` below follows static
 * `import` specifiers transitively from each page's entry chunk — but never a
 * dynamic `import()`, which is the deliberate boundary where `three` is allowed
 * to cross. Skipping that walk is exactly how this check went blind once
 * already: it kept scanning a 44-byte wrapper for `WebGLRenderer` while the
 * 4.6 KB chunk that actually runs sat one hop away, unread.
 *
 * The thresholds come from the first green measurement plus margin. When one
 * fails, the message states the measured value, the ceiling and what to look at.
 *
 * The name does NOT end in `.test.ts` on purpose: it needs a prior build.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { basename, join } from "node:path";

import { content } from "../content/source/index";
import { PAGES_WITH_JS } from "./pages-with-js";

const DIST = "dist";
const ASTRO = join(DIST, "_astro");

/** What a page executes up front, through static imports. */
const CRITICAL_BUDGET_KB = 4;
/**
 * Each landing's HTML carries the graph coordinates inside it — and, since
 * `inlineStylesheets: "always"`, its stylesheets too. That move traded two
 * render-blocking requests (~670 ms before the first paint, measured on the
 * published page) for ~16 KB gzip of inlined CSS, which is why this ceiling
 * went from 30 to 34: 29 KB measured, plus margin. It is deliberately NOT
 * generous. The whole point of a byte budget on a page whose CSS now travels
 * with every HTML response is that the next thing to cross it gets noticed.
 */
const HTML_BUDGET_KB = 34;

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
 * dynamic call opens with, so `graph-3d`'s and `field`'s dynamic imports never
 * enter the walk. That is not incidental — it is the boundary this whole file
 * exists to keep three on the far side of.
 */
const STATIC_IMPORT_RE = /import\s*(?:[^"'();]*?\bfrom\s*)?["'](\.[^"']+)["']/g;

/**
 * Every chunk a page's entry script(s) reach through STATIC imports only,
 * followed transitively. This is "the critical path": what the browser must
 * fetch and run before the page is interactive, as opposed to what a dynamic
 * `import()` defers until the map scrolls into view.
 */
async function criticalChunks(html: string): Promise<string[]> {
  const seen = new Set<string>();
  const queue = scriptSrcs(html);
  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = (await read(f)).toString("utf8");
    for (const m of src.matchAll(STATIC_IMPORT_RE)) {
      // Chunks live flat in `_astro/`, so a relative specifier's basename is
      // its filename regardless of how many `./`/`../` segments precede it.
      const next = basename(m[1]!);
      if (!seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

for (const page of PAGES_WITH_JS) {
  const html = await readFile(join(DIST, page), "utf8");
  const critical = await criticalChunks(html);

  test(`${page}: the critical path is only the bootstrap`, async () => {
    let total = 0;
    for (const f of critical) total += kb(await read(f));
    assert.ok(
      total <= CRITICAL_BUDGET_KB,
      `${page}'s critical JS weighs ${total} KB gzip, ceiling ${CRITICAL_BUDGET_KB} KB. ` +
      `Chunks: ${critical.join(", ")}. Most likely a static import got in that should have been dynamic.`,
    );
  });

  test(`${page}: the HTML fits the budget`, () => {
    const weight = kb(Buffer.from(html, "utf8"));
    assert.ok(weight <= HTML_BUDGET_KB, `${page} weighs ${weight} KB gzip of HTML, ceiling ${HTML_BUDGET_KB} KB.`);
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

test("no client module listens for wheel or touchmove", async () => {
  // Scrolling stays in the browser's hands by construction. A `wheel` or
  // `touchmove` listener is the doorway to scroll hijacking, so the doorway is
  // forbidden, not the abuse.
  for (const f of chunks) {
    const src = (await read(f)).toString("utf8");
    for (const event of ["wheel", "touchmove"]) {
      assert.ok(
        !src.includes(`"${event}"`) && !src.includes(`'${event}'`),
        `chunk ${f} registers a \`${event}\` listener. The pointer and the scroll are read passively.`,
      );
    }
  }
});
