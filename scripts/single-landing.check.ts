/**
 * The structure of the site: each landing is the only door to its own CV, and
 * broken routes announce that they are broken.
 *
 * `/cv` and `/en/cv` still exist because the PDFs are printed from there, but
 * neither is a destination: no incoming links and not indexed. That is a UX
 * decision that unravels on its own — someone adds a "see full CV" link and
 * nobody finds out — unless something holds it up. This is that something.
 *
 * It also verifies that each landing's CV section does not drift out of sync
 * with its PDF: both pages render the same components, but with different
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
import { pdfFilename } from "../content/source/index";
import { MESSAGES } from "../content/schema/messages";
import { ANCHORS, LOCALE_PATHS, anchorScrollCss } from "../src/lib/anchors";
import datasetEs from "../content/data/content.es.json";
import datasetEn from "../content/data/content.en.json";

const DIST = "dist";
const landing = await readFile(join(DIST, "index.html"), "utf8");
const cv = await readFile(join(DIST, "cv", "index.html"), "utf8");
const enLanding = await readFile(join(DIST, "en", "index.html"), "utf8");
const enCv = await readFile(join(DIST, "en", "cv", "index.html"), "utf8");

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

test("neither landing links to `/cv`", () => {
  // The exact route only: `/cv.pdf` and `/cv.json` are legitimate destinations
  // and have to keep working.
  const links = [...landing.matchAll(/href="(\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    links, [],
    "the Spanish landing links to /cv again. That route exists only to print " +
    "the PDF: the reader's destination is the #cv anchor.",
  );

  const enLinks = [...enLanding.matchAll(/href="(\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    enLinks, [],
    "the English landing links to /cv. It should point at its own PDF " +
    "(/cv.pdf, offered as the OTHER locale's download) but never at the route.",
  );
});

test("the English landing does not link to `/en/cv` either", () => {
  const links = [...enLanding.matchAll(/href="(\/en\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    links, [],
    "the English landing links to /en/cv. That route exists only to print the " +
    "PDF: the reader's destination is the #cv anchor.",
  );
});

test("NO page links to `/cv`, not just the landing", () => {
  // The test above looks at the landings because when it was written those
  // were the only pages that could link anywhere. Since `404.astro` exists
  // there is more than one, and the invariant was never "the landing does not
  // link /cv" but "/cv has no incoming links". This covers what the promise
  // always said.
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

test("NO page links to `/en/cv` either", () => {
  const offenders: string[] = [];
  for (const file of pages) {
    const path = relative(DIST, file).split(sep).join("/");
    if ([...contents.get(file)!.matchAll(/href="(\/en\/cv\/?)"/g)].length > 0) {
      offenders.push(path);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these pages link to /en/cv: ${offenders.join(", ")}. That route exists only ` +
      "to print the PDF; the reader's destination is the English landing's #cv anchor.",
  );
});

test("there is a real 404 page", () => {
  // Without `dist/404.html`, Cloudflare Pages returns 200 with HTML for any
  // made-up route. That is a soft 404 and crawlers penalise it (closed #1,
  // measured before fixing it). The file is generated from
  // `src/pages/404.astro`: if someone deletes that page, this warns.
  const paths = pages.map((a) => relative(DIST, a).split(sep).join("/"));
  assert.ok(
    paths.includes("404.html"),
    `there is no 404.html in ${DIST}/. Without it, a non-existent route returns ` +
      `200 and the site goes back to the soft 404. It is generated from src/pages/404.astro.`,
  );
});

test("the 404 is bilingual in one page and never links to /cv", async () => {
  const html = await readFile(join(DIST, "404.html"), "utf8");
  assert.match(html, /lang="en"/, "the 404 has no English block");
  assert.ok(html.includes(`href="/#${ANCHORS.es.map}"`), "the 404 does not link to the Spanish map");
  assert.ok(html.includes(`href="/en/#${ANCHORS.en.map}"`), "the 404 does not link to the English map");
  assert.doesNotMatch(html, /href="\/cv"/, "the 404 links to /cv");
  assert.doesNotMatch(html, /href="\/en\/cv"/, "the 404 links to /en/cv");
});

test("only the two landings emit Open Graph", () => {
  // `shareable` is opt-in in `Base.astro`, but that only prevents forgetting in
  // one direction: nothing stops someone marking it on `/cv`. And there it
  // would be worse than an oversight — that page carries `noindex`, so we would
  // be asking the crawler not to index it while offering it a card to share it.
  const LANDINGS = new Set(["index.html", "en/index.html"]);
  const withOg: string[] = [];
  for (const file of pages) {
    const path = relative(DIST, file).split(sep).join("/");
    if (LANDINGS.has(path)) continue;
    if (contents.get(file)!.includes('property="og:')) withOg.push(path);
  }
  assert.deepEqual(
    withOg,
    [],
    `these pages emit Open Graph: ${withOg.join(", ")}. Only the landings are ` +
      "shareable; /cv and /en/cv are noindex and the 404 is not a destination.",
  );

  for (const [name, html] of [["Spanish", landing], ["English", enLanding]] as const) {
    assert.ok(
      html.includes('property="og:title"'),
      `the ${name} landing does not emit Open Graph: pasting the link shows a bare URL`,
    );
  }
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

test("`/cv` and `/en/cv` are not indexed", () => {
  assert.match(
    cv,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/cv without noindex: Google will index it and the reader will land on a " +
    "loose page, with no map and no projects.",
  );
  assert.match(
    enCv,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/en/cv without noindex: same problem, in the other language.",
  );
});

test("`/en/` exists and is indexable", () => {
  // `readFile` at the top already throws if the file is missing; this names
  // the second half of the promise — that it is not accidentally `noindex`,
  // which would defeat the entire point of shipping it (see the plan's ruling:
  // the English landing IS indexable).
  assert.doesNotMatch(
    enLanding,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/en/ carries noindex. It is the indexable twin of the Spanish landing, " +
    "not another /cv.",
  );
});

test("both landings declare hreflang for each other, with Spanish as x-default", () => {
  // Reciprocity matters as much as presence: a crawler that finds `/`
  // pointing at `/en/` but not the other way around treats the pair as
  // unconfirmed (docs/09 §2.3), so this checks BOTH pages for ALL THREE tags,
  // not just one page for one.
  const ALTERNATES: [string, RegExp][] = [
    ["es", /^https?:\/\/[^"]*\/$/],
    ["en", /^https?:\/\/[^"]*\/en\/$/],
    ["x-default", /^https?:\/\/[^"]*\/$/],
  ];
  for (const [name, html] of [["Spanish", landing], ["English", enLanding]] as const) {
    for (const [hreflang, hrefPattern] of ALTERNATES) {
      const found = new RegExp(`<link\\s+rel="alternate"\\s+hreflang="${hreflang}"\\s+href="([^"]+)"`).exec(html);
      assert.ok(found, `the ${name} landing is missing hreflang="${hreflang}"`);
      assert.match(
        found![1]!,
        hrefPattern,
        `the ${name} landing's hreflang="${hreflang}" points at an unexpected URL: ${found![1]}`,
      );
    }
  }
});

test("neither `/cv` nor `/en/cv` carries hreflang", () => {
  // The other half of the same contradiction `single-landing.check.ts`
  // already guards for `noindex`: `hreflang` tells a crawler "here is the
  // equivalent of this page in another language", and pointing that at a
  // page marked `noindex` is an error crawlers report, not a courtesy they
  // ignore (docs/09 §2.3).
  for (const [name, html] of [["/cv", cv], ["/en/cv", enCv]] as const) {
    assert.doesNotMatch(
      html,
      /<link\s+rel="alternate"\s+hreflang=/,
      `${name} carries hreflang. It is noindex and must not announce a language alternate.`,
    );
  }
});

test("each landing offers both PDFs, under the file name for each locale's own dataset", () => {
  const esName = pdfFilename("es", datasetEs.updatedAt);
  const enName = pdfFilename("en", datasetEn.updatedAt);

  for (const [name, html] of [["Spanish", markup(landing)], ["English", markup(enLanding)]] as const) {
    assert.ok(html.includes('href="/cv.pdf"'), `the ${name} landing lost the /cv.pdf button`);
    assert.ok(html.includes('href="/en/cv.pdf"'), `the ${name} landing lost the /en/cv.pdf button`);
    assert.ok(
      html.includes(`download="${esName}"`),
      `the ${name} landing's /cv.pdf button does not carry "${esName}" as its download name`,
    );
    assert.ok(
      html.includes(`download="${enName}"`),
      `the ${name} landing's /en/cv.pdf button does not carry "${enName}" as its download name`,
    );
  }
});

test("each landing's switch links to the OTHER locale's home", () => {
  assert.ok(
    landing.includes(`href="${LOCALE_PATHS.en.home}"`),
    `the Spanish landing's switch does not link to ${LOCALE_PATHS.en.home}`,
  );
  assert.ok(
    enLanding.includes(`href="${LOCALE_PATHS.es.home}"`),
    `the English landing's switch does not link back to ${LOCALE_PATHS.es.home}`,
  );
});

test("every landing-anchor id has a scroll-margin, emitted from ANCHORS", () => {
  // Renaming ANCHORS.en.map used to pass every gate and drop the offset on
  // `/en/`. The rule is built from ANCHORS, so both landings must carry it.
  const css = anchorScrollCss();
  assert.ok(landing.includes(css), "the Spanish landing is missing the ANCHORS scroll-margin rule");
  assert.ok(enLanding.includes(css), "the English landing is missing the ANCHORS scroll-margin rule");
});

test("the Spanish landing has its three anchors, the English landing has its own", () => {
  for (const id of Object.values(ANCHORS.es)) {
    assert.match(landing, new RegExp(`id="${id}"`), `the Spanish #${id} section is missing`);
    assert.ok(landing.includes(`href="#${id}"`), `the Spanish index does not point at #${id}`);
  }
  for (const id of Object.values(ANCHORS.en)) {
    assert.match(enLanding, new RegExp(`id="${id}"`), `the English #${id} section is missing`);
    assert.ok(enLanding.includes(`href="#${id}"`), `the English index does not point at #${id}`);
  }
});

test("each landing's CV section has not drifted from its PDF", () => {
  // `#cv` is the LAST section of the landing, so everything after the marker is
  // the CV. The floating button that follows contributes no `<li>`.
  const roles = (html: string) => (html.match(/class="role"/g) ?? []).length;
  // Achievements are `<li>` with no class of their own: `RoleBlock` puts them
  // in a `<ul class="role__bullets">`. Counting `<li>` over the tail is enough.
  const achievements = (html: string) => (html.match(/<li[ >]/g) ?? []).length;

  for (const [name, home, pdf, cvId] of [
    ["Spanish", landing, cv, ANCHORS.es.cv],
    ["English", enLanding, enCv, ANCHORS.en.cv],
  ] as const) {
    const start = home.indexOf(`id="${cvId}"`);
    assert.ok(start > 0, `the #${cvId} section was not found in the ${name} landing`);
    const tail = home.slice(start);

    assert.ok(roles(pdf) > 0, "`class=\"role\"` no longer exists: update this test");
    assert.equal(
      roles(tail), roles(pdf),
      `the ${name} landing shows ${roles(tail)} roles and its /cv shows ${roles(pdf)}`,
    );
    assert.equal(
      achievements(tail), achievements(pdf),
      `the ${name} landing shows ${achievements(tail)} achievements and its /cv shows ` +
      `${achievements(pdf)}. Rule 7: \`portfolio\` does not cap achievements per role and ` +
      `\`cv-ats\` caps at 5 — somebody changed the surface of one of the two pages.`,
    );
  }
});

test("neither landing repeats the CV header", () => {
  // `Header.astro` emits `<h1 class="cv__name">`. Each landing's hero already
  // has its own `<h1>`, and two in one page break the order for a screen
  // reader. The landing starts its CV at "Perfil"/"Profile".
  //
  // It looks at the MARKUP, not the whole HTML. Searching for "cv__name" in the
  // entire file also matches the SELECTOR inside a `<style>`, and Astro decides
  // whether to inline a sheet based on how the chunking lands — meaning the test
  // result depended on how many pages the site had. It was discovered when
  // adding `404.astro`: cv.css went from external to inline and the test started
  // failing without the landing changing a line.
  for (const [name, home, pdf] of [
    ["Spanish", landing, cv],
    ["English", enLanding, enCv],
  ] as const) {
    assert.ok(!markup(home).includes("cv__name"), `the ${name} landing rendered the CV's <Header>`);
    assert.ok(
      markup(pdf).includes("cv__name"),
      `/${name === "Spanish" ? "cv" : "en/cv"} lost its <Header>: the PDF needs the name at the top`,
    );
  }
});

/**
 * I1: `HomeDocument.astro` used to take `locale` and `view` as two
 * independent props, and `ContentView` carried no `locale` of its own —
 * nothing stopped `src/pages/en/index.astro` from fetching the Spanish view
 * while keeping `locale="en"`, and typecheck, `pnpm test` and every other
 * check here would still pass, because none of them look at what LANGUAGE
 * the rendered text is actually in. This is that check: each landing has to
 * carry its own locale's chrome copy and its own locale's author text, and
 * not the other's.
 *
 * The map title is chrome (`messages.ts`, a closed compile-time set); the
 * identity summary is author's prose (the dataset, the thing `resolveView`
 * resolves). Between the two they cover both halves of what a mismatched
 * `locale`/`view` pair would get wrong.
 */
test("each landing renders its own locale's content, not the other's", () => {
  for (const [name, html, own, other, dataset] of [
    ["Spanish", landing, MESSAGES.es, MESSAGES.en, datasetEs],
    ["English", enLanding, MESSAGES.en, MESSAGES.es, datasetEn],
  ] as const) {
    assert.ok(
      html.includes(own.mapTitle),
      `the ${name} landing is missing its own map title ("${own.mapTitle}")`,
    );
    assert.ok(
      !html.includes(other.mapTitle),
      `the ${name} landing contains the OTHER locale's map title ("${other.mapTitle}") — ` +
        "locale/view mismatch: the chrome copy and the data are speaking different languages",
    );
    assert.ok(
      html.includes(dataset.identity.summary.short),
      `the ${name} landing is missing its own identity.summary.short — it may be ` +
        "rendering the other locale's dataset",
    );
  }
});
