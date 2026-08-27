/**
 * Run this in CI: `pnpm run validate`.
 * Exits with code 1 if the dataset violates any contract rule.
 */
import { validateDataset } from "../content/schema/validation";
import dataset from "../content/data/content.es.json";

try {
  validateDataset(dataset);
  console.log("Dataset valid.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
