/**
 * `unknown` → a structured verdict.
 *
 * The editor needs the same answer `pnpm run validate` gives, in a shape a form
 * can render: each Zod issue anchored to its path, and rule violations kept
 * separate because they are cross-entity — rule 2 spans roles, rule 3 spans
 * skills and achievements — and belong in a panel, not on a field.
 *
 * It decides NOTHING itself. `datasetSchema` and `checkRules` are the same two
 * things `validateDataset` composes; a rule reimplemented here is a rule that
 * would drift from CI.
 */

import type { ContentDataset } from "../content/schema/content-schema";
import type { RuleViolation } from "../content/schema/validation";
import { checkRules, datasetSchema } from "../content/schema/validation";

/** One Zod failure, with the dotted path the form uses to find its input. */
export interface ZodIssueReport {
  path: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  zodIssues: ZodIssueReport[];
  violations: RuleViolation[];
}

export function inspectDataset(input: unknown): ValidationReport {
  const parsed = datasetSchema.safeParse(input);

  if (!parsed.success) {
    // Rules are not evaluated here on purpose: `checkRules` indexes into a
    // dataset it assumes is already parsed, so running it over a wrong shape
    // would throw where a report is expected.
    return {
      ok: false,
      zodIssues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      violations: [],
    };
  }

  const violations = checkRules(parsed.data as ContentDataset);
  return { ok: violations.length === 0, zodIssues: [], violations };
}
