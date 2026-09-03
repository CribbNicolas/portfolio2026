/**
 * Checks that `content/data/content.en.json` is a real, current translation of
 * `content/data/content.es.json` — not merely present, and not merely once
 * correct.
 *
 * Four failures, kept apart because each has a different fix:
 *
 * 1. TRACKED-PATH DRIFT — a tracked (translatable) path exists in one dataset
 *    and not the other. The English dataset has a PROSE field wrong, missing
 *    or extra.
 * 2. STRUCTURAL DRIFT — anything OUTSIDE the tracked set differs between the
 *    two datasets: an id, a date, a `skillIds` entry, a `visibility.priority`,
 *    a `Metric.confidence`. This is the gap (1) cannot see: a path `NOT_TEXT`
 *    excludes never appears in either dataset's tracked set, so two tracked
 *    sets can agree completely while `roles.dinkum.start` quietly disagrees.
 *    Caught by comparing `structuralSkeleton(es)` against
 *    `structuralSkeleton(en)` — the same dataset with every tracked leaf
 *    blanked, so a deep-equal only fails on what neither dataset considers
 *    prose.
 * 3. MISSING TRANSLATION — a tracked path whose English text is still byte-
 *    identical to the Spanish one, and long enough that identical can only
 *    mean "never translated". A short string (`Mapbox GL JS`) is legitimately
 *    the same in both languages; a threshold, not "any match", is what tells
 *    them apart.
 * 4. STALE TRANSLATION — the Spanish text's hash no longer matches what is
 *    recorded in `translation.lock.json`: the Spanish moved after the English
 *    was written from it, and nobody has looked at the English since.
 *
 * The lock is what makes (4) possible without a per-file `updatedAt`: a field
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
import { hashOf, structuralSkeleton, translatableFields } from "./i18n-fields";
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

/**
 * Collects every path where two skeletons disagree, walking both in parallel
 * with the same id-keyed convention `structuralSkeleton` builds its paths
 * with — so a report reads `roles.dinkum.start`, not `roles.2.start`.
 */
function diffSkeletons(a: unknown, b: unknown, path: string, out: string[]): void {
  // The ONE field the two datasets are SUPPOSED to disagree on: `locale` is
  // "es" in one file and "en" in the other by definition (content-schema.ts
  // §"Locale"), not drift. Every other top-level and nested field describes
  // the same career and has to match.
  if (path === "locale") return;

  const arrayKey = (item: unknown, i: number): string =>
    typeof (item as { id?: unknown })?.id === "string" ? (item as { id: string }).id : String(i);

  if (Array.isArray(a) || Array.isArray(b)) {
    const arrA = Array.isArray(a) ? a : [];
    const arrB = Array.isArray(b) ? b : [];
    if (arrA.length !== arrB.length) {
      out.push(`${path} (${arrA.length} items in ES, ${arrB.length} in EN)`);
      return;
    }
    arrA.forEach((item, i) => diffSkeletons(item, arrB[i], path ? `${path}.${arrayKey(item, i)}` : arrayKey(item, i), out));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const key of keys) {
      diffSkeletons((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  if (a !== b) out.push(path);
}

test("the two datasets are structurally identical outside translated text", () => {
  // `translatableFields()`'s own key-set diff (the test right below) can only
  // report drift on a path it TRACKS. A date, an id, a `skillIds` entry or a
  // `visibility.priority` never enters that set for either dataset, so both
  // could agree on every tracked path while disagreeing on everything else —
  // proven true against the committed pair before C2 was fixed (see the PR's
  // fix report). Blanking every tracked leaf and deep-comparing what remains
  // is what actually holds up the promise in docs/10 §3 and the design spec's
  // §3.1: structural fields are IDENTICAL in both files.
  const diffs: string[] = [];
  diffSkeletons(
    structuralSkeleton(es as never as ContentDataset),
    structuralSkeleton(en as never as ContentDataset),
    "",
    diffs,
  );
  assert.deepEqual(
    diffs,
    [],
    "ES and EN disagree outside translated text — these paths are not tracked " +
      `by translatableFields() and must be IDENTICAL in both datasets:\n${diffs.join("\n")}`,
  );
});

test("a project's name is tracked; a skill's name is not", () => {
  assert.ok(esFields.has("projects.mapas-distritos.name"));
  assert.equal(esFields.has("skills.typescript.name"), false);
});

test("a language's display name is tracked; a skill's name is not", () => {
  // "Español"/"Inglés" is a word IN the language it names, translated the
  // same way any other prose is; "TypeScript" is a proper noun with no
  // English form to write. `languages` items have no `id`; `arrayKey` uses
  // `code`, so the path is `languages.es.name`.
  assert.ok(esFields.has("languages.es.name"));
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
