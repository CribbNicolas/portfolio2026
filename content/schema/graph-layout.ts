/**
 * KnowledgeGraph → 3D positions.
 *
 * Runs in the page FRONTMATTER, i.e. in Node during `astro build`. It is never
 * shipped to the browser. That is deliberate, and it is what lets the
 * no-JavaScript fallback be the SAME map rather than an approximation: the
 * server-rendered `<svg>` and the three.js scene read the same coordinates.
 *
 * Deterministic by construction: the initial positions come from a Fibonacci
 * sphere indexed by node position, not from a PRNG. There is no seed to keep in
 * sync. It depends on `buildKnowledgeGraph` emitting nodes in a stable order —
 * and a test asserts exactly that.
 */

import type { KnowledgeGraph, GraphEdge, GraphNode, GraphNodeKind } from "./knowledge-graph";

// ---------------------------------------------------------------------------
// PARAMETERS
// ---------------------------------------------------------------------------

/** Simulation iterations. At 37 nodes this is ~15 ms at build time. */
export const LAYOUT_TICKS = 700;
/** Equilibrium distance between nodes. Higher = more spread out. */
export const LAYOUT_K = 118;
/** Radius of the initial sphere. */
export const LAYOUT_INITIAL_RADIUS = 240;
/**
 * Target radius per kind, as a fraction of the body radius.
 *
 * This is what turns the cloud into a readable structure: **core = what I know,
 * crust = where I used it**. Achievements and projects land in between because
 * they are literally the bridge between a technology and a job.
 *
 * Skills sat at 0.42 and still read as a knot in the middle. 0.58 gives them
 * the body of the sphere; the map is allowed to be large.
 */
export const LAYOUT_KIND_RADIUS: Record<GraphNodeKind, number> = {
  role: 1,
  project: 0.80,
  achievement: 0.76,
  skill: 0.48,
};
/**
 * How hard the radial bias pulls. It is a BIAS, not a constraint: per-edge
 * attraction still governs, so an achievement never detaches from its role or
 * its skills. Raising it too far flattens the graph into layers and the real
 * structure is lost.
 */
export const LAYOUT_RADIAL_BIAS = 2.8;
/**
 * How much node size weighs into repulsion.
 *
 * At 0 repulsion is uniform, which is how it was when every node measured
 * roughly the same. They now run from 6 to 34: without this, React pushes as
 * hard as Jotai and an orphan skill ends up inside its disc. Pairwise repulsion
 * scales with the average of the two radii, so a large node makes room for
 * itself and a small one barely interferes.
 */
export const LAYOUT_SIZE_REPULSION = 1.25;
/**
 * Radius of the core of skills without evidence, as a fraction of the body
 * radius.
 */
export const LAYOUT_CORE_RADIUS = 0.14;
/** Iterations of the core relaxation. It only moves 11 nodes: it is free. */
export const LAYOUT_CORE_TICKS = 120;
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
 * scale and crushes everything else against the center. That is exactly what
 * the "Independiente" role used to do.
 */
export const LAYOUT_RADIUS_PERCENTILE = 0.85;
/** Force pulling everything toward the origin. Keeps the graph from drifting. */
export const LAYOUT_CENTERING = 0.007;
/**
 * How hard an affinity edge pulls relative to a structural one, per unit of
 * weight. Below 1 because there are many more of them: at 1 they would flatten
 * the structure.
 */
export const LAYOUT_AFFINITY_PULL = 0.16;
/**
 * Disc radius per kind, matching the larger of the two renderers (the overlap
 * test in knowledge-graph.test.ts uses the same numbers). Collision resolve
 * after the force step uses these so two large skills cannot swallow each other.
 */
export const LAYOUT_DRAW_RADIUS: Record<GraphNodeKind, number> = {
  role: 17,
  project: 14,
  skill: 10,
  achievement: 9,
};

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

  const pos = new Map<string, Vec3>();

  // Fibonacci sphere: spreads N points almost uniformly with no randomness.
  const total = withEvidence.length;
  withEvidence.forEach((n, i) => {
    const t = (i + 0.5) / total;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    pos.set(n.id, {
      x: Math.cos(theta) * Math.sin(phi) * LAYOUT_INITIAL_RADIUS,
      y: Math.sin(theta) * Math.sin(phi) * LAYOUT_INITIAL_RADIUS,
      z: Math.cos(phi) * LAYOUT_INITIAL_RADIUS,
    });
  });

  // Only the edges between nodes that are in the simulation.
  const active = graph.edges.filter((e) => pos.has(e.source) && pos.has(e.target));

  for (let it = 0; it < LAYOUT_TICKS; it++) {
    // Annealing: the maximum step decreases with the iterations so it converges
    // instead of oscillating. Without this the graph pulses forever.
    const step = 26 * (1 - it / LAYOUT_TICKS);
    const disp = new Map<string, Vec3>(withEvidence.map((n) => [n.id, { x: 0, y: 0, z: 0 }]));

    // Repulsion between every pair. O(N²), and at N=37 that is 666 pairs:
    // Barnes-Hut buys nothing at this scale and costs 200 lines.
    for (let i = 0; i < withEvidence.length; i++) {
      for (let k = i + 1; k < withEvidence.length; k++) {
        const a = withEvidence[i]!.id;
        const b = withEvidence[k]!.id;
        const A = pos.get(a)!;
        const B = pos.get(b)!;
        let dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
        const d = Math.hypot(dx, dy, dz) || 0.01;
        // Size enters here: a large node needs more free room, not more edge
        // force. `radiusScale` is 1 outside skills, so for roles, projects and
        // achievements this is exactly the repulsion it always was.
        const size = 1 + LAYOUT_SIZE_REPULSION
          * ((withEvidence[i]!.radiusScale + withEvidence[k]!.radiusScale) / 2 - 1);
        const f = ((LAYOUT_K * LAYOUT_K) / d) * size;
        dx /= d; dy /= d; dz /= d;
        const dA = disp.get(a)!;
        const dB = disp.get(b)!;
        dA.x += dx * f; dA.y += dy * f; dA.z += dz * f;
        dB.x -= dx * f; dB.y -= dy * f; dB.z -= dz * f;
      }
    }

    // Per-edge attraction.
    for (const e of active) {
      const A = pos.get(e.source)!;
      const B = pos.get(e.target)!;
      let dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
      const d = Math.hypot(dx, dy, dz) || 0.01;
      const scale = e.kind === "affinity" ? LAYOUT_AFFINITY_PULL * e.weight : 1;
      const f = ((d * d) / LAYOUT_K) * scale;
      dx /= d; dy /= d; dz /= d;
      const dA = disp.get(e.source)!;
      const dB = disp.get(e.target)!;
      dA.x -= dx * f; dA.y -= dy * f; dA.z -= dz * f;
      dB.x += dx * f; dB.y += dy * f; dB.z += dz * f;
    }

    // Centering: without it the whole graph drifts and sits off-center in frame.
    for (const n of withEvidence) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      d.x -= p.x * LAYOUT_CENTERING * LAYOUT_K;
      d.y -= p.y * LAYOUT_CENTERING * LAYOUT_K;
      d.z -= p.z * LAYOUT_CENTERING * LAYOUT_K;
    }

    // Radial bias per kind: jobs toward the crust, technologies toward the
    // core. The reference is the SAME percentile the normalization below uses,
    // so each kind's target means the same during the simulation as it does
    // after scaling.
    const ref = radiusPercentile(withEvidence, pos);
    for (const n of withEvidence) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      const r = Math.hypot(p.x, p.y, p.z) || 0.01;
      const f = (LAYOUT_KIND_RADIUS[n.kind] * ref - r) * LAYOUT_RADIAL_BIAS;
      d.x += (p.x / r) * f; d.y += (p.y / r) * f; d.z += (p.z / r) * f;
    }

    for (const n of withEvidence) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      const m = Math.hypot(d.x, d.y, d.z) || 0.01;
      const s = Math.min(m, step) / m;
      p.x += d.x * s; p.y += d.y * s; p.z += d.z * s;
    }
  }

  // --- Normalization: centroid to the origin and a fixed scale --------------
  // Without this the framing depends on the dataset: adding an achievement
  // would move the zoom of the whole page, and one loose node flying off
  // crushes the rest.
  const center = { x: 0, y: 0, z: 0 };
  for (const n of withEvidence) {
    const p = pos.get(n.id)!;
    center.x += p.x; center.y += p.y; center.z += p.z;
  }
  center.x /= withEvidence.length;
  center.y /= withEvidence.length;
  center.z /= withEvidence.length;

  for (const n of withEvidence) {
    const p = pos.get(n.id)!;
    p.x -= center.x; p.y -= center.y; p.z -= center.z;
  }

  // The percentile is measured over the BODY and not over everything: if the
  // orphans counted, adding a skill without evidence would change the page zoom.
  const factor = LAYOUT_TARGET_RADIUS / radiusPercentile(withEvidence, pos);

  for (const n of withEvidence) {
    const p = pos.get(n.id)!;
    p.x *= factor; p.y *= factor; p.z *= factor;
  }

  // Two large skills that co-occur a lot (TypeScript/React) can still sit
  // inside each other's disc after the force step: attraction along shared
  // edges beats size-weighted repulsion. Push overlapping pairs apart using
  // the same radii the renderers use, so the map does not hide a node.
  resolveOverlaps(withEvidence, pos);

  placeCore(graph.nodes.filter((n) => n.degree === 0), graph.nodes, pos);

  const nodes: PositionedNode[] = graph.nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      ...n,
      // Rounded to 2 decimals: the coordinates travel inside the HTML, and the
      // extra precision is bytes that do not move a single pixel.
      x: round2(p.x),
      y: round2(p.y),
      z: round2(p.z),
      withoutEvidence: n.degree === 0,
    };
  });

  // The framing comes from the REAL farthest node and not from a constant: now
  // that roles are pushed outward, who ends up at the edge is decided by the
  // simulation. Hard-coding it would clip the map as soon as a role is added.
  //
  // Ceil, not round: `round2(412.344)` is 412.34, which leaves that node
  // outside the camera. This number has to contain everything.
  const framingRadius = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y, n.z)));

  return { nodes, edges: graph.edges, framingRadius: Math.ceil(framingRadius * 100) / 100 };
}

/**
 * Separate pairs whose discs still overlap after the force simulation.
 * Mutual push along the pair axis; a small pad survives `round2`.
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
        let dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
        const d = Math.hypot(dx, dy, dz) || 0.01;
        const need = rad(a) + rad(b) + pad;
        if (d >= need) continue;
        const push = (need - d) / 2;
        dx /= d; dy /= d; dz /= d;
        A.x += dx * push; A.y += dy * push; A.z += dz * push;
        B.x -= dx * push; B.y -= dy * push; B.z -= dz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * The skills without evidence, in the core.
 *
 * They do NOT enter the force simulation: with not a single edge, the repulsion
 * of the other 36 nodes beats any radial anchor and they escape to the rim —
 * the exact opposite of "technologies go to the center".
 *
 * Instead, the radius is a fixed value and repulsion only spreads them
 * ANGULARLY over that sphere. That constraint is what makes it work: the center
 * of the map is occupied by the large skills (React draws at radius 34 and its
 * disc covers the origin), so the orphans do not need to move away, they need
 * to move to the free side of the sphere. With a free position they never find
 * that side; with the radius pinned, they do.
 *
 * Runs after normalization, so the core is measured against the already scaled
 * body rather than the arbitrary units of the simulation.
 */
function placeCore(core: GraphNode[], all: GraphNode[], pos: Map<string, Vec3>): void {
  if (core.length === 0) return;
  const radius = LAYOUT_TARGET_RADIUS * LAYOUT_CORE_RADIUS;

  // Fibonacci seeding: spreads with no randomness, same as the body.
  core.forEach((n, i) => {
    const t = (i + 0.5) / core.length;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    pos.set(n.id, {
      x: Math.cos(theta) * Math.sin(phi) * radius,
      y: Math.sin(theta) * Math.sin(phi) * radius,
      z: Math.cos(phi) * radius,
    });
  });

  const ontoSphere = (p: Vec3) => {
    const m = Math.hypot(p.x, p.y, p.z) || 0.01;
    p.x *= radius / m; p.y *= radius / m; p.z *= radius / m;
  };

  for (let it = 0; it < LAYOUT_CORE_TICKS; it++) {
    const step = 0.5 * (1 - it / LAYOUT_CORE_TICKS);
    for (const n of core) {
      const p = pos.get(n.id)!;
      let dx = 0, dy = 0, dz = 0;
      for (const o of all) {
        if (o.id === n.id) continue;
        const q = pos.get(o.id)!;
        const ex = p.x - q.x, ey = p.y - q.y, ez = p.z - q.z;
        const d = Math.hypot(ex, ey, ez) || 0.01;
        // Weighted by the neighbour's drawn radius: what has to be cleared is
        // its DISC, and in this map the discs no longer all measure the same.
        const f = (o.radiusScale * LAYOUT_K * LAYOUT_K) / (d * d);
        dx += (ex / d) * f; dy += (ey / d) * f; dz += (ez / d) * f;
      }
      p.x += dx * step; p.y += dy * step; p.z += dz * step;
      // The radial component is discarded: only rotation over the sphere.
      ontoSphere(p);
    }
  }
}

/**
 * Body radius, by percentile. It lives here because two things that MUST agree
 * use it: the radial bias during the simulation, and the final normalization.
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

/** Fixed camera rotation. Shared by the `<svg>` and the initial 3D pose. */
export const CAMERA_RX = -0.42;
export const CAMERA_RY = 0.62;
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
