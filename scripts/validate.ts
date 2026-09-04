/**
 * Run this in CI: `pnpm run validate`.
 * Exits with code 1 if the dataset violates any contract rule.
 */
import { validateDataset } from "../content/schema/validation";
import datasetEs from "../content/data/content.es.json";
import datasetEn from "../content/data/content.en.json";

// Every locale, not only the authored one. The rules are about the content, and
// a translation breaks rule 1 more easily than the original does: "over two
// years" is the natural English way to say what the dates already say.
const datasets: Array<[string, unknown]> = [
  ["content.es.json", datasetEs],
  ["content.en.json", datasetEn],
];

let failed = false;
for (const [name, dataset] of datasets) {
  try {
    validateDataset(dataset);
    console.log(`${name}: valid.`);
  } catch (err) {
    console.error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  }
}
if (failed) process.exit(1);
