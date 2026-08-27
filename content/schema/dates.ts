/**
 * Date and duration arithmetic. Single source.
 *
 * Contract rule 1: every duration and seniority is DERIVED here. "5 years" is
 * never typed by hand anywhere. If you need a duration you compute it with
 * these functions.
 *
 * `validation.ts` and `resolve-view.ts` import from here. Do not duplicate this
 * logic.
 */

/** Converts "YYYY-MM" to absolute months, so they can be subtracted and compared. */
export const toMonths = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m;
};

/** Current month as "YYYY-MM". This is what `end === null` stands for ("up to today"). */
export const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

/** Months between `start` and `end`. `end === null` means up to today. */
export const monthsBetween = (start: string, end: string | null): number =>
  toMonths(end ?? currentYearMonth()) - toMonths(start);

/** Years of experience derived from `careerStart`. Rule 1: never by hand. */
export const yearsOfExperience = (careerStart: string): number =>
  Math.floor(monthsBetween(careerStart, null) / 12);

/**
 * Minimal shape of a time span. Structural on purpose: `dates.ts` does not
 * import `content-schema.ts`, so a declared `SkillPeriod` and a span derived
 * from a role or a project both fit through here without coupling this layer
 * to the data model.
 */
export interface Period {
  start: string;
  /** No `end` means it is still open, i.e. up to today. */
  end?: string | null;
}

/**
 * Months covered by a set of periods, merging the ones that overlap.
 *
 * A sum, not a span. An end-to-end span would count the gaps as experience:
 * declaring React 2019–2021 and 2024–2025 would report six years for three.
 * Merging covers the opposite case — using React in two jobs at once is not
 * twice the same years — which is why this used to be a span.
 */
export const monthsFromPeriods = (periods: readonly Period[]): number => {
  const today = toMonths(currentYearMonth());
  const ranges = periods
    .map((p) => ({ from: toMonths(p.start), to: p.end ? toMonths(p.end) : today }))
    .sort((a, b) => a.from - b.from);

  let total = 0;
  let open: { from: number; to: number } | null = null;

  for (const r of ranges) {
    if (open && r.from <= open.to) {
      // Overlapping or touching: stretch the current range, do not add it.
      open.to = Math.max(open.to, r.to);
      continue;
    }
    if (open) total += open.to - open.from;
    open = { ...r };
  }
  if (open) total += open.to - open.from;

  return total;
};
