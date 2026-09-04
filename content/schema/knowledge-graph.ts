/**
 * ContentView → KnowledgeGraph.
 *
 * This is the view that delivers on the promise of CONTRACT §3: `Achievement`s
 * live loose rather than nested inside `Role`, "so you can query them by skill,
 * by dimension, or by project". The CV flattens that graph into a list; here it
 * is shown for what it is.
 *
 * It takes `ContentView` and NOT `ContentDataset` on purpose: `resolveView`
 * already applied visibility, so this module filters nothing (invariant 1).
 * Flattening `skills` (which arrives grouped) and un-nesting `achievements` is
 * not filtering: it is a change of shape.
 */

import type { ContentView, SkillCategory } from "./content-schema";
import { currentYearMonth, monthsFromPeriods, toMonths } from "./dates";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type GraphNodeKind = "skill" | "role" | "project" | "achievement";

/** Where an edge comes from. The kind decides how it is drawn and how hard it pulls. */
export type GraphEdgeKind =
  /** Structure declared in the dataset: achievement→role, achievement→skill, project→skill. */
  | "structure"
  /** Declared: one skill extends another. See `skillAffinity`. */
  | "affinity";

export interface GraphNode {
  /** Namespaced (`skill:react`): a Skill and a Project can share an id. */
  id: string;
  kind: GraphNodeKind;
  label: string;
  /**
   * Real text for the tooltip. Never truncated (invariant 6): if a `short`
   * field does not work, another field is picked, the long one is not cut.
   */
  detail: string;
  /** The skill category. Goes in the tooltip, NEVER in the color (spec §4). */
  category?: SkillCategory;
  /** Degree in the finished graph. This is the `Nc` of the size formula. */
  degree: number;
  /**
   * Years of use. The `T` of the formula. Zero outside skills, and zero for a
   * skill with no `periods` and no dated evidence — never invented (invariant 4).
   */
  years: number;
  /** `T × Nc`. What orders the size. Zero outside skills. */
  weight: number;
  /**
   * Multiplier over the base radius of the kind. Exactly 1 outside skills: a
   * role or an achievement has no "years of use", so its size stays governed by
   * its kind. Both the `<svg>` and the 3D scene consume this.
   */
  radiusScale: number;
  /**
   * 0 = career start, 1 = today. Midpoint of the node's dated span.
   * The layout uses this as the vertical axis: a map you can read as a
   * career, not as a cloud.
   */
  when: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /**
   * How many distinct sources back the edge. Always 1 for `structure` and
   * for `affinity` (the pair is declared, not counted).
   */
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Range of a skill's radius multiplier.
 *
 * The floor is NOT zero: a skill with no evidence is still a declared skill,
 * and an invisible node cannot be hovered or clicked. The ceiling is 2.5 so the
 * most proven technology sits above a role without swallowing the centre of
 * the map.
 */
export const RADIUS_SCALE_MIN = 0.6;
export const RADIUS_SCALE_MAX = 2.5;

export const nodeId = (kind: GraphNodeKind, id: string): string => `${kind}:${id}`;

// ---------------------------------------------------------------------------
// CONSTRUCTION
// ---------------------------------------------------------------------------

export function buildKnowledgeGraph(view: ContentView): KnowledgeGraph {
  // Emission order has to be stable: the layout uses it to seed the initial
  // positions, so a different order is a different map.
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const skills = Object.values(view.skills).flat();
  const achievements = view.experience.flatMap((r) => r.achievements);
  const t0 = toMonths(view.identity.careerStart);
  const t1 = toMonths(currentYearMonth());
  const whenOf = (start: string, end: string | null): number => {
    if (t1 <= t0) return 0.5;
    const mid = (toMonths(start) + toMonths(end ?? currentYearMonth())) / 2;
    return Math.max(0, Math.min(1, (mid - t0) / (t1 - t0)));
  };
  const skillWhen = skillTimeMidpoint(view, t0, t1);
  const roleById = new Map(view.experience.map((r) => [r.id, r]));

  for (const s of skills) {
    nodes.push({
      id: nodeId("skill", s.id),
      kind: "skill",
      label: s.name,
      detail: s.name,
      category: s.category,
      degree: 0,
      years: 0,
      weight: 0,
      radiusScale: 1,
      when: skillWhen.get(s.id) ?? 0.5,
    });
  }

  for (const r of view.experience) {
    nodes.push({
      id: nodeId("role", r.id),
      kind: "role",
      label: r.company,
      detail: r.context.short,
      degree: 0,
      years: 0,
      weight: 0,
      radiusScale: 1,
      when: whenOf(r.start, r.end ?? null),
    });
  }

  for (const p of view.projects) {
    nodes.push({
      id: nodeId("project", p.id),
      kind: "project",
      // `problem.short` and `outcome.short` still carry a TODO in 2 of 3
      // projects (docs/00 §pendientes). `solution.short` is clean in all three,
      // and a test asserts no `detail` starts with TODO: if the other fields
      // ever get filled in, revisit the choice here.
      label: p.name,
      detail: p.solution.short,
      degree: 0,
      years: 0,
      weight: 0,
      radiusScale: 1,
      when: whenOf(p.start, p.end ?? null),
    });
  }

  for (const a of achievements) {
    const role = roleById.get(a.roleId);
    nodes.push({
      id: nodeId("achievement", a.id),
      kind: "achievement",
      label: a.text.short,
      detail: a.text.short,
      degree: 0,
      years: 0,
      weight: 0,
      radiusScale: 1,
      when: role ? whenOf(role.start, role.end ?? null) : 0.5,
    });
  }

  const exists = new Set(nodes.map((n) => n.id));
  /**
   * Referential closure: `resolveView` filters skills by `active`, so an
   * achievement can point at a skill that is not in the view. That edge is
   * dropped silently — letting it through makes the layout operate on
   * `undefined` and the graph blows up with no useful message.
   */
  const connect = (source: string, target: string, kind: GraphEdgeKind, weight: number) => {
    if (!exists.has(source) || !exists.has(target)) return;
    edges.push({ source, target, kind, weight });
  };

  for (const a of achievements) {
    const from = nodeId("achievement", a.id);
    connect(from, nodeId("role", a.roleId), "structure", 1);
    if (a.projectId) connect(from, nodeId("project", a.projectId), "structure", 1);
    for (const s of a.skillIds) connect(from, nodeId("skill", s), "structure", 1);
  }

  for (const p of view.projects) {
    const from = nodeId("project", p.id);
    if (p.roleId) connect(from, nodeId("role", p.roleId), "structure", 1);
    for (const s of p.skillIds) connect(from, nodeId("skill", s), "structure", 1);
  }

  for (const { a, b, weight } of skillAffinity(view)) {
    connect(nodeId("skill", a), nodeId("skill", b), "affinity", weight);
  }

  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) n.degree = degree.get(n.id) ?? 0;

  // Size = years × connections. Only here, because `Nc` is the degree of the
  // FINISHED graph: it depends on the affinity edges, which come from
  // `relatedIds`.
  const years = skillYears(view);
  for (const n of nodes) {
    if (n.kind !== "skill") continue;
    n.years = years.get(n.id.slice("skill:".length)) ?? 0;
    n.weight = n.years * n.degree;
  }

  // Normalized against the heaviest skill and by SQUARE ROOT: what the eye
  // compares in a disc is the area, not the radius. With a linear radius, 4×
  // the weight gives 16× the area and the map turns into one node with
  // satellites.
  const maxWeight = Math.max(0, ...nodes.map((n) => n.weight));
  for (const n of nodes) {
    if (n.kind !== "skill") continue;
    const t = maxWeight > 0 ? Math.sqrt(n.weight / maxWeight) : 0;
    n.radiusScale = RADIUS_SCALE_MIN + (RADIUS_SCALE_MAX - RADIUS_SCALE_MIN) * t;
  }

  return { nodes, edges };
}

/**
 * Years of use per skill. The `T` of the size formula.
 *
 * Two sources, UNIONed rather than ranked:
 *
 * 1. `Skill.periods`, when declared. It is the only datum that can know you
 *    started using something BEFORE the first achievement mentioning it, or
 *    that you dropped it and picked it back up.
 * 2. The dated evidence: the roles of the achievements citing it, and the
 *    projects using it (by the project's OWN date, not its role's —
 *    `jwd-maderas` has no `roleId`, and without this Next.js, Tailwind and
 *    Sanity would report 0 years while holding 5 connections each).
 *
 * With neither, zero. Nothing is estimated (invariant 4): a skill without
 * evidence is drawn small, which is the map showing where content is missing.
 *
 * Durations come from `dates.ts` and not from local arithmetic: rule 1. The
 * total is the SUM of the merged periods, not an end-to-end span: a three year
 * gap is not experience, and two parallel jobs are not twice the same years.
 */
function skillPeriods(view: ContentView): Map<string, Array<{ start: string; end: string | null }>> {
  const roles = new Map(view.experience.map((r) => [r.id, r]));
  const periods = new Map<string, Array<{ start: string; end: string | null }>>();

  const record = (skillId: string, start: string, end: string | null) => {
    if (!periods.has(skillId)) periods.set(skillId, []);
    periods.get(skillId)!.push({ start, end });
  };

  for (const r of view.experience) {
    for (const a of r.achievements) {
      const role = roles.get(a.roleId);
      if (!role) continue;
      for (const s of a.skillIds) record(s, role.start, role.end ?? null);
    }
  }
  for (const p of view.projects) {
    for (const s of p.skillIds) record(s, p.start, p.end ?? null);
  }
  for (const s of Object.values(view.skills).flat()) {
    for (const p of s.periods ?? []) record(s.id, p.start, p.end ?? null);
  }
  return periods;
}

export function skillYears(view: ContentView): Map<string, number> {
  const periods = skillPeriods(view);
  const out = new Map<string, number>();
  for (const s of Object.values(view.skills).flat()) {
    out.set(s.id, monthsFromPeriods(periods.get(s.id) ?? []) / 12);
  }
  return out;
}

/** Midpoint of a skill's dated span, 0 = career start, 1 = today. */
function skillTimeMidpoint(view: ContentView, t0: number, t1: number): Map<string, number> {
  const periods = skillPeriods(view);
  const today = toMonths(currentYearMonth());
  const span = t1 - t0 || 1;
  const out = new Map<string, number>();
  for (const s of Object.values(view.skills).flat()) {
    const ps = periods.get(s.id) ?? [];
    if (ps.length === 0) {
      out.set(s.id, 0.5);
      continue;
    }
    const from = Math.min(...ps.map((p) => toMonths(p.start)));
    const to = Math.max(...ps.map((p) => (p.end ? toMonths(p.end) : today)));
    out.set(s.id, Math.max(0, Math.min(1, ((from + to) / 2 - t0) / span)));
  }
  return out;
}

/**
 * skill↔skill edges from declared `relatedIds`.
 *
 * Co-occurrence is not relatedness: React and CI/CD can share a project
 * without one extending the other, and that pair is already drawn as two
 * project→skill edges. The skill↔skill edge is an authoring fact — Jotai
 * extends React — the same kind as any other id list. Invariant 4 still
 * holds because nothing is inferred from who appeared next to whom.
 *
 * `weight` is always 1: the edge exists or it does not. Counting how many
 * times the author listed it would invent a ranking they did not write.
 */
export function skillAffinity(view: ContentView): Array<{ a: string; b: string; weight: number }> {
  const pairs = new Map<string, { a: string; b: string }>();
  const skills = Object.values(view.skills).flat();
  const known = new Set(skills.map((s) => s.id));

  for (const s of skills) {
    for (const other of s.relatedIds ?? []) {
      if (other === s.id || !known.has(other)) continue;
      const [a, b] = s.id < other ? [s.id, other] : [other, s.id];
      pairs.set(`${a}|${b}`, { a, b });
    }
  }

  return [...pairs.values()].map((p) => ({ ...p, weight: 1 }));
}

/**
 * Achievement→skill is real evidence and the layout uses it, but drawing
 * every one is the cobweb: a single achievement with five skills crosses
 * the whole map. The skill already hangs off the project; the achievement
 * already hangs off the role. Idle, those lines stay hidden. On focus they
 * light up, which is when they become an answer instead of noise.
 */
export function isQuietEdge(e: GraphEdge): boolean {
  if (e.kind !== "structure") return false;
  const src = e.source.slice(0, e.source.indexOf(":"));
  const tgt = e.target.slice(0, e.target.indexOf(":"));
  return src === "achievement" && tgt === "skill";
}

/**
 * Nodes with no edge at all. Today these are 11 declared `working` skills that
 * appear in no achievement and no project: rule 3 does not catch them because
 * it only demands evidence for `core`. Not a bug in the map — it is the map
 * showing where content is missing.
 */
export function nodesWithoutEvidence(graph: KnowledgeGraph): GraphNode[] {
  return graph.nodes.filter((n) => n.degree === 0);
}
