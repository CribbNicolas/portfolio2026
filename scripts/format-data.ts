/**
 * Writes `content.es.json` in canonical form.
 *
 * It exists so the gate has an answer: `data-format.check.ts` tells you the
 * file has drifted, and this is what puts it back. Deliberately not a
 * `*.test.ts` — it writes.
 *
 * It validates before writing. Formatting a dataset that does not pass the
 * rules would produce a tidy file that CI rejects anyway, and the error you
 * want is the rule one.
 */

import { readFile, writeFile } from "node:fs/promises";

import { validateDataset } from "../content/schema/validation";
import { serializeDataset } from "../editor/serialize";

const FILE = "content/data/content.es.json";

const raw = (await readFile(FILE, "utf8")).replace(/\r\n/g, "\n");
const data = validateDataset(JSON.parse(raw));
const out = serializeDataset(data);

if (out === raw) {
  console.log(`${FILE} is already canonical.`);
} else {
  await writeFile(FILE, out, "utf8");
  console.log(`${FILE} rewritten in canonical form.`);
}
