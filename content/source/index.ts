/**
 * Punto de entrada del contenido.
 *
 * ESTA es la única línea que cambia cuando migres a Sanity o a backend propio.
 * Todo el frontend importa desde acá, nunca desde `json-source` directamente.
 */

import { JsonContentSource } from "./json-source";
import type { ContentSource } from "../schema/content-schema";

export const content: ContentSource = new JsonContentSource();

export * from "../schema/content-schema";

// El contrato de salida viaja con el contenido: quien consume datos también
// necesita convertirlos en texto sin reimplementar las reglas 1, 2 y 4.
// Así `src/` importa TODO de un solo lugar y el invariante 2 sigue siendo cierto.
export * from "../schema/format";
export * from "../schema/format-metric";

// El grafo es otra vista derivada del mismo contenido, igual que el formateo.
// Corre SOLO en build (frontmatter de /lab): nada de esto viaja al browser.
export * from "../schema/knowledge-graph";
export * from "../schema/graph-layout";
