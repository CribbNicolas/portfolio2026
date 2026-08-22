/**
 * Grafo → reglas CSS de resaltado cruzado.
 *
 * El puente lista↔mapa funciona SIN JavaScript. Ese es el punto: el spec §3.3
 * exige que si una propuesta necesita JS, degrade a algo usable sin él — y acá
 * la interacción completa, no una versión pobre, vive en CSS.
 *
 * Se generan desde el grafo en vez de escribirse a mano porque así no pueden
 * desincronizarse de los ids que emite el `<svg>`.
 *
 * Import relativo y NO por el alias `@content`: este módulo lo cargan tanto
 * Vite (que resuelve el alias) como `tsx` corriendo el test suelto (que puede
 * no resolverlo). Mismo motivo que `src/lib/jsonld.ts`.
 */

import type { PositionedGraph } from "../../content/source/index";

/** Prefijos de id. Los usa el `<svg>`, la lista del DOM y estas reglas. */
export const ID_NODO = (id: string): string => `n-${id.replace(":", "-")}`;
export const ID_ITEM = (id: string): string => `i-${id.replace(":", "-")}`;

/**
 * Dos reglas por nodo: hover en la lista enciende el nodo, hover en el nodo
 * enciende el item. `:focus-visible` va en la primera para que el puente
 * funcione con teclado y no solo con mouse — reusa el anillo de foco que ya
 * define `tokens.css`, no lo redefine.
 */
export function buildHoverCss(graph: PositionedGraph): string {
  const reglas: string[] = [];

  for (const n of graph.nodes) {
    const nodo = `#${ID_NODO(n.id)}`;
    const item = `#${ID_ITEM(n.id)}`;
    reglas.push(
      `.lab:has(${item}:hover,${item}:focus-visible) ${nodo}{opacity:1;stroke:var(--acento);stroke-width:3}`,
      `.lab:has(${nodo}:hover) ${item}{background:var(--acento-tenue);color:var(--acento)}`,
    );
  }

  return reglas.join("\n");
}
