/**
 * Texto derivado de datos. La otra mitad del contrato de salida.
 *
 * Regla 1: ninguna duración ni antigüedad se escribe a mano. Los componentes
 * reciben strings ya formateados; un `${meses} meses` dentro de un `.astro`
 * significa que esta capa se bifurcó.
 *
 * El formato de fecha es `MM/AAAA` porque lo pide `docs/03-cv.md` §2:
 * consistente, sin nombres de mes que cambien entre superficies.
 */

import type { Role, YearMonth } from "./content-schema";

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** "2023-07" → "07/2023". */
export function formatYearMonth(ym: YearMonth): string {
  const [year, month] = ym.split("-");
  return `${month.padStart(2, "0")}/${year}`;
}

/**
 * Rango de un rol. `end === null` significa "sigue vigente", no "falta el dato":
 * por eso rinde "Actualidad" y no un vacío.
 */
export function formatDateRange(start: YearMonth, end: YearMonth | null): string {
  return `${formatYearMonth(start)} — ${end ? formatYearMonth(end) : "Actualidad"}`;
}

/**
 * Meses → "1 año 11 meses". En palabras y no abreviado porque lo lee un humano
 * en 10 segundos y también un LLM que cruza fechas contra los rangos.
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
 * Regla 2: dos roles solapados sin aclaración son una bandera roja automática,
 * tanto para la capa de IA como para el humano. Si el dato dice `concurrent`,
 * el título lo declara.
 */
export function formatRoleTitle(role: Role): string {
  const title = role.displayTitle ?? role.title;
  return role.concurrent ? `${title} (en paralelo)` : title;
}

/**
 * Regla 1: el número viene de `ContentView.yearsOfExperience`, que a su vez sale
 * de `careerStart`. Esta función solo le pone las palabras alrededor.
 */
export function formatSeniority(years: number): string {
  return `${years}+ años`;
}
