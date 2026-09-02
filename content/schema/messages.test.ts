import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGES } from "./messages";

test("both locales define the same keys", () => {
  // The type already guarantees it. This catches the other direction: a key
  // added to `en` and forgotten in `es` compiles if `Messages` was widened.
  assert.deepEqual(Object.keys(MESSAGES.es).sort(), Object.keys(MESSAGES.en).sort());
});

test("no message is empty", () => {
  for (const [locale, dict] of Object.entries(MESSAGES)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(value.trim().length > 0, `${locale}.${key} is empty`);
    }
  }
});

test("the CV section names are the standard ones docs/03 §2 asks for", () => {
  // A parser maps these headings to fields. "Mi stack" maps to nothing.
  assert.equal(MESSAGES.es.sectionSkills, "Habilidades técnicas");
  assert.equal(MESSAGES.en.sectionSkills, "Technical skills");
});
