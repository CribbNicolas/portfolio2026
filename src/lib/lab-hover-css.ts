/**
 * Graph → CSS rules for cross-highlighting.
 *
 * The list↔map bridge works WITHOUT JavaScript. That is the point: spec §3.3
 * requires a proposal needing JS to degrade into something usable without it —
 * and here the full interaction, not a poorer version, lives in CSS.
 *
 * These are generated from the graph rather than written by hand so they cannot
 * drift out of sync with the ids the `<svg>` emits.
 *
 * Relative import and NOT the `@content` alias: this module is loaded both by
 * Vite (which resolves the alias) and by `tsx` running the test on its own
 * (which may not). Same reason as `src/lib/jsonld.ts`.
 */

import type { PositionedGraph } from "../../content/source/index";

/** Id prefixes. Used by the `<svg>`, by the DOM list, and by these rules. */
export const NODE_ID = (id: string): string => `n-${id.replace(":", "-")}`;
export const ITEM_ID = (id: string): string => `i-${id.replace(":", "-")}`;

/**
 * Two rules per node: hovering the list lights the node, hovering the node
 * lights the item. `:focus-visible` goes on the first one so the bridge works
 * with a keyboard and not only with a mouse — it reuses the focus ring
 * `tokens.css` already defines rather than redefining it.
 */
export function buildHoverCss(graph: PositionedGraph): string {
  const rules: string[] = [];

  for (const n of graph.nodes) {
    const node = `#${NODE_ID(n.id)}`;
    const item = `#${ITEM_ID(n.id)}`;
    rules.push(
      `.lab:has(${item}:hover,${item}:focus-visible) ${node}{opacity:1;stroke:var(--acento);stroke-width:3}`,
      `.lab:has(${node}:hover) ${item}{background:var(--acento-tenue);color:var(--acento)}`,
    );
  }

  return rules.join("\n");
}
