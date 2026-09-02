/**
 * Contract rule 4: a `Metric` with `confidence: "estimated"` is NEVER presented
 * as a measurement.
 *
 * This file is the only place in the system where a `Metric` becomes text. If a
 * `${m.delta}` shows up in a component, the rule has forked and stopped
 * holding. Just as `dates.ts` is the file of rule 1, this one is rule 4's.
 */

import type { Metric } from "./content-schema";

/** Estimation marker. The contract allows "~" or "aprox."; "~" wins on space. */
const APPROX = "~";

/**
 * `Metric` → text ready to render, or `null` when there is no number at all.
 *
 * It returns `null` and not `""` on purpose: the caller has to be able to drop
 * the whole fragment. An empty string slips into a template and leaves a dash
 * dangling in the CV.
 *
 * `before`/`after` wins over `delta` because showing the full movement is more
 * defensible in an interview than a percentage on its own.
 *
 * The movement is written "de X a Y" and NOT with an arrow: `→` (U+2192) is
 * outside Manrope's `latin` subset, the only one the pages load. Chromium
 * silently substitutes a system font for that one glyph, so the PDF stopped
 * carrying only embedded fonts — which is exactly what `pdf-output.check.ts`
 * refuses. Anything this file emits gets printed: it stays inside the subset.
 */
export function formatMetric(m: Metric): string | null {
  const approx = m.confidence === "estimated" ? APPROX : "";

  if (m.before && m.after) return `de ${approx}${m.before} a ${approx}${m.after}`;
  if (m.delta) return `${approx}${m.delta}`;
  return null;
}
