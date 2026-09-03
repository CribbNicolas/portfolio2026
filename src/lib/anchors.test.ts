/**
 * Locale → URL lives in ONE table. These tests pin the lookups the four
 * previous copies used to disagree on: a third locale that compiled against
 * a ternary would have silently become English.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Locale } from "../../content/schema/content-schema";
import {
  ANCHORS,
  LOCALE_PATHS,
  OTHER_LOCALE,
  anchorScrollCss,
  sourcePath,
} from "./anchors";

const LOCALES: Locale[] = ["es", "en"];

test("every locale has a home, a CV page and a PDF", () => {
  for (const locale of LOCALES) {
    assert.equal(typeof LOCALE_PATHS[locale].home, "string");
    assert.equal(typeof LOCALE_PATHS[locale].cv, "string");
    assert.equal(typeof LOCALE_PATHS[locale].pdf, "string");
    assert.match(LOCALE_PATHS[locale].pdf, /\.pdf$/);
  }
});

test("sourcePath is the CV page, not a ternary that defaults to English", () => {
  assert.equal(sourcePath("es"), "/cv");
  assert.equal(sourcePath("en"), "/en/cv");
  for (const locale of LOCALES) {
    assert.equal(sourcePath(locale), LOCALE_PATHS[locale].cv);
  }
});

test("the other locale is a table, so a third language is a compile error", () => {
  assert.equal(OTHER_LOCALE.es, "en");
  assert.equal(OTHER_LOCALE.en, "es");
  assert.equal(LOCALE_PATHS[OTHER_LOCALE.es].home, "/en/");
  assert.equal(LOCALE_PATHS[OTHER_LOCALE.en].home, "/");
});

test("the scroll-margin rule names every landing anchor, both languages", () => {
  const css = anchorScrollCss();
  assert.match(css, /scroll-margin-top/);
  for (const locale of LOCALES) {
    for (const id of Object.values(ANCHORS[locale])) {
      assert.match(css, new RegExp(`#${id}(?:\\s|,|{)`), `#${id} is missing from the scroll-margin rule`);
    }
  }
});
