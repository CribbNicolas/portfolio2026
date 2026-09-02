/**
 * The committed dataset is in canonical form.
 *
 * Without this the format holds only while the editor is the only writer, and
 * it will not be: the file is still edited by hand, and a merge can resolve a
 * conflict into something the serializer would never emit. The next editor save
 * would then produce a diff full of reformatting that nobody asked for.
 *
 * The comparison normalizes line endings on purpose. `core.autocrlf` is true on
 * the development machine and the CI checkout is LF, so a byte comparison would
 * fail on Windows and pass on the runner — the worst shape a gate can have.
 *
 * Not a `*.test.ts`: it reads a committed artifact, like
 * `pdf-output.check.ts` and `og-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "../editor/serialize";

const FILE = "content/data/content.es.json";
const raw = (await readFile(FILE, "utf8")).replace(/\r\n/g, "\n");

test("the dataset parses", () => {
  assert.doesNotThrow(() => JSON.parse(raw), `${FILE} is not valid JSON`);
});

test("the dataset is written in canonical form", () => {
  const expected = serializeDataset(JSON.parse(raw) as ContentDataset);
  assert.equal(
    raw,
    expected,
    `${FILE} is not in canonical form. Run \`pnpm run format:data\` and commit the result.`,
  );
});
