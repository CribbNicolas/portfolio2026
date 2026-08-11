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
