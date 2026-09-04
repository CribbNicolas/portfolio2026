/**
 * Writes every committed dataset in canonical form.
 *
 * It exists so the gate has an answer: `data-format.check.ts` tells you the
 * file has drifted, and this is what puts it back. Deliberately not a
 * `*.test.ts` — it writes.
 *
 * The writing itself belongs to `DatasetStore`, which validates before it
 * serializes, parses its own output back before it saves, and renames a
 * temporary file into place rather than truncating the real one. Keeping a
 * second copy of that here would mean the careful version and the casual
 * version both existed, and the casual one is the one that can leave a
 * half-written source of truth.
 */

import { readFile } from "node:fs/promises";

import { DATASET_FILES, DatasetStore, InvalidDatasetError } from "../editor/store";

// Every committed dataset, not only the authored one: the English file is
// hand-edited too, and a file the formatter never visits is a file that drifts.
for (const file of DATASET_FILES) {
  const store = new DatasetStore(file);
  const before = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");

  // A rule violation here is data to fix, not a crash: print the rule messages
  // alone, the same way `validate.ts` does, instead of a raw stack trace.
  try {
    const { data, etag } = await store.read();
    await store.write(data, etag);
  } catch (err) {
    if (err instanceof InvalidDatasetError) {
      console.error(file);
      for (const issue of err.report.zodIssues) console.error(`  ${issue.path}: ${issue.message}`);
      for (const violation of err.report.violations) {
        console.error(`  [rule ${violation.rule}] ${violation.message}`);
      }
      process.exit(1);
    }
    // Hand-broken JSON (a stray comma, a missing brace) is a plausible reason to
    // reach for this script in the first place, and `store.read()` throws a bare
    // `SyntaxError` for it — not an `InvalidDatasetError`, since the file never
    // got far enough to be validated. A message beats a stack trace here too.
    console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const after = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
  console.log(
    after === before ? `${file} was already canonical.` : `${file} rewritten in canonical form.`,
  );
}
