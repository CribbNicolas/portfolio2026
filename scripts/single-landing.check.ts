/**
 * The structure of the site: the landing is the only door, and broken routes
 * announce that they are broken.
 *
 * `/cv` still exists because the PDF is printed from there, but it stopped
 * being a destination: no incoming links and not indexed. That is a UX decision
 * that unravels on its own — someone adds a "see full CV" link and nobody finds
 * out — unless something holds it up. This is that something.
 *
 * It also verifies that the landing's CV section does not drift out of sync
 * with the PDF: both pages render the same components, but with different
 * surfaces the number of achievements would stop matching silently.
 *
 * The name does NOT end in `.test.ts` on purpose: it needs a prior build. Same
 * reason as `no-client-js.check.ts` and `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { accessSync, constants } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const DIST = "dist";
const landing = await readFile(join(DIST, "index.html"), "utf8");
const cv = await readFile(join(DIST, "cv", "index.html"), "utf8");

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
const contents = new Map<string, string>();
for (const file of pages) contents.set(file, await readFile(file, "utf8"));

/**
 * The HTML without the inline stylesheets.
 *
 * A class name appears twice in a page: in the markup's `class=` and in the CSS
 * selector. Astro decides whether to inline a sheet or leave it external based
 * on how the chunking lands, so a test searching for the name in the whole file
 * changes result when any page is added. This leaves only what the browser
 * draws.
 */
const markup = (html: string): string => html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

test("the landing does not link to `/cv`", () => {
  // The exact route only: `/cv.pdf` and `/cv.json` are legitimate destinations
  // and have to keep working.
  const links = [...landing.matchAll(/href="(\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    links, [],
    "the landing links to /cv again. That route exists only to print the PDF: " +
    "the reader's destination is the #cv anchor.",
  );
});

test("NO page links to `/cv`, not just the landing", () => {
  // The test above looks at `index.html` because when it was written that was
  // the only page that could link anywhere. Since `404.astro` exists there is
  // more than one, and the invariant was never "the landing does not link /cv"
  // but "/cv has no incoming links". This covers what the promise always said.
  const offenders: string[] = [];
  for (const file of pages) {
    const path = relative(DIST, file).split(sep).join("/");
    if ([...contents.get(file)!.matchAll(/href="(\/cv\/?)"/g)].length > 0) {
      offenders.push(path);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these pages link to /cv: ${offenders.join(", ")}. That route exists only to ` +
      "print the PDF; the reader's destination is the landing's #cv anchor.",
  );
});

test("there is a real 404 page", () => {
  // Without `dist/404.html`, Cloudflare Pages returns 200 with HTML for any
  // made-up route. That is a soft 404 and crawlers penalise it (technical debt
  // §1, measured before fixing it). The file is generated from
  // `src/pages/404.astro`: if someone deletes that page, this warns.
  const paths = pages.map((a) => relative(DIST, a).split(sep).join("/"));
  assert.ok(
    paths.includes("404.html"),
    `there is no 404.html in ${DIST}/. Without it, a non-existent route returns ` +
      `200 and the site goes back to the soft 404. It is generated from src/pages/404.astro.`,
  );
});

test("only the landing emits Open Graph", () => {
  // `shareable` is opt-in in `Base.astro`, but that only prevents forgetting in
  // one direction: nothing stops someone marking it on `/cv`. And there it
  // would be worse than an oversight — that page carries `noindex`, so we would
  // be asking the crawler not to index it while offering it a card to share it.
  const withOg: string[] = [];
  for (const file of pages) {
    const path = relative(DIST, file).split(sep).join("/");
    if (path === "index.html") continue;
    if (contents.get(file)!.includes('property="og:')) withOg.push(path);
  }
  assert.deepEqual(
    withOg,
    [],
    `these pages emit Open Graph: ${withOg.join(", ")}. Only the landing is ` +
      "shareable; /cv is noindex and the 404 is not a destination.",
  );

  assert.ok(
    landing.includes('property="og:title"'),
    "the landing stopped emitting Open Graph: pasting the link shows a bare URL again",
  );
});

test("the favicon and the sitemap really exist", () => {
  // `Base.astro` links /favicon.svg on all three pages and robots.txt announces
  // the sitemap. If the files are not there, every visit takes a silent 404 and
  // the announced sitemap does not exist — worse than not announcing it.
  for (const file of ["favicon.svg", "sitemap-index.xml"]) {
    assert.doesNotThrow(
      () => accessSync(join(DIST, file), constants.F_OK),
      `${DIST}/${file} is missing, and something references it.`,
    );
  }
});

test("`/cv` is not indexed", () => {
  assert.match(
    cv,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/cv without noindex: Google will index it and the reader will land on a " +
    "loose page, with no map and no projects.",
  );
});

test("the CV button downloads /cv.pdf under the ATS filename", () => {
  const html = markup(landing);
  assert.ok(html.includes('href="/cv.pdf"'), "the landing lost the /cv.pdf button");
  assert.ok(
    html.includes('download="Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf"'),
    "the download attribute is what names the file (docs/03 §2). Without it the click opens /cv.pdf in the tab.",
  );
});

test("the landing has the three anchors of the index", () => {
  for (const id of ["mapa", "proyectos", "cv"]) {
    assert.match(landing, new RegExp(`id="${id}"`), `the #${id} section is missing`);
    assert.ok(landing.includes(`href="#${id}"`), `the index does not point at #${id}`);
  }
});

test("the landing's CV section has not drifted from the PDF", () => {
  // `#cv` is the LAST section of the landing, so everything after the marker is
  // the CV. The floating button that follows contributes no `<li>`.
  const start = landing.indexOf('id="cv"');
  assert.ok(start > 0, "the #cv section was not found in the landing");
  const tail = landing.slice(start);

  const roles = (html: string) => (html.match(/class="role"/g) ?? []).length;
  // Achievements are `<li>` with no class of their own: `RoleBlock` puts them
  // in a `<ul class="role__bullets">`. Counting `<li>` over the tail is enough.
  const achievements = (html: string) => (html.match(/<li[ >]/g) ?? []).length;

  assert.ok(roles(cv) > 0, "`class=\"role\"` no longer exists: update this test");
  assert.equal(
    roles(tail), roles(cv),
    `the landing shows ${roles(tail)} roles and /cv shows ${roles(cv)}`,
  );
  assert.equal(
    achievements(tail), achievements(cv),
    `the landing shows ${achievements(tail)} achievements and /cv shows ${achievements(cv)}. ` +
    `Rule 7: \`portfolio\` does not cap achievements per role and \`cv-ats\` caps at 5 — ` +
    `somebody changed the surface of one of the two pages.`,
  );
});

test("the landing does NOT repeat the CV header", () => {
  // `Header.astro` emits `<h1 class="cv__name">`. The landing hero already has
  // its `<h1>`, and two in one page break the order for a screen reader. The
  // landing starts its CV at "Perfil".
  //
  // It looks at the MARKUP, not the whole HTML. Searching for "cv__name" in the
  // entire file also matches the SELECTOR inside a `<style>`, and Astro decides
  // whether to inline a sheet based on how the chunking lands — meaning the test
  // result depended on how many pages the site had. It was discovered when
  // adding `404.astro`: cv.css went from external to inline and the test started
  // failing without the landing changing a line.
  assert.ok(!markup(landing).includes("cv__name"), "the landing rendered the CV's <Header>");
  assert.ok(
    markup(cv).includes("cv__name"),
    "/cv lost its <Header>: the PDF needs the name at the top",
  );
});
