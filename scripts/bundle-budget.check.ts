/**
 * Byte budget for the map, on every page that ships it.
 *
 * The claim this file defends is not "three is small" — it is not, it is 127 KB
 * gzip — but that it is **off the critical path**. Without this check that is a
 * promise: it takes one static import of `graph-3d` for Rollup to hoist three
 * into the initial bundle, and nothing warns.
 *
 * The pages measured come from `PAGES_WITH_JS` (`pages-with-js.ts`), the same
 * list `no-client-js.check.ts` uses to decide which pages may ship a script at
 * all. Before this shared list existed, the byte ceiling read `dist/index.html`
 * by path: when `/en/` shipped a second landing with the same map, it got no
 * budget at all, silently (docs/07-technical-debt.md #37).
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

import { content, buildKnowledgeGraph } from "../content/source/index";
import { PAGES_WITH_JS } from "./pages-with-js";

const DIST = "dist";
const ASTRO = join(DIST, "_astro");
/**
 * Representative page for checks that are about CSS rules or DOM markup
 * shared by construction across locales — the stylesheet and the map
 * component are the same module either way, so scanning both landings would
 * measure the same source twice. Only used by the tests that are NOT byte
 * budgets (see the bottom third of this file).
 */
const REPRESENTATIVE_PAGE = "index.html";

/** What a page executes before deciding whether loading the 3D is worth it. */
const CRITICAL_BUDGET_KB = 4;
/** The deferred chunk with three inside. Measured: 127 KB. */
const DEFERRED_BUDGET_KB = 150;
/** The background field: WebGL by hand, no library. Measured: 1.9 KB. */
const FIELD_BUDGET_KB = 8;
/** Each landing's HTML carries the graph coordinates inside it. */
const HTML_BUDGET_KB = 30;

/**
 * Prefix of the field chunk. Rollup names the chunk after the module, so this
 * string is coupled to `src/scripts/lab/field.ts`: renaming that file without
 * touching this one turns the check into a silent pass.
 */
const FIELD_CHUNK = "field.";

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

  test(`${page}: three is NOT on the critical path`, async () => {
    // The central claim. If a static import hoists the chunk — directly, or
    // through another chunk the entry statically imports — this catches it.
    for (const f of critical) {
      const src = (await read(f)).toString("utf8");
      assert.ok(
        !src.includes("WebGLRenderer"),
        `three ended up inside ${page}'s critical chunk ${f}. Check that nobody imports ` +
        `\`graph-3d\` statically: an \`import\` of a type without \`type\` is enough.`,
      );
    }
  });

  test(`${page}: the HTML fits the budget`, () => {
    const weight = kb(Buffer.from(html, "utf8"));
    assert.ok(weight <= HTML_BUDGET_KB, `${page} weighs ${weight} KB gzip of HTML, ceiling ${HTML_BUDGET_KB} KB.`);
  });
}

test("the three chunk exists as a separate file and fits the budget", async () => {
  // Global over every emitted chunk, not per page: both landings' entry
  // chunks resolve to the SAME shared `boot.js`, so a duplicated three chunk
  // would mean Rollup split per locale instead of sharing — a bug this
  // assertion already catches without needing to loop over `PAGES_WITH_JS`.
  const withThree: string[] = [];
  for (const f of chunks) {
    if ((await read(f)).toString("utf8").includes("WebGLRenderer")) withThree.push(f);
  }
  assert.equal(withThree.length, 1, `expected 1 chunk with three, found ${withThree.length}: ${withThree.join(", ")}`);

  const weight = kb(await read(withThree[0]!));
  assert.ok(
    weight <= DEFERRED_BUDGET_KB,
    `the 3D chunk weighs ${weight} KB gzip, ceiling ${DEFERRED_BUDGET_KB} KB. ` +
    `Check that nothing from \`three/examples\` or postprocessing got in.`,
  );
});

test("the background field did not drag in a library", async () => {
  const field = chunks.find((f) => f.startsWith(FIELD_CHUNK));
  assert.ok(field, `no field chunk found among: ${chunks.join(", ")}`);
  const weight = kb(await read(field));
  assert.ok(
    weight <= FIELD_BUDGET_KB,
    `the field chunk weighs ${weight} KB gzip, ceiling ${FIELD_BUDGET_KB} KB. ` +
    `It is WebGL by hand: if it grew like this, a dependency got in that should not be there.`,
  );
});

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

test("the SVG fallback has one node per graph node", async () => {
  // Keeps the SVG from atrophying unnoticed: if the 3D becomes the only real
  // path, the requirement to degrade without JS stops holding silently. It is
  // compared against the derivation, not against a written number.
  //
  // Checked on the representative page only: the node count is a property of
  // the graph structure, which does not change with the locale's labels.
  const html = await readFile(join(DIST, REPRESENTATIVE_PAGE), "utf8");
  const view = await content.getView("portfolio", "es");
  const expected = buildKnowledgeGraph(view).nodes.length;
  const drawn = [...html.matchAll(/class="lab__node/g)].length;
  assert.equal(
    drawn, expected,
    `the SVG draws ${drawn} nodes and the graph has ${expected}.`,
  );
});

test("the map shares the touch gesture with the browser, it does not intercept it", async () => {
  // `touch-action: pan-x pan-y` gives every one-finger swipe to the page.
  // Rotation is two fingers, counted in JS, never via preventDefault on
  // touchmove — exactly what spec §3.4 forbids.
  const html = await readFile(join(DIST, REPRESENTATIVE_PAGE), "utf8");
  const sheets = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const sources = [html, ...(await Promise.all(sheets.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));
  const ok = sources.some((src) =>
    /\.lab__map--3d\{[^}]*touch-action:pan-xpan-y/.test(src) ||
    /\.lab__map--3d\{[^}]*touch-action:pan-ypan-x/.test(src),
  );
  assert.ok(ok, "`touch-action: pan-x pan-y` is missing on .lab__map--3d: a one-finger drag could hijack the scroll");
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

test("the canvases cannot capture the pointer", async () => {
  // `pointer-events: none` is what makes clicks and scroll pass through. It is
  // a CSS rule, so it is verified in what is EMITTED, not in the intent.
  //
  // Searched in the HTML and in the .css files: Astro inlines small sheets into
  // the page, so looking only at `_astro/*.css` would give a false negative.
  const html = await readFile(join(DIST, REPRESENTATIVE_PAGE), "utf8");
  const sheets = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const sources = [html, ...(await Promise.all(sheets.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));

  for (const className of ["lab__canvas", "lab__field"]) {
    const found = sources.some((src) =>
      new RegExp(`\\.${className}\\{[^}]*pointer-events:none`).test(src),
    );
    assert.ok(found, `\`pointer-events: none\` on .${className} not found in the emitted output`);
  }
});
