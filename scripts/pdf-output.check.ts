/**
 * Verification of the generated PDF. This is what turns "the CV passes the ATS"
 * from an intention into a test (invariant 7).
 *
 * The name does NOT end in `.test.ts` on purpose: `pnpm test` discovers every
 * `*.test.ts` and would run this one before the PDF exists. It runs separately,
 * with `pnpm run test:pdf`, which runs this file twice — once per `PDF_LOCALE`
 * — and against two different kinds of source per run depending on
 * `PDF_SOURCE` — see below.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// The `legacy` build is the only one that runs in Node (the main one needs DOM
// APIs Node 20 does not have). That subpath exposes no types of its own.
// @ts-ignore
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { content, formatRoleTitle } from "../content/source/index";
import type { Locale } from "../content/schema/content-schema";
import { MESSAGES } from "../content/schema/messages";

/**
 * Which PDF this run verifies. Defaults to Spanish so a bare `tsx --test
 * scripts/pdf-output.check.ts` (or an old muscle-memory `PDF_SOURCE=` alone)
 * keeps working unchanged. `package.json`'s `test:pdf` runs this file twice,
 * once per locale, so both PDFs get the same eleven assertions.
 *
 * Checked, not cast: an unchecked `as Locale` turns a typo'd `PDF_LOCALE`
 * (`PDF_LOCALE=EN`, `PDF_LOCALE=fr`) into `MESSAGES[LOCALE]` reading
 * `undefined` and every later assertion failing with a TypeError instead of
 * a message naming the actual mistake.
 */
const rawLocale = process.env.PDF_LOCALE ?? "es";
if (rawLocale !== "es" && rawLocale !== "en") {
  throw new Error(
    `PDF_LOCALE="${rawLocale}" is not a known locale. Use "es" or "en" (see content-schema.ts's Locale type).`,
  );
}
const LOCALE: Locale = rawLocale;
const MESSAGES_FOR_LOCALE = MESSAGES[LOCALE];

/**
 * Where the verified bytes come from.
 *
 * By default `dist/cv.pdf` (or `dist/en/cv.pdf` for `PDF_LOCALE=en`), the one
 * `pnpm run pdf:local` produces with Playwright: that is the PRE-deploy gate
 * and it depends on nobody's network.
 *
 * With `PDF_SOURCE=https://…/cv.pdf` the SAME tests run against the published
 * URL — for either locale, so the smoke sets both `PDF_SOURCE` and
 * `PDF_LOCALE` together when it verifies `/en/cv.pdf`. That is the only thing
 * proving the PDF the Function serves passes the ATS, and not only the one
 * your machine produces: they are two different Chromiums — local Playwright
 * against Browser Rendering — over the same layout, and the only way to know
 * they print alike is to measure both.
 */
const DEFAULT_SOURCE = LOCALE === "es" ? "dist/cv.pdf" : `dist/${LOCALE}/cv.pdf`;
const SOURCE = process.env.PDF_SOURCE ?? DEFAULT_SOURCE;

let rawBytes: Uint8Array | undefined;

/**
 * The PDF bytes, read ONCE.
 *
 * Each test used to call `readFile` on its own, which with a local file is
 * free; against a URL it would be nine requests — and nine renders if the edge
 * cache misses. It returns a copy because pdf.js keeps the `Uint8Array` it
 * receives: reusing the same one leaves it empty on the second test.
 */
async function load(): Promise<Uint8Array> {
  if (!rawBytes) {
    if (SOURCE.startsWith("http://") || SOURCE.startsWith("https://")) {
      const res = await fetch(SOURCE);
      // The 429 is told apart from the rest on purpose: it does not say "the PDF
      // is broken", it says "wait". It is the Browser Rendering quota, and
      // confusing the two sends you debugging the Function when there is nothing
      // to debug.
      assert.ok(
        res.status !== 429,
        `${SOURCE} returned 429: that is the Browser Rendering quota, not a PDF failure. ` +
          "The free plan gives 3 concurrent browsers and a new instance every 20 s. " +
          "Wait a minute and retry; if it persists, the day's 10 browser minutes are used up.",
      );
      assert.ok(res.ok, `${SOURCE} returned ${res.status} ${res.statusText}`);
      // A 200 with HTML is the symptom of the route not matching the Function
      // and Pages returning the site. Without this check the failure surfaces as
      // "InvalidPDFException" and you look on the wrong side.
      const type = res.headers.get("content-type") ?? "";
      assert.ok(
        type.includes("application/pdf"),
        `${SOURCE} returned content-type "${type}": that route is not serving a PDF`,
      );
      rawBytes = new Uint8Array(await res.arrayBuffer());
    } else {
      rawBytes = new Uint8Array(await readFile(SOURCE));
    }
  }
  return rawBytes.slice();
}

/** The PDF text in extraction order: exactly what a parser sees. */
async function extract(): Promise<{ text: string; pages: number }> {
  const doc = await getDocument({ data: await load() }).promise;

  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    text += textContent.items
      // The installed version of pdfjs-dist does carry types for this subpath (a
      // `.d.mts` re-exporting from the main package), unlike what the brief
      // assumed: the item can be a `TextItem` (with `str`) or a
      // `TextMarkedContent` (without `str`), hence the `in` check.
      .map((item) => ("str" in item ? (item.str ?? "") : ""))
      .join(" ");
    text += "\n";
  }
  return { text, pages: doc.numPages };
}

test("layer 1: the PDF has extractable text, it is not an image", async () => {
  const { text } = await extract();
  assert.ok(
    text.trim().length > 500,
    `the extracted text has ${text.trim().length} characters; a PDF exported as an image is discarded whole at layer 1`,
  );
});

test("layer 1: the parser finds the name, the title and every company", async () => {
  const { text } = await extract();
  const view = await content.getView("cv-ats", LOCALE);

  const normal = text.replace(/\s+/g, " ");
  assert.ok(normal.includes(view.identity.fullName), "the full name is missing");
  assert.ok(normal.includes(view.identity.searchTitle), "the searchTitle is missing");

  for (const role of view.experience) {
    assert.ok(
      normal.includes(role.company),
      `the company "${role.company}" is missing from the extracted text`,
    );
  }
});

test("layer 1: the extraction order is sane (name before the first role)", async () => {
  const { text } = await extract();
  const view = await content.getView("cv-ats", LOCALE);
  const normal = text.replace(/\s+/g, " ");

  const namePos = normal.indexOf(view.identity.fullName);
  const firstRolePos = normal.indexOf(view.experience[0].company);
  assert.ok(
    namePos >= 0 && namePos < firstRolePos,
    "the name does not appear before the first role: the reading order is broken",
  );
});

test("the CV does not exceed 2 pages", async () => {
  const { pages } = await extract();
  assert.ok(pages <= 2, `the PDF has ${pages} pages; the maximum is 2 (docs/03 §2)`);
});

test("no dataset TODO reached the PDF", async () => {
  const { text } = await extract();
  assert.ok(
    !text.includes("TODO"),
    "there is a TODO in the PDF: either the datum gets filled in or that field stops rendering",
  );
});

test("layer 1: the standard section names extract whole", async () => {
  // A parser maps these headings to fields. If the CSS splits them into loose
  // glyphs ("P E R F I L"), the PDF looks fine and nobody reads it.
  const { text } = await extract();
  const normal = text.replace(/\s+/g, " ");

  // The headings are CV content and a parser maps them exactly as they are
  // printed — in whichever language this run's `LOCALE` is. Reading them from
  // `MESSAGES` instead of a literal list is what lets `test:pdf` run this same
  // assertion against the English PDF without a second copy of the list.
  const sections = [
    MESSAGES_FOR_LOCALE.sectionProfile,
    MESSAGES_FOR_LOCALE.sectionSkills,
    MESSAGES_FOR_LOCALE.sectionExperience,
    MESSAGES_FOR_LOCALE.sectionEducation,
    MESSAGES_FOR_LOCALE.sectionLanguages,
  ];
  for (const section of sections) {
    assert.match(
      normal,
      new RegExp(section, "i"),
      `the "${section}" section does not appear contiguous in the extracted text`,
    );
  }
});

test("layer 1: role titles and bullets extract whole", async () => {
  // formatRoleTitle y text.short son el textContent que de verdad se lee. Si el
  // CSS los parte en glifos sueltos, el PDF se ve bien y no dice nada.
  const { text } = await extract();
  const view = await content.getView("cv-ats", LOCALE);
  const normal = text.replace(/\s+/g, " ");

  for (const role of view.experience) {
    const title = formatRoleTitle(role, LOCALE);
    assert.ok(
      normal.includes(title),
      `the role title "${title}" does not appear contiguous in the extracted text`,
    );
    for (const a of role.achievements) {
      // The first 40 characters are enough: if the bullet split, it fails there.
      const start = a.text.short.slice(0, 40);
      assert.ok(
        normal.includes(start),
        `the bullet "${start}..." does not appear contiguous in the extracted text`,
      );
    }
  }
});

test("the PDF comes out tagged and with an outline, as promised", async () => {
  // `tagged: true` and `outline: true` are explicit renderPdf options. Without
  // this, if Chrome ever stopped honouring them nobody would find out.
  const doc = await getDocument({ data: await load() }).promise;

  const markInfo = await doc.getMarkInfo();
  assert.ok(markInfo?.Marked, "the PDF is not tagged: the explicit reading order is lost");

  const outline = await doc.getOutline();
  assert.ok(outline && outline.length > 0, "the PDF has no outline (per-section bookmarks)");
});

test("layer 1: the email and the links extract whole", async () => {
  // A URL broken by a line break extracts with a space inside and stops being a
  // URL. It is the field an ATS uses to find the profile.
  const { text } = await extract();
  const view = await content.getView("cv-ats", LOCALE);
  const normal = text.replace(/\s+/g, " ");

  assert.ok(
    normal.includes(view.identity.contact.email),
    `the email does not appear contiguous in the extracted text`,
  );
  for (const link of view.identity.links) {
    assert.ok(
      normal.includes(link.url),
      `the URL for ${link.label} (${link.url}) does not appear contiguous in the extracted text`,
    );
  }
});

/**
 * The fonts are embedded in the file, not resolved from the machine.
 *
 * None of the other ten tests can see this: they all verify the extracted TEXT,
 * which is identical whether the glyphs come from Manrope or from a fallback.
 * The PDF would look right on a machine with Manrope installed and wrong on
 * every other one, and nothing would say so.
 *
 * The risk stopped being theoretical on 2026-08-25: production prints with
 * Browser Rendering, another Chromium on another machine. This test runs against
 * both paths, because the file already accepts `PDF_SOURCE`.
 *
 * It reads the PDF structure by hand rather than through pdf.js: in the legacy
 * Node build the fonts are only populated into `commonObjs` while rendering to
 * a canvas, which does not exist here. Measured — `getOperatorList()` leaves it
 * empty. The precedent for parsing a binary by hand is `measureJpeg` in
 * `og-output.check.ts`.
 */
test("the fonts travel inside the PDF, they are not borrowed from the machine", async () => {
  const pdf = Buffer.from(await load()).toString("latin1");

  const baseFonts = [...pdf.matchAll(/\/BaseFont\s*\/([#\w+-]+)/g)].map((m) => m[1]!);
  assert.ok(baseFonts.length > 0, "the PDF declares no font at all");

  // A subset prefix (`AAAAAA+`) is written by the producer when it embeds only
  // the glyphs actually used. Its absence is the signature of a font referenced
  // by name and resolved by the viewer.
  const notSubset = baseFonts.filter((f) => !/^[A-Z]{6}\+/.test(f));
  assert.deepEqual(
    notSubset,
    [],
    `these fonts carry no subset prefix, so they are referenced and not embedded: ${notSubset.join(", ")}`,
  );

  // The failure mode this exists for: Manrope does not load — or one glyph is
  // outside the subset that IS loaded — Chromium substitutes, and part of the
  // PDF comes out in a system font.
  //
  // An allowlist and not a list of known substitutes: the substitute depends on
  // the machine. `→` was printed as DejaVuSans on the Linux runner and as
  // something else here, so a blacklist of Helvetica/DejaVu/Nimbus was red in CI
  // and green locally — the worst possible split for a gate.
  const foreign = baseFonts.filter((f) => !/Manrope/i.test(f));
  assert.deepEqual(
    foreign,
    [],
    `a font that is not Manrope reached the PDF: ${foreign.join(", ")}. ` +
      "Either Manrope did not load (check that the render still waits for " +
      "`document.fonts.ready`) or a character outside the `latin` subset was " +
      "printed and Chromium substituted for that glyph alone.",
  );

  // One embedded program per distinct font. `/FontFile2` is TrueType, which is
  // what a .woff2 becomes once printed; `/FontFile3` would be CFF. Counting them
  // against the distinct fonts is what catches "three declared, two embedded".
  const distinct = new Set(baseFonts).size;
  const programs = [...pdf.matchAll(/\/FontFile[23]?[\s/]/g)].length;
  assert.equal(
    programs,
    distinct,
    `${distinct} distinct fonts and ${programs} embedded programs. ` +
      "Every font in the file needs its own /FontFile: the ones missing it render " +
      "with whatever the viewer has.",
  );
});

test("rule 8: neither the phone nor the address appear in the PDF", async () => {
  const { text } = await extract();
  const data = await content.getDataset(LOCALE);
  const normal = text.replace(/\s+/g, " ");

  if (data.identity.contact.phone) {
    assert.ok(!normal.includes(data.identity.contact.phone), "the phone number appeared in the PDF");
  }
  if (data.identity.location.streetAddress) {
    assert.ok(
      !normal.includes(data.identity.location.streetAddress),
      "the street address appeared in the PDF",
    );
  }
});
