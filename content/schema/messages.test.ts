import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGES } from "./messages";
import type { Messages } from "./messages";

test("both locales define the same keys", () => {
  // The type already guarantees it. This catches the other direction: a key
  // added to `en` and forgotten in `es` compiles if `Messages` was widened.
  assert.deepEqual(Object.keys(MESSAGES.es).sort(), Object.keys(MESSAGES.en).sort());
});

test("no message is empty", () => {
  // A handful of messages are functions (numbers are interpolated, not fixed
  // copy — `svgMapAriaLabel`, `stackEvidenceNote`, `emptyStackNote`): call
  // them with representative args and check the *output*, not the function
  // itself.
  for (const [locale, dict] of Object.entries(MESSAGES)) {
    for (const [key, raw] of Object.entries(dict)) {
      const value = typeof raw === "function" ? raw(1, 1) : raw;
      assert.ok(value.trim().length > 0, `${locale}.${key} is empty`);
    }
  }
});

test("the CV section names are the standard ones docs/03 §2 asks for", () => {
  // A parser maps these headings to fields. "Mi stack" maps to nothing.
  assert.equal(MESSAGES.es.sectionSkills, "Habilidades técnicas");
  assert.equal(MESSAGES.en.sectionSkills, "Technical skills");
});

test("no English message is a pasted Spanish string", () => {
  // The two locale blocks sit ~60 lines apart in this one file, hand-edited:
  // an equality check between them cannot tell "translated" from "copied",
  // because a real translation is SUPPOSED to differ from the Spanish — the
  // gap this test closes is the other direction, where nothing caught it
  // because nothing differs at all. An accented character (or an inverted
  // punctuation mark, `¿`/`¡`) has no legitimate reason to appear in English
  // copy, so its presence means a Spanish value was pasted into the `en`
  // block rather than translated. This clears every genuinely identical
  // short label ("Email", "Frontend", "CMS"), which by definition contains no
  // such character — an equality check against `MESSAGES.es` would instead
  // have to special-case each of those by hand.
  const SPANISH_ONLY_CHARS = /[áéíóúñ¿¡]/i;
  // `downloadCvOtherLocale` is the ONE key that is Spanish BY DESIGN on the
  // English side: it labels the button that downloads the *Spanish* CV
  // ("Descargar CV (español)"), named in the language of the file it hands
  // over rather than the language of the page showing it — the same reason
  // `MESSAGES.es.downloadCvOtherLocale` is deliberately English
  // ("Download CV (English)"). A real accidental paste would show up on ANY
  // other key; this is the only one allowed to fail the character test.
  const DELIBERATELY_OTHER_LOCALE = new Set(["downloadCvOtherLocale"]);
  for (const [key, raw] of Object.entries(MESSAGES.en)) {
    if (DELIBERATELY_OTHER_LOCALE.has(key)) continue;
    const value = typeof raw === "function" ? raw(1, 1) : raw;
    assert.doesNotMatch(
      value,
      SPANISH_ONLY_CHARS,
      `MESSAGES.en.${key} ("${value}") looks like pasted Spanish, not a translation`,
    );
  }
});

test("English chrome copy is not a silent paste of the Spanish", () => {
  // The accent test above misses bare-ASCII Spanish ("Proyectos", "Contacto").
  // Identical short labels are often legitimate ("Email"), so the allowlist
  // is the reviewable decision; every other key must actually differ.
  const MAY_BE_IDENTICAL = new Set<keyof Messages>(["emailLabel"]);
  const OTHER_LOCALE_ON_PURPOSE = new Set<keyof Messages>(["downloadCvOtherLocale"]);
  for (const key of Object.keys(MESSAGES.es) as (keyof Messages)[]) {
    if (MAY_BE_IDENTICAL.has(key) || OTHER_LOCALE_ON_PURPOSE.has(key)) continue;
    const es = MESSAGES.es[key];
    const en = MESSAGES.en[key];
    const esText = typeof es === "function" ? es(1, 1) : es;
    const enText = typeof en === "function" ? en(1, 1) : en;
    assert.notEqual(enText, esText, `MESSAGES.en.${key} is still the Spanish string`);
  }
});
