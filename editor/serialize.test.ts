/**
 * The canonical written form of the dataset.
 *
 * `JSON.stringify(data, null, 2)` would rewrite all 344 lines on the first
 * save: it drops the blank lines between top-level sections and expands the
 * one-object-per-line style of `skills`. Every data commit would then mix the
 * real change with a reformat — and half the reason the data is still in git is
 * that its diffs are readable.
 *
 * Round trip and idempotence are the two properties that make this safe to
 * own: whatever the layout rules do, no datum is lost and running it twice
 * changes nothing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "./serialize";

const DATA_FILE = "content/data/content.es.json";

const dataset = JSON.parse(
  (await readFile(DATA_FILE, "utf8")).replace(/\r\n/g, "\n"),
) as ContentDataset;

// ---------------------------------------------------------------------------
// The properties that matter more than the layout
// ---------------------------------------------------------------------------

test("round trip: what comes back out parses back to the same data", () => {
  assert.deepEqual(JSON.parse(serializeDataset(dataset)), dataset);
});

test("idempotence: serializing what was already serialized changes nothing", () => {
  const once = serializeDataset(dataset);
  const twice = serializeDataset(JSON.parse(once) as ContentDataset);
  assert.equal(twice, once);
});

test("it ends in exactly one newline and never emits a carriage return", () => {
  const out = serializeDataset(dataset);
  assert.ok(out.endsWith("}\n"));
  assert.ok(!out.includes("\r"));
});

// ---------------------------------------------------------------------------
// The layout rules
// ---------------------------------------------------------------------------

const lines = serializeDataset(dataset).split("\n");
const lineWith = (needle: string): string => {
  const found = lines.find((l) => l.includes(needle));
  assert.ok(found, `no line contains ${needle}`);
  return found;
};

test("rule 3: a blank line before every top-level key but the first three", () => {
  const header = lines.slice(0, 4);
  assert.equal(header[1].trim().startsWith('"schemaVersion"'), true);
  assert.equal(header[3].trim().startsWith('"updatedAt"'), true);
  assert.equal(lines[4], "");

  for (const key of ["identity", "skills", "roles", "achievements", "projects",
                     "education", "certifications", "languages", "services", "testimonials"]) {
    const at = lines.findIndex((l) => l.startsWith(`  "${key}"`));
    assert.notEqual(at, -1, `no top-level line for ${key}`);
    assert.equal(lines[at - 1], "", `${key} has no blank line before it`);
  }
});

test("rule 4: a short array of scalars stays on one line", () => {
  assert.match(lineWith('"skillIds"'), /"skillIds": \[".+"\],?$/);
});

test("rule 4: titleAliases is 110 columns inline, so it expands", () => {
  const at = lines.findIndex((l) => l.includes('"titleAliases"'));
  assert.match(lines[at], /"titleAliases": \[$/);
});

test("rule 5: a skill is one inline object per line", () => {
  assert.match(lineWith('"id": "typescript"'), /^ {4}\{ "id": "typescript",.*\},?$/);
});

test("rule 5: links print inline too, even though they are not a top-level collection", () => {
  assert.match(lineWith('"label": "GitHub"'), /^ {6}\{ "label": "GitHub", .*\},?$/);
});

test("rule 5: visibility is inline wherever it appears", () => {
  assert.ok(lines.some((l) => l.trim() === '"visibility": { "priority": 1 }'));
});

test("rule 5: prose and decisions stay expanded — they are read, not scanned", () => {
  assert.match(lineWith('"problem"'), /"problem": \{$/);
  assert.match(lineWith('"decisions"'), /"decisions": \[$/);
});

test("rule 2: keys come out in the schema's order, not the object's", () => {
  // `locale` first in the input; merging the rest on top cannot move it back,
  // because an existing key keeps its position (Object.assign, like a spread,
  // overwrites the value in place). The serializer has to reorder it anyway.
  const reordered = { locale: dataset.locale } as ContentDataset;
  Object.assign(reordered, dataset);
  const out = serializeDataset(reordered).split("\n");
  assert.match(out[1], /"schemaVersion"/);
  assert.match(out[2], /"locale"/);
});

test("an empty array is `[]`, not two lines", () => {
  assert.ok(lines.some((l) => l.trim() === '"certifications": [],'));
});

test("null survives: an open role has end: null, not a missing key", () => {
  assert.ok(lines.some((l) => l.trim() === '"end": null,'));
});
