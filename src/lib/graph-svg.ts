/**
 * PositionedGraph → a draw list for the `<svg>`.
 *
 * All the presentation maths of the map lives here and not in the component:
 * the component walks a list and writes attributes (invariant 1). It also makes
 * it testable that depth reads, which is the only thing keeping a 3D graph
 * drawn in 2D from looking flat.
 *
 * Relative import for the same reason as `jsonld.ts` and `lab-hover-css.ts`.
 */

import type { PositionedGraph, GraphNodeKind } from "../../content/source/index";
import { isQuietEdge } from "../../content/schema/knowledge-graph";
import { projectNode } from "../../content/schema/graph-layout";
import { NODE_ID } from "./lab-hover-css";
import { isStickyMapLabel, nodeHasMapLabel } from "./map-labels";

/** Base radius per kind. Size distinguishes the kind; color barely does (spec §4). */
export const RADIUS: Record<GraphNodeKind, number> = {
  role: 7,
  project: 5.5,
  skill: 3.8,
  achievement: 3.5,
};

export interface SvgNode {
  id: string;
  domId: string;
  kind: GraphNodeKind;
  radiusScale: number;
  label: string;
  detail: string;
  cx: number;
  cy: number;
  r: number;
  /** Opacity by depth. This is the fog. */
  opacity: number;
  /** Radius of the occlusion disc hiding the edges behind. */
  haloRadius: number;
  withEvidence: boolean;
  strokeWidth: number;
}

export interface SvgEdge {
  x1: number; y1: number; x2: number; y2: number;
  width: number;
  opacity: number;
  affinity: boolean;
}

export interface SvgLabel {
  x: number;
  y: number;
  text: string;
  kind: GraphNodeKind;
  size: number;
  opacity: number;
}

export interface SvgMap {
  edges: SvgEdge[];
  nodes: SvgNode[];
  /** Only the ones that fit without overlapping. See `placeLabels`. */
  labels: SvgLabel[];
  /** `viewBox` computed from the real content, with a margin. */
  viewBox: string;
}

/** How far the farthest fades. 0 would be invisible; 0.28 still reads. */
const FOG_MIN = 0.28;

export function buildSvgMap(graph: PositionedGraph): SvgMap {
  const projected = new Map(
    graph.nodes.map((n) => [n.id, { node: n, p: projectNode(n) }]),
  );

  const scales = [...projected.values()].map((v) => v.p.scale);
  const sMin = Math.min(...scales);
  const sMax = Math.max(...scales);
  const range = sMax - sMin || 1;
  const fog = (s: number): number =>
    round3(FOG_MIN + (1 - FOG_MIN) * ((s - sMin) / range));

  // Paint order IS the depth: what is behind goes first.
  const edges: SvgEdge[] = graph.edges
    .flatMap((e) => {
      // Achievement→skill is the cobweb. It stays in the graph for layout
      // and for the 3D focus, but the SVG has no focus state, so it is omitted.
      if (isQuietEdge(e)) return [];
      const A = projected.get(e.source);
      const B = projected.get(e.target);
      if (!A || !B) return [];
      const depth = (A.p.scale + B.p.scale) / 2;
      const affinity = e.kind === "affinity";
      return [{
        depth,
        edge: {
          x1: A.p.x, y1: A.p.y, x2: B.p.x, y2: B.p.y,
          width: round3((affinity ? 0.45 + e.weight * 0.2 : 0.9) * (0.55 + depth * 0.4)),
          opacity: round3(fog(depth) * (affinity ? 0.18 : 0.28)),
          affinity,
        },
      }];
    })
    .sort((a, b) => a.depth - b.depth)
    .map((x) => x.edge);

  const nodes: SvgNode[] = [...projected.values()]
    .sort((a, b) => a.p.scale - b.p.scale)
    .map(({ node, p }) => {
      // `radiusScale` is 1 except on skills, where it encodes years × connections.
      const r = round3(RADIUS[node.kind] * node.radiusScale * p.scale);
      return {
        id: node.id,
        domId: NODE_ID(node.id),
        kind: node.kind,
        radiusScale: node.radiusScale,
        label: node.label,
        detail: node.detail,
        cx: p.x,
        cy: p.y,
        r,
        opacity: fog(p.scale),
        // A disc the color of the background behind the node: it fakes
        // occlusion. That is what turns a flat cobweb into a body with a front
        // and a back.
        haloRadius: round3(r + 2.6),
        withEvidence: !node.withoutEvidence,
        // Proportional to the radius and not only to perspective: with a fixed
        // radius the outline of a large node reads as a hair and a small one's
        // as a slab.
        strokeWidth: round3(1.7 * p.scale * Math.min(1.8, Math.sqrt(node.radiusScale))),
      };
    });

  const labels = placeLabels(nodes);

  // The viewBox has to account for the WIDTH of the labels and not only the
  // node centers: otherwise the label of a node at the rim gets clipped. That
  // happened to "Independiente", which came out as "lependiente".
  const xs = [
    ...nodes.flatMap((n) => [n.cx - n.r, n.cx + n.r]),
    ...labels.flatMap((e) => [e.x - labelWidth(e) / 2, e.x + labelWidth(e) / 2]),
  ];
  const ys = [
    ...nodes.flatMap((n) => [n.cy - n.r, n.cy + n.r]),
    ...labels.flatMap((e) => [e.y - e.size, e.y]),
  ];
  const margin = 16;
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  const w = Math.max(...xs) - Math.min(...xs) + margin * 2;
  const h = Math.max(...ys) - Math.min(...ys) + margin * 2;

  return {
    edges,
    nodes,
    labels,
    viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`,
  };
}

/**
 * Labels without overlap — except the sticky ones.
 *
 * Roles (workplaces) and skills that have grown to that size always keep their
 * name. Projects still yield: drawing them all made "Plugins de WordPress…"
 * cover a map title. Greedy front-to-back for the rest; the dropped name is
 * still in the node's `<title>` and in the tooltip.
 */
function placeLabels(nodes: SvgNode[]): SvgLabel[] {
  const candidates = nodes
    .filter((n) => nodeHasMapLabel(n))
    .slice()
    .sort((a, b) =>
      Number(isStickyMapLabel(b)) - Number(isStickyMapLabel(a)) ||
      b.r - a.r,
    );

  const placed: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const out: SvgLabel[] = [];

  for (const n of candidates) {
    const sticky = isStickyMapLabel(n);
    const scale = n.r / RADIUS[n.kind];
    const size = round3(Math.min(15, 13.5 * scale));
    const y = round3(n.cy - n.r - 7);
    const width = n.label.length * size * 0.52;
    const air = size * 0.6;
    const box = {
      x1: n.cx - width / 2 - air, x2: n.cx + width / 2 + air,
      y1: y - size - air, y2: y + size * 0.3 + air,
    };

    const clashes = placed.some((p) =>
      box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1,
    );
    if (clashes && !sticky) continue;

    placed.push(box);
    out.push({
      x: n.cx, y, text: n.label, kind: n.kind, size,
      opacity: sticky ? Math.max(0.88, n.opacity) : n.opacity,
    });
  }

  return out.reverse();
}

/** Approximate width in viewBox units. Only used for framing. */
const labelWidth = (e: SvgLabel): number => e.text.length * e.size * 0.52;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
