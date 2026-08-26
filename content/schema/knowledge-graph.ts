/**
 * ContentView → KnowledgeGraph.
 *
 * This is the view that delivers on the promise of CONTRATO §3: `Achievement`s
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
import { monthsFromPeriods } from "./dates";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type GraphNodeKind = "skill" | "role" | "project" | "achievement";

/** Where an edge comes from. The kind decides how it is drawn and how hard it pulls. */
export type GraphEdgeKind =
  /** Structure declared in the dataset: achievement→role, achievement→skill, project→skill. */
  | "structure"
  /** Derived: two skills sharing evidence. See `skillAffinity`. */
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
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /**
   * How many distinct sources back the edge. Always 1 for `structure`; for
   * `affinity` it is how many achievements/projects share both skills.
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
 * and an invisible node cannot be hovered or clicked. The ceiling is 3.4 so the
 * most proven technology sits clearly above a role (fixed radius), which is
 * what makes "this is what I know best" readable at a glance.
 */
export const RADIUS_SCALE_MIN = 0.6;
export const RADIUS_SCALE_MAX = 3.4;

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
    });
  }

  for (const a of achievements) {
    nodes.push({
      id: nodeId("achievement", a.id),
      kind: "achievement",
      label: a.text.short,
      detail: a.text.short,
      degree: 0,
      years: 0,
      weight: 0,
      radiusScale: 1,
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
  // FINISHED graph: it depends on the affinity edges, which are derived.
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
export function skillYears(view: ContentView): Map<string, number> {
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

  const out = new Map<string, number>();
  for (const s of Object.values(view.skills).flat()) {
    // Declared periods go into the same bag as the derived ones: a union, not a
    // replacement. An incomplete declared period cannot erase real evidence.
    for (const p of s.periods ?? []) record(s.id, p.start, p.end ?? null);
    out.set(s.id, monthsFromPeriods(periods.get(s.id) ?? []) / 12);
  }
  return out;
}

/**
 * skill↔skill edges by co-occurrence.
 *
 * Two skills appearing in the SAME achievement or project are related by
 * evidence, not by opinion: the datum is already in the dataset, only
 * implicit. This invents nothing (invariant 4) — if two skills never appeared
 * together in a real fact, there is no edge.
 *
 * `weight` = how many distinct sources share them. That is what tells "I used
 * them together once" apart from "this is my working combination".
 */
export function skillAffinity(view: ContentView): Array<{ a: string; b: string; weight: number }> {
  const sources = new Map<string, Set<string>>();

  const record = (skillIds: readonly string[], source: string) => {
    for (let i = 0; i < skillIds.length; i++) {
      for (let k = i + 1; k < skillIds.length; k++) {
        const [a, b] = skillIds[i]! < skillIds[k]! ? [skillIds[i]!, skillIds[k]!] : [skillIds[k]!, skillIds[i]!];
        const key = `${a}|${b}`;
        if (!sources.has(key)) sources.set(key, new Set());
        sources.get(key)!.add(source);
      }
    }
  };

  for (const r of view.experience) for (const a of r.achievements) record(a.skillIds, a.id);
  for (const p of view.projects) record(p.skillIds, p.id);

  return [...sources].map(([key, srcs]) => {
    const [a, b] = key.split("|") as [string, string];
    return { a, b, weight: srcs.size };
  });
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
