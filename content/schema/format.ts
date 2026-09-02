/**
 * Text derived from data. The other half of the output contract.
 *
 * Rule 1: no duration or seniority is ever written by hand. Components receive
 * already formatted strings; a `${months} meses` inside an `.astro` means this
 * layer has forked.
 *
 * NOTE: the strings this module emits stay in Spanish. They are CV content, not
 * code — the reader of the CV reads Spanish. Only the code around them is in
 * English.
 *
 * The date format is `MM/AAAA` because `docs/03-cv.md` §2 asks for it:
 * consistent, with no month names that shift between surfaces.
 */

import type { Role, YearMonth } from "./content-schema";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "2023-07" → "07/2023". */
export function formatYearMonth(ym: YearMonth): string {
  const [year, month] = ym.split("-");
  return `${month.padStart(2, "0")}/${year}`;
}

/**
 * Range of a role. `end === null` means "still current", not "the datum is
 * missing": which is why it renders "Actualidad" and not a blank.
 */
export function formatDateRange(start: YearMonth, end: YearMonth | null): string {
  return `${formatYearMonth(start)} — ${end ? formatYearMonth(end) : "Actualidad"}`;
}

/**
 * Months → "1 año 11 meses". Spelled out rather than abbreviated because a
 * human reads it in 10 seconds, and so does an LLM cross-checking dates against
 * the ranges.
 */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;

  const partYears = years === 1 ? "1 año" : `${years} años`;
  const partMonths = rest === 1 ? "1 mes" : `${rest} meses`;

  if (years === 0) return partMonths;
  if (rest === 0) return partYears;
  return `${partYears} ${partMonths}`;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Rule 2: two overlapping roles with no clarification are an automatic red flag,
 * both for the AI layer and for the human. If the datum says `concurrent`, the
 * title declares it.
 *
 * Typed on the three fields it reads, not on `Role` itself: callers pass a
 * view's `Viewed<Role>`, which has no `visibility`, and this function has no
 * business demanding a field it never looks at.
 */
export function formatRoleTitle(
  role: Pick<Role, "title" | "displayTitle" | "concurrent">,
): string {
  const title = role.displayTitle ?? role.title;
  return role.concurrent ? `${title} (en paralelo)` : title;
}

/**
 * Rule 1: the number comes from `ContentView.yearsOfExperience`, which in turn
 * comes from `careerStart`. This function only puts the words around it.
 */
export function formatSeniority(years: number): string {
  return `${years}+ años`;
}
