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
