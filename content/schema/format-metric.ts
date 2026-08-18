/**
 * Regla 4 del contrato: una `Metric` con `confidence: "estimated"` NUNCA se
 * presenta como medición.
 *
 * Este archivo es el único lugar del sistema donde una `Metric` se vuelve
 * texto. Si aparece un `${m.delta}` en un componente, la regla se bifurcó y
 * dejó de valer. Igual que `dates.ts` es el archivo de la regla 1, este es el
 * de la regla 4.
 */

import type { Metric } from "./content-schema";

/** Marca de estimación. El contrato admite "~" o "aprox."; usamos "~" por espacio. */
const APROX = "~";

/**
 * `Metric` → texto listo para renderizar, o `null` si no hay ningún número.
 *
 * Devuelve `null` y no `""` a propósito: el llamador tiene que poder omitir el
 * fragmento completo. Un string vacío se cuela en un template y deja un guion
 * colgando en el CV.
 *
 * `before`/`after` gana sobre `delta` porque mostrar el movimiento completo es
 * más defendible en entrevista que un porcentaje suelto.
 */
export function formatMetric(m: Metric): string | null {
  const aprox = m.confidence === "estimated" ? APROX : "";

  if (m.before && m.after) return `${aprox}${m.before} → ${aprox}${m.after}`;
  if (m.delta) return `${aprox}${m.delta}`;
  return null;
}
