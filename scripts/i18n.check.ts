/**
 * Checks that `content/data/content.en.json` is a real, current translation of
 * `content/data/content.es.json` — not merely present, and not merely once
 * correct.
 *
 * Three failures, kept apart because each has a different fix:
 *
 * 1. STRUCTURE DRIFT — a tracked path exists in one dataset and not the
 *    other. The English dataset has a field wrong, missing or extra.
 * 2. MISSING TRANSLATION — a tracked path whose English text is still byte-
 *    identical to the Spanish one, and long enough that identical can only
 *    mean "never translated". A short string (`Mapbox GL JS`) is legitimately
 *    the same in both languages; a threshold, not "any match", is what tells
 *    them apart.
 * 3. STALE TRANSLATION — the Spanish text's hash no longer matches what is
 *    recorded in `translation.lock.json`: the Spanish moved after the English
 *    was written from it, and nobody has looked at the English since.
 *
 * The lock is what makes (3) possible without a per-file `updatedAt`: a field
 * timestamp goes stale the moment ANY Spanish text changes, whether or not it
 * is the field the reader is looking at. A hash per FIELD only fires for the
 * field that actually moved.
 *
 * Not a `*.test.ts`: it reads two committed datasets and a committed lock,
 * like `data-format.check.ts` reads the committed dataset.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { ContentDataset } from "../content/schema/content-schema";
import { hashOf, translatableFields } from "./i18n-fields";
import es from "../content/data/content.es.json";
import en from "../content/data/content.en.json";
import lock from "../content/data/translation.lock.json";

const esFields = translatableFields(es as never as ContentDataset);
const enFields = translatableFields(en as never as ContentDataset);
const lockedHashes = (lock as { fields: Record<string, string> }).fields;

/** Named in every failure below, the way `test:format` names `format:data`. */
const RELOCK = "pnpm run i18n:lock";

// A label this short reads the same in Spanish and English on purpose
// (`Mapbox GL JS`, `500 ms`); a paragraph that still reads the same was
// pasted, not translated. See the ruling in i18n-fields.ts for what NOT_TEXT
// already keeps out of this set entirely (ids, proper nouns, `Metric.source`).
const UNTRANSLATED_MIN_LENGTH = 40;

test("the two datasets have the same structure", () => {
  // Only human text may differ. An id, a date or a `skillIds` that diverges is
  // not a translation, it is a second dataset drifting.
  const missing = [...esFields.keys()].filter((p) => !enFields.has(p));
  const extra = [...enFields.keys()].filter((p) => !esFields.has(p));
  assert.deepEqual(
    missing,
    [],
    `in ES and missing (or empty) in EN — write the English text, then \`${RELOCK}\`:\n${missing.join("\n")}`,
  );
  assert.deepEqual(
    extra,
    [],
    `in EN and missing in ES — correct the English dataset, then \`${RELOCK}\`:\n${extra.join("\n")}`,
  );
});

test("a project's name is tracked; a skill's name is not", () => {
  assert.ok(esFields.has("projects.mapas-distritos.name"));
  assert.equal(esFields.has("skills.typescript.name"), false);
});

test("no long tracked field was left untranslated", () => {
  const untranslated = [...esFields.entries()]
    .filter(([path]) => enFields.has(path))
    .filter(([, value]) => value.length > UNTRANSLATED_MIN_LENGTH)
    .filter(([path, value]) => enFields.get(path) === value)
    .map(([path]) => path);

  assert.deepEqual(
    untranslated,
    [],
    `Spanish text copied into the English dataset with no translation — write the English text, then \`${RELOCK}\`:\n${untranslated.join("\n")}`,
  );
});

test("every tracked field is stamped and matches the Spanish text it was translated from", () => {
  const unstamped = [...esFields.keys()].filter((p) => !(p in lockedHashes));
  assert.deepEqual(
    unstamped,
    [],
    `tracked but never stamped in translation.lock.json — after translating, run \`${RELOCK}\` and commit the result:\n${unstamped.join("\n")}`,
  );

  const stale = [...esFields.entries()]
    .filter(([path, value]) => lockedHashes[path] !== hashOf(value))
    .map(([path]) => path);

  assert.deepEqual(
    stale,
    [],
    `Spanish text changed since the English was translated from it — update the English, then \`${RELOCK}\`:\n${stale.join("\n")}`,
  );
});
