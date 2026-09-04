/**
 * Writes `content/data/translation.lock.json`: a hash of every Spanish string
 * that was translated into the English dataset, so `i18n.check.ts` can tell a
 * translation that was never touched apart from one that drifted out from
 * under it.
 *
 * `pnpm run i18n:lock`. Run it after the English dataset is brought back in
 * sync with the Spanish one — it re-stamps the lock to the CURRENT Spanish
 * text, the same way `pnpm run og:local` re-stamps `og.lock.json` to the
 * current inputs. It does not check anything; `i18n.check.ts` does that.
 *
 * Keys are written sorted, not in walk order, so touching unrelated content
 * never reorders this file and a regeneration with no real change produces no
 * diff — the same canonical-form contract `serializeDataset` keeps for the
 * datasets themselves.
 */

import { writeFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { hashOf, translatableFields } from "./i18n-fields";
import es from "../content/data/content.es.json";

const LOCK_FILE = "content/data/translation.lock.json";

const fields = translatableFields(es as never as ContentDataset);

const sortedFields: Record<string, string> = {};
for (const path of [...fields.keys()].sort()) {
  sortedFields[path] = hashOf(fields.get(path)!);
}

await writeFile(LOCK_FILE, JSON.stringify({ version: 1, fields: sortedFields }, null, 2) + "\n");

console.log(`${LOCK_FILE} stamped with ${fields.size} fields from content.es.json.`);
