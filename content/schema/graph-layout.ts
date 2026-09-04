/**
 * KnowledgeGraph → 3D positions.
 *
 * Runs in the page FRONTMATTER, i.e. in Node during `astro build`. It is never
 * shipped to the browser. That is deliberate, and it is what lets the
 * no-JavaScript fallback be the SAME map rather than an approximation: the
 * server-rendered `<svg>` and the three.js scene read the same coordinates.
 *
 * The map is a **career cylinder**, not a force-directed cloud:
 *   Y      = time (career start at the bottom, today at the top)
 *   angle  = domain (skill category; workplaces on a front arc)
 *   radius = kind (skills inward, roles on the rim)
 *
 * Positions are derived, not simulated: adding a node does not reshuffle the
 * others. A small XZ overlap pass is the only iteration, and it never moves Y,
 * because time is the thing the layout is for.
 */

import type { KnowledgeGraph, GraphEdge, GraphNode, GraphNodeKind } from "./knowledge-graph";
import type { SkillCategory } from "./content-schema";
import { SKILL_GROUPS } from "./skill-groups";

// ---------------------------------------------------------------------------
// PARAMETERS
// ---------------------------------------------------------------------------

/**
 * Half-height of the timeline, in layout units before normalization.
 * Y = (when - 0.5) * 2 * this, so career start is at the bottom.
 */
export const LAYOUT_TIME_HALF = 320;
/**
 * XZ ring radius per kind, as a fraction of `LAYOUT_TARGET_RADIUS`.
 * Skills inward (the domain), roles on the rim (the jobs). Kept inside
 * the camera: a ring of 1 with a close camera left roles clipped.
 */
export const LAYOUT_RING: Record<GraphNodeKind, number> = {
  skill: 0.34,
  achievement: 0.50,
  project: 0.64,
  role: 0.80,
};
/** Inner ring for skills with no evidence. */
export const LAYOUT_CORE_RING = 0.18;
/**
 * Arc, in radians, along which workplaces sit — facing the default camera,
 * not wrapped around the back where a label would be wasted.
 */
export const LAYOUT_ROLE_ARC = 1.4;
/**
 * Radius the graph body is normalized to. It fixes the framing: without it, the
 * on-screen size would depend on how many nodes there are and how far the
 * loosest one flies, so adding one achievement would change the zoom of the
 * whole page.
 */
export const LAYOUT_TARGET_RADIUS = 300;
/**
 * Percentile the body radius is taken from. 0.85 and not the maximum, on
 * purpose: with the maximum, ONE poorly connected node flying off dictates the
 * scale and crushes everything else against the center.
 */
export const LAYOUT_RADIUS_PERCENTILE = 0.85;
/**
 * Disc radius per kind, matching the larger of the two renderers (the overlap
 * test in knowledge-graph.test.ts uses the same numbers). Collision resolve
 * uses these so two large skills cannot swallow each other. It only moves XZ:
 * Y is time and is not negotiable.
 */
export const LAYOUT_DRAW_RADIUS: Record<GraphNodeKind, number> = {
  role: 17,
  project: 14,
  skill: 10,
  achievement: 9,
};

const CATEGORY_ORDER: SkillCategory[] = SKILL_GROUPS.es.map(([c]) => c);

export interface Vec3 { x: number; y: number; z: number }

export interface PositionedNode extends GraphNode, Vec3 {
  /**
   * true when the node has not a single edge: no skill backs it and it backs
   * nobody. The `<svg>` draws these differently, and they are the map showing
   * where content is missing, not a bug in the layout.
   */
  withoutEvidence: boolean;
}

export interface PositionedGraph {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  /**
   * Distance from the origin to the farthest node. The camera uses it for the
   * initial framing and for the fog planes, so it MUST contain everything: a
   * node outside it comes out clipped, or not visible at all.
   */
  framingRadius: number;
}

// ---------------------------------------------------------------------------
// LAYOUT
// ---------------------------------------------------------------------------

export function layoutGraph(graph: KnowledgeGraph): PositionedGraph {
  const withEvidence = graph.nodes.filter((n) => n.degree > 0);
  const orphans = graph.nodes.filter((n) => n.degree === 0);
  const pos = new Map<string, Vec3>();

  const roles = withEvidence
    .filter((n) => n.kind === "role")
    .slice()
    .sort((a, b) => a.when - b.when || a.id.localeCompare(b.id));

  const roleAngle = new Map<string, number>();
  roles.forEach((n, i) => {
    const t = roles.length <= 1 ? 0.5 : i / (roles.length - 1);
    roleAngle.set(n.id, (t - 0.5) * LAYOUT_ROLE_ARC);
  });

  const roleOf = (n: GraphNode): string | null => {
    for (const e of graph.edges) {
      if (e.kind !== "structure") continue;
      const other = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
      if (other?.startsWith("role:")) return other;
    }
    return null;
  };

  const skillAngle = new Map<string, number>();
  {
    const byCat = new Map<string, GraphNode[]>();
    for (const n of withEvidence) {
      if (n.kind !== "skill") continue;
      const key = n.category ?? "_";
      const list = byCat.get(key);
      if (list) list.push(n);
      else byCat.set(key, [n]);
    }
    for (const [cat, group] of byCat) {
      group.sort((a, b) => a.when - b.when || a.id.localeCompare(b.id));
      const base = categoryAngle(cat as SkillCategory);
      const fan = Math.min(0.55, 0.12 * Math.max(0, group.length - 1));
      group.forEach((n, i) => {
        const t = group.length === 1 ? 0.5 : i / (group.length - 1);
        skillAngle.set(n.id, base + (t - 0.5) * fan);
      });
    }
  }

  const angleOf = (n: GraphNode): number => {
    if (n.kind === "skill") return skillAngle.get(n.id) ?? categoryAngle(n.category);
    if (n.kind === "role") return roleAngle.get(n.id) ?? 0;
    const role = roleOf(n);
    return role ? (roleAngle.get(role) ?? 0) : 0;
  };

  const yOf = (n: GraphNode): number => (n.when - 0.5) * 2 * LAYOUT_TIME_HALF;
  const rOf = (n: GraphNode): number => LAYOUT_RING[n.kind] * LAYOUT_TARGET_RADIUS;

  const jitter = new Map<string, { a: number; y: number }>();
  const groupByRole = (kind: GraphNodeKind) => {
    const groups = new Map<string, GraphNode[]>();
    for (const n of withEvidence) {
      if (n.kind !== kind) continue;
      const key = roleOf(n) ?? "_";
      const list = groups.get(key);
      if (list) list.push(n);
      else groups.set(key, [n]);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.id.localeCompare(b.id));
      group.forEach((n, i) => {
        const c = i - (group.length - 1) / 2;
        jitter.set(n.id, { a: c * 0.10, y: c * 8 });
      });
    }
  };
  groupByRole("achievement");
  groupByRole("project");

  for (const n of withEvidence) {
    let a = angleOf(n);
    let y = yOf(n);
    const j = jitter.get(n.id);
    if (j) {
      a += j.a;
      y += j.y;
    }
    const r = rOf(n);
    pos.set(n.id, { x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  }

  resolveOverlaps(withEvidence, pos);
  placeOrphans(orphans, pos);

  const body = withEvidence.length > 0 ? withEvidence : graph.nodes;
  const center = { x: 0, y: 0, z: 0 };
  for (const n of body) {
    const p = pos.get(n.id)!;
    center.x += p.x; center.y += p.y; center.z += p.z;
  }
  const denom = Math.max(1, body.length);
  center.x /= denom; center.y /= denom; center.z /= denom;
  for (const p of pos.values()) {
    p.x -= center.x; p.y -= center.y; p.z -= center.z;
  }

  const factor = LAYOUT_TARGET_RADIUS / radiusPercentile(body, pos);
  for (const p of pos.values()) {
    p.x *= factor; p.y *= factor; p.z *= factor;
  }

  const nodes: PositionedNode[] = graph.nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      ...n,
      x: round2(p.x),
      y: round2(p.y),
      z: round2(p.z),
      withoutEvidence: n.degree === 0,
    };
  });

  const framingRadius = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y, n.z)));
  return { nodes, edges: graph.edges, framingRadius: Math.ceil(framingRadius * 100) / 100 };
}

function categoryAngle(category: SkillCategory | undefined): number {
  const i = category ? CATEGORY_ORDER.indexOf(category) : 0;
  const idx = i < 0 ? 0 : i;
  return (2 * Math.PI * (idx + 0.5)) / CATEGORY_ORDER.length;
}

function placeOrphans(orphans: GraphNode[], pos: Map<string, Vec3>): void {
  const ring = LAYOUT_TARGET_RADIUS * LAYOUT_CORE_RING;
  for (const n of orphans) {
    const a = categoryAngle(n.category);
    const y = (n.when - 0.5) * 2 * LAYOUT_TIME_HALF;
    pos.set(n.id, { x: Math.cos(a) * ring, y, z: Math.sin(a) * ring });
  }
}

/**
 * Separate pairs whose discs still overlap. Only XZ moves: Y is time.
 */
function resolveOverlaps(nodes: GraphNode[], pos: Map<string, Vec3>): void {
  const rad = (n: GraphNode) => LAYOUT_DRAW_RADIUS[n.kind] * n.radiusScale;
  const pad = 0.25;
  for (let it = 0; it < 48; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let k = i + 1; k < nodes.length; k++) {
        const a = nodes[i]!, b = nodes[k]!;
        const A = pos.get(a.id)!, B = pos.get(b.id)!;
        let dx = A.x - B.x, dz = A.z - B.z;
        const dy = A.y - B.y;
        const d = Math.hypot(dx, dy, dz) || 0.01;
        const need = rad(a) + rad(b) + pad;
        if (d >= need) continue;
        const push = (need - d) / 2;
        const xz = Math.hypot(dx, dz) || 0.01;
        dx /= xz; dz /= xz;
        A.x += dx * push; A.z += dz * push;
        B.x -= dx * push; B.z -= dz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * Body radius, by percentile. Used to keep the framing stable when a node
 * is added: the zoom of the page does not depend on the farthest outlier.
 */
function radiusPercentile(nodes: GraphNode[], pos: Map<string, Vec3>): number {
  const radii = nodes
    .map((n) => { const p = pos.get(n.id)!; return Math.hypot(p.x, p.y, p.z); })
    .sort((a, b) => a - b);
  return radii[Math.floor(radii.length * LAYOUT_RADIUS_PERCENTILE)] || 1;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// PROJECTION
// ---------------------------------------------------------------------------

/**
 * Default camera: look at the cylinder from slightly off the front so Y
 * (time) reads as up and the workplaces on the role arc face the viewer.
 */
export const CAMERA_RX = -0.12;
export const CAMERA_RY = 0.28;
/** Focal length and camera distance. They define how much perspective there is. */
export const CAMERA_F = 1250;
export const CAMERA_DIST = 1150;

export interface ProjectedNode {
  id: string;
  /** Coordinates on the SVG plane. */
  x: number;
  y: number;
  /** Perspective factor: >1 is near, <1 is far. Governs size and fog. */
  scale: number;
  /** Depth after rotating. Used to order painting. */
  z: number;
}

/**
 * Perspective projection. This is what makes the map read with volume inside a
 * static `<svg>`: without it, a 3D graph drawn in 2D is indistinguishable from
 * a flat one.
 */
export function projectNode(n: Vec3): Omit<ProjectedNode, "id"> {
  const x1 = n.x * Math.cos(CAMERA_RY) + n.z * Math.sin(CAMERA_RY);
  const z1 = -n.x * Math.sin(CAMERA_RY) + n.z * Math.cos(CAMERA_RY);
  const y2 = n.y * Math.cos(CAMERA_RX) - z1 * Math.sin(CAMERA_RX);
  const z2 = n.y * Math.sin(CAMERA_RX) + z1 * Math.cos(CAMERA_RX);

  const scale = CAMERA_F / (z2 + CAMERA_DIST);
  return { x: round2(x1 * scale), y: round2(y2 * scale), scale: round2(scale), z: round2(z2) };
}

export function projectGraph(g: PositionedGraph): ProjectedNode[] {
  return g.nodes.map((n) => ({ id: n.id, ...projectNode(n) }));
}
