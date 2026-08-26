/**
 * Byte budget for the map on the home page.
 *
 * The claim this file defends is not "three is small" — it is not, it is 127 KB
 * gzip — but that it is **off the critical path**. Without this check that is a
 * promise: it takes one static import of `graph-3d` for Rollup to hoist three
 * into the initial bundle, and nothing warns.
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
import { join } from "node:path";

import { content, buildKnowledgeGraph } from "../content/source/index";

const DIST = "dist";
const ASTRO = join(DIST, "_astro");
const HOME = join(DIST, "index.html");

/** What the home executes before deciding whether loading the 3D is worth it. */
const CRITICAL_BUDGET_KB = 4;
/** The deferred chunk with three inside. Measured: 127 KB. */
const DEFERRED_BUDGET_KB = 150;
/** The background field: WebGL by hand, no library. Measured: 1.9 KB. */
const FIELD_BUDGET_KB = 8;
/** The home HTML carries the graph coordinates inside it. */
const HTML_BUDGET_KB = 30;

/**
 * Prefix of the field chunk. Rollup names the chunk after the module, so this
 * string is coupled to `src/scripts/lab/field.ts`: renaming that file without
 * touching this one turns the check into a silent pass.
 */
const FIELD_CHUNK = "field.";

const kb = (b: Buffer): number => Math.round((gzipSync(b).length / 1024) * 10) / 10;

const html = await readFile(HOME, "utf8");
const chunks = (await readdir(ASTRO)).filter((f) => f.endsWith(".js"));

const read = async (f: string) => readFile(join(ASTRO, f));

/** The ones the home loads up front: the boot `<script src>`. */
const critical = [...html.matchAll(/<script[^>]*\ssrc=["']\/_astro\/([^"']+)["']/g)].map((m) => m[1]!);

test("the home's critical path is only the bootstrap", async () => {
  let total = 0;
  for (const f of critical) total += kb(await read(f));
  assert.ok(
    total <= CRITICAL_BUDGET_KB,
    `the home's critical JS weighs ${total} KB gzip, ceiling ${CRITICAL_BUDGET_KB} KB. ` +
    `Chunks: ${critical.join(", ")}. Most likely a static import got in that should have been dynamic.`,
  );
});

test("three is NOT on the critical path", async () => {
  // The central claim. If a static import hoists the chunk, this catches it.
  for (const f of critical) {
    const src = (await read(f)).toString("utf8");
    assert.ok(
      !src.includes("WebGLRenderer"),
      `three ended up inside the critical chunk ${f}. Check that nobody imports ` +
      `\`graph-3d\` statically: an \`import\` of a type without \`type\` is enough.`,
    );
  }
});

test("the three chunk exists as a separate file and fits the budget", async () => {
  const withThree: string[] = [];
  for (const f of chunks) {
    if ((await read(f)).toString("utf8").includes("WebGLRenderer")) withThree.push(f);
  }
  assert.equal(withThree.length, 1, `expected 1 chunk with three, found ${withThree.length}: ${withThree.join(", ")}`);
  assert.ok(!critical.includes(withThree[0]!), "the three chunk is also a critical chunk");

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
  // `json-source.ts` imports them statically.
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

test("the home HTML fits the budget", () => {
  const weight = kb(Buffer.from(html, "utf8"));
  assert.ok(weight <= HTML_BUDGET_KB, `the home weighs ${weight} KB gzip of HTML, ceiling ${HTML_BUDGET_KB} KB.`);
});

test("the SVG fallback has one node per graph node", async () => {
  // Keeps the SVG from atrophying unnoticed: if the 3D becomes the only real
  // path, the requirement to degrade without JS stops holding silently. It is
  // compared against the derivation, not against a written number.
  const view = await content.getView("portfolio", "es");
  const expected = buildKnowledgeGraph(view).nodes.length;
  const drawn = [...html.matchAll(/class="lab__nodo/g)].length;
  assert.equal(
    drawn, expected,
    `the SVG draws ${drawn} nodes and the graph has ${expected}.`,
  );
});

test("the map shares the touch gesture with the browser, it does not intercept it", async () => {
  // `touch-action: pan-y` is what makes a vertical swipe scroll the page and a
  // horizontal one rotate the map. Without it, dragging on a phone would hijack
  // the scroll — exactly what spec §3.4 forbids.
  const sheets = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const sources = [html, ...(await Promise.all(sheets.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));
  const ok = sources.some((src) => /\.lab__mapa--3d\{[^}]*touch-action:pan-y/.test(src));
  assert.ok(ok, "`touch-action: pan-y` is missing on .lab__mapa--3d: the drag could hijack the scroll");
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
  const sheets = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const sources = [html, ...(await Promise.all(sheets.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));

  for (const className of ["lab__canvas", "lab__campo"]) {
    const found = sources.some((src) =>
      new RegExp(`\\.${className}\\{[^}]*pointer-events:none`).test(src),
    );
    assert.ok(found, `\`pointer-events: none\` on .${className} not found in the emitted output`);
  }
});
