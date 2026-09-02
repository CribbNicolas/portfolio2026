/**
 * What the schema CANNOT validate about the graph: referential integrity of
 * the result, determinism of the layout, and that no TODO from the dataset
 * leaks into a tooltip.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { content } from "../source/index";
import {
  buildKnowledgeGraph, nodesWithoutEvidence, skillAffinity, skillYears,
  RADIUS_SCALE_MIN, RADIUS_SCALE_MAX,
} from "./knowledge-graph";
import { monthsBetween } from "./dates";
import { layoutGraph, projectGraph } from "./graph-layout";
import type { ContentView, Skill } from "./content-schema";

const view = await content.getView("portfolio", "es");
const graph = buildKnowledgeGraph(view);

/** A skill with no periods and no citations. The live view may have none. */
const GHOST: Skill = {
  id: "ghost-uncited",
  name: "Ghost",
  category: "practice",
  aliases: [],
  level: "familiar",
  active: true,
  visibility: { priority: 5 },
};

function viewWithGhost(base: ContentView): ContentView {
  return {
    ...base,
    skills: {
      ...base.skills,
      practice: [...(base.skills.practice ?? []), GHOST],
    },
  };
}

test("every node has a namespaced, unique id", () => {
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    assert.match(n.id, /^(skill|role|project|achievement):.+/, `id without namespace: ${n.id}`);
    assert.ok(!ids.has(n.id), `duplicated id: ${n.id}`);
    ids.add(n.id);
  }
});

test("hard rule: no edge points at a node that does not exist", () => {
  // If this fails, the layout operates on undefined and the graph blows up
  // with no useful message. `resolveView` filters skills by `active`, so the
  // situation is real, not theoretical.
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    assert.ok(ids.has(e.source), `orphan edge, source: ${e.source}`);
    assert.ok(ids.has(e.target), `orphan edge, target: ${e.target}`);
  }
});

test("no tooltip starts with a TODO from the dataset", () => {
  // `Project.problem` and `Project.outcome` still carry a TODO in 2 of 3
  // projects. That is why the builder uses `solution.short`. This test is what
  // turns that fragile choice into a rule.
  for (const n of graph.nodes) {
    assert.ok(n.detail.length > 0, `empty detail in ${n.id}`);
    assert.ok(!n.detail.trimStart().startsWith("TODO"), `TODO leaked in ${n.id}: ${n.detail}`);
  }
});

test("degree is computed from the graph, not from the dataset", () => {
  const expected = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (const e of graph.edges) {
    expected.set(e.source, expected.get(e.source)! + 1);
    expected.set(e.target, expected.get(e.target)! + 1);
  }
  for (const n of graph.nodes) assert.equal(n.degree, expected.get(n.id));
});

test("affinity: only pairs sharing a real source", () => {
  const pairs = skillAffinity(view);
  for (const p of pairs) {
    assert.ok(p.weight >= 1, `invalid weight in ${p.a}|${p.b}`);
    assert.notEqual(p.a, p.b, "a skill cannot have affinity with itself");
  }
  // No duplicates: the pair is normalized alphabetically before grouping.
  const keys = pairs.map((p) => `${p.a}|${p.b}`);
  assert.equal(new Set(keys).size, keys.length, "duplicated affinity pair");
});

test("affinity: every skill on an affinity edge has evidence", () => {
  // A skill with no achievements cannot co-occur with anything. If it shows up
  // here, the derivation is reading from the wrong place.
  const withoutEvidence = new Set(nodesWithoutEvidence(graph).map((n) => n.id));
  for (const e of graph.edges.filter((x) => x.kind === "affinity")) {
    assert.ok(!withoutEvidence.has(e.source), `affinity from a node without evidence: ${e.source}`);
    assert.ok(!withoutEvidence.has(e.target), `affinity toward a node without evidence: ${e.target}`);
  }
});

test("emission order is stable across runs", () => {
  // The layout seeds positions by node index: a different order is a different
  // map. This is what makes the determinism of the layout real.
  const other = buildKnowledgeGraph(view);
  assert.deepEqual(
    other.nodes.map((n) => n.id),
    graph.nodes.map((n) => n.id),
  );
});

test("the layout is deterministic", () => {
  const a = layoutGraph(buildKnowledgeGraph(view));
  const b = layoutGraph(buildKnowledgeGraph(view));
  assert.deepEqual(a.nodes, b.nodes, "two layout runs disagreed");
  assert.equal(a.framingRadius, b.framingRadius);
});

test("`withoutEvidence` is exactly \"has no evidence\"", () => {
  // The `<svg>` consumes it to draw those nodes differently. If it drifts out
  // of sync with the degree, the map lies about what is backed by evidence.
  const positioned = layoutGraph(graph);
  for (const n of positioned.nodes) {
    assert.equal(n.withoutEvidence, n.degree === 0, `${n.id} misclassified`);
  }
});

test("the framing does not depend on the size of the dataset", () => {
  // Normalization is what keeps adding an achievement from changing the zoom
  // of the whole page. It is checked on the percentile, which is what gets
  // normalized.
  const { nodes } = layoutGraph(graph);
  const body = nodes
    .filter((n) => !n.withoutEvidence)
    .map((n) => Math.hypot(n.x, n.y, n.z))
    .sort((a, b) => a - b);
  const p85 = body[Math.floor(body.length * 0.85)]!;
  assert.ok(Math.abs(p85 - 300) < 1, `the body was not normalized to 300 (got ${p85.toFixed(1)})`);
});

test("the layout does not degenerate: nodes occupy volume on all three axes", () => {
  const { nodes } = layoutGraph(graph);
  for (const axis of ["x", "y", "z"] as const) {
    const vs = nodes.map((n) => n[axis]);
    const range = Math.max(...vs) - Math.min(...vs);
    assert.ok(range > 100, `axis ${axis} collapsed (range ${range.toFixed(1)})`);
  }
});

test("the projection produces real perspective", () => {
  // With no scale variation the drawing is flat and the whole concept falls
  // apart.
  const projected = projectGraph(layoutGraph(graph));
  const scales = projected.map((p) => p.scale);
  const min = Math.min(...scales);
  const max = Math.max(...scales);
  assert.ok(min > 0, "non-positive scale: a node sits behind the camera");
  assert.ok(max / min > 1.3, `not enough perspective (${(max / min).toFixed(2)}×)`);
});

// ---------------------------------------------------------------------------
// SIZE: weight = years × connections
// ---------------------------------------------------------------------------

test("skillYears: declared `periods` are UNIONed with the evidence, not a replacement", () => {
  const years = skillYears(view);
  // React declares a period from 2022-10, but the evidence starts earlier:
  // AdsMovil (2022-06), still open at Dinkum. A declared period ADDS what no
  // achievement records; it never erases real evidence.
  const withEvidence = monthsBetween("2022-06", null) / 12;
  assert.ok(
    Math.abs(years.get("react")! - withEvidence) < 0.01,
    `the declared period hid the evidence: ${years.get("react")} vs ${withEvidence}`,
  );
});

test("skillYears: the span crosses roles and reaches today when one is still open", () => {
  const years = skillYears(view);
  // JavaScript shows up in all four roles; the oldest starts in 2020-04 and
  // Dinkum is still open. With no declared `periods`, that is the whole span.
  assert.ok(Math.abs(years.get("javascript")! - monthsBetween("2020-04", null) / 12) < 0.01);
});

test("skillYears: a project without a `roleId` still contributes its own date", async () => {
  // `jwd-maderas` has no role and is unpublished until it ships. The years
  // still have to come from the project's own dates, not from a role. Inject
  // it into a copy of the view so hiding it from the portfolio does not
  // silently drop this path.
  const dataset = await content.getDataset("es");
  const jwd = dataset.projects.find((p) => p.id === "jwd-maderas");
  assert.ok(jwd, "jwd-maderas stays in the dataset");
  assert.equal(
    view.projects.some((p) => p.id === "jwd-maderas"),
    false,
    "jwd-maderas is hidden from the portfolio until it ships",
  );
  const years = skillYears({ ...view, projects: [...view.projects, jwd] });
  // `sanity` is `only: []` until jwd-maderas ships, so it is not in the
  // portfolio view. Next.js and Tailwind stay: they have other evidence too,
  // and jwd still has to contribute its own dates (no `roleId`).
  for (const id of ["nextjs", "tailwind"]) {
    assert.ok(years.get(id)! > 0, `${id} came out at 0 years while holding dated evidence`);
  }
});

test("skillYears: with no dated evidence and no `periods`, zero", () => {
  const years = skillYears(viewWithGhost(view));
  assert.equal(years.get(GHOST.id), 0, "an uncited skill with no periods invented years");
  for (const n of graph.nodes.filter((n) => n.kind === "skill" && n.degree === 0)) {
    assert.equal(years.get(n.id.replace("skill:", ""))!, 0, `${n.id} invented years with no evidence`);
  }
});

test("weight = years × degree, and only for skills", () => {
  for (const n of graph.nodes) {
    if (n.kind === "skill") assert.ok(Math.abs(n.weight - n.years * n.degree) < 1e-9, `wrong weight in ${n.id}`);
    else assert.equal(n.weight, 0, `${n.id} is not a skill and carries weight`);
  }
});

test("radiusScale stays in range, and is exactly 1 outside skills", () => {
  for (const n of graph.nodes) {
    if (n.kind !== "skill") {
      assert.equal(n.radiusScale, 1, `${n.id} is not a skill: its radius is governed by kind, not by the formula`);
      continue;
    }
    assert.ok(
      n.radiusScale >= RADIUS_SCALE_MIN && n.radiusScale <= RADIUS_SCALE_MAX,
      `${n.id} out of range: ${n.radiusScale}`,
    );
  }
});

test("the radius follows the square root of the weight, not a linear one", () => {
  // This is what makes the AREA encode the weight. With a linear radius, a
  // skill with 4× the weight covers 16× the area and the map turns into one
  // node with satellites.
  const skills = graph.nodes.filter((n) => n.kind === "skill" && n.weight > 0);
  const max = skills.reduce((a, b) => (a.weight > b.weight ? a : b));
  const t = (n: (typeof skills)[number]) =>
    (n.radiusScale - RADIUS_SCALE_MIN) / (RADIUS_SCALE_MAX - RADIUS_SCALE_MIN);
  for (const n of skills) {
    assert.ok(Math.abs(t(n) - Math.sqrt(n.weight / max.weight)) < 1e-9, `${n.id} does not follow the square root`);
  }
  assert.equal(t(max), 1, "the heaviest skill has to reach the ceiling");
});

test("the largest skill is the one with most years × connections, not most degree", () => {
  const skills = graph.nodes.filter((n) => n.kind === "skill");
  const byRadius = [...skills].sort((a, b) => b.radiusScale - a.radiusScale)[0]!;
  const byWeight = [...skills].sort((a, b) => b.weight - a.weight)[0]!;
  assert.equal(byRadius.id, byWeight.id);
});

// ---------------------------------------------------------------------------
// RADIAL LAYOUT: roles on the outside, technologies at the center
// ---------------------------------------------------------------------------

test("roles end up outside the skills", () => {
  const { nodes } = layoutGraph(graph);
  const radius = (k: string) => {
    const rs = nodes.filter((n) => n.kind === k && !n.withoutEvidence).map((n) => Math.hypot(n.x, n.y, n.z));
    return rs.reduce((a, b) => a + b, 0) / rs.length;
  };
  const roles = radius("role");
  const skills = radius("skill");
  assert.ok(roles > skills, `roles at ${roles.toFixed(0)} and skills at ${skills.toFixed(0)}: there is no crust`);
  // Achievements and projects are the bridge: they have to land in between.
  assert.ok(radius("project") < roles, "projects ended up further out than the roles");
  assert.ok(radius("skill") < radius("achievement"), "skills did not end up inside the achievements");
});

test("skills without evidence go to the core, not the rim", () => {
  const { nodes } = layoutGraph(buildKnowledgeGraph(viewWithGhost(view)));
  const core = nodes.filter((n) => n.withoutEvidence);
  assert.ok(core.some((n) => n.id === `skill:${GHOST.id}`), "the injected orphan never landed");
  const body = nodes
    .filter((n) => !n.withoutEvidence)
    .map((n) => Math.hypot(n.x, n.y, n.z))
    .sort((a, b) => a - b);
  const median = body[Math.floor(body.length / 2)]!;
  for (const n of core) {
    assert.ok(
      Math.hypot(n.x, n.y, n.z) < median,
      `${n.id} has no evidence and landed outside the median of the body`,
    );
  }
});

test("the framing contains the whole graph", () => {
  // The camera uses `framingRadius` for the initial `dist` and for the fog. If
  // a node falls outside, it enters the frame clipped or is not visible at all.
  const { nodes, framingRadius } = layoutGraph(graph);
  for (const n of nodes) {
    assert.ok(Math.hypot(n.x, n.y, n.z) <= framingRadius, `${n.id} fell outside the framing`);
  }
});

test("no node is drawn on top of another", () => {
  // This is the regression variable sizing brought in: with radii from 6 to 34,
  // React swallowed whole the small skills landing next to it. Repulsion became
  // size-weighted, and the orphans left the simulation for the same reason.
  //
  // 3D radii, the larger of the two renderers: if they do not overlap here,
  // they do not overlap in the `<svg>` either.
  const R: Record<string, number> = { role: 17, project: 14, skill: 10, achievement: 9 };
  const { nodes } = layoutGraph(graph);
  const radius = (n: (typeof nodes)[number]) => R[n.kind]! * n.radiusScale;

  const overlaps: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let k = i + 1; k < nodes.length; k++) {
      const a = nodes[i]!, b = nodes[k]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      const sum = radius(a) + radius(b);
      if (d < sum) overlaps.push(`${a.label}/${b.label} (${(d - sum).toFixed(0)})`);
    }
  }
  assert.deepEqual(overlaps, [], `overlapping nodes: ${overlaps.join(", ")}`);
});
