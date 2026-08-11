/**
 * Corré esto en CI: `npm run validate`.
 * Falla con código 1 si el dataset viola alguna regla del contrato.
 */
import { validateDataset } from "../content/schema/validation";
import dataset from "../content/data/content.es.json";

try {
  validateDataset(dataset);
  console.log("Dataset válido.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
