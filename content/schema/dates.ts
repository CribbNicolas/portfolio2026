/**
 * Cálculo de fechas y duraciones. Fuente única.
 *
 * Regla 1 del contrato: toda antigüedad o duración se DERIVA de acá.
 * Nunca se escribe "5 años" a mano en ningún lado. Si necesitás una duración,
 * la calculás con estas funciones; no la tipeás.
 *
 * `validation.ts` y `resolve-view.ts` importan de acá. No dupliques esta lógica.
 */

/** Convierte "YYYY-MM" a meses absolutos, para restar y comparar. */
export const toMonths = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m;
};

/** Mes actual como "YYYY-MM". Es lo que representa `end === null` ("hasta hoy"). */
export const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

/** Meses entre `start` y `end`. `end === null` = hasta hoy. */
export const monthsBetween = (start: string, end: string | null): number =>
  toMonths(end ?? currentYearMonth()) - toMonths(start);

/** Años de experiencia derivados de `careerStart`. Regla 1: nunca a mano. */
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
