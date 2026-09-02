/**
 * The two surfaces agents consume, and the only two that had no gate.
 *
 * `/cv` has eleven tests over the PDF, the landing has nine checks, the bundle
 * has a budget. `/cv.json` and `/llms.txt` had nothing — and a real
 * `formatRoleTitle` bug already got through into `llms.txt` once, recorded in
 * PR #1 (`07-technical-debt.md` §8).
 *
 * What is verified here is what breaks silently: JSON that stops parsing, a
 * contract key that disappears, and text assembled from a field that came back
 * empty. None of it shows up as an error — the endpoint answers 200 with
 * something useless.
 *
 * The name does NOT end in `.test.ts` on purpose: it reads `dist/`, so it needs
 * a prior build. Same reason as `pdf-output.check.ts` and
 * `single-landing.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { content, formatRoleTitle, groupedSkills } from "../content/source/index";

const DIST = "dist";
const rawJson = await readFile(join(DIST, "cv.json"), "utf8");
const llms = await readFile(join(DIST, "llms.txt"), "utf8");

// ---------------------------------------------------------------------------
// /cv.json
// ---------------------------------------------------------------------------

test("/cv.json parses", () => {
  // First and dumbest: everything below assumes it does.
  assert.doesNotThrow(() => JSON.parse(rawJson), "dist/cv.json is not valid JSON");
});

const cv = JSON.parse(rawJson) as Record<string, unknown>;

test("/cv.json carries the keys the contract promises", () => {
  // The keys of `ContentView` (CONTRACT §2). If one disappears because a
  // generator changed, whoever consumes this finds out by getting `undefined`.
  const expected = [
    "surface", "identity", "experience", "projects", "skills",
    "education", "certifications", "languages", "services", "testimonials",
    "yearsOfExperience",
  ];
  const missing = expected.filter((k) => !(k in cv));
  assert.deepEqual(missing, [], `/cv.json is missing: ${missing.join(", ")}`);
});

test("/cv.json is the public-api surface, not another one", () => {
  // If it were serving `portfolio`, rule 8 would not have been applied and the
  // private contact data would be in a public JSON.
  assert.equal(cv.surface, "public-api", `/cv.json declares surface "${cv.surface}"`);
});

test("rule 8: /cv.json publishes neither phone nor street address", async () => {
  // `resolveView` already filters them. This verifies the filter survived the
  // trip to `dist/`, which is the part no unit test sees.
  const identity = cv.identity as Record<string, Record<string, unknown>>;
  assert.equal(identity.contact.phone, undefined, "the phone number is in /cv.json");
  assert.equal(identity.location.streetAddress, undefined, "the street address is in /cv.json");

  // And that it is not simply empty because the dataset has nothing to hide:
  // the filter has to be what removes it.
  const data = await content.getDataset("es");
  if (data.identity.contact.phone) {
    assert.notEqual(
      JSON.stringify(cv).includes(data.identity.contact.phone),
      true,
      "the dataset's phone number appears somewhere in /cv.json",
    );
  }
});

test("/cv.json says the same as the view it comes from", async () => {
  // Not a snapshot: it compares against the derivation. A snapshot would need
  // updating on every content change and would stop being read.
  const view = await content.getView("public-api", "es");
  assert.equal((cv.experience as unknown[]).length, view.experience.length);
  assert.equal((cv.projects as unknown[]).length, view.projects.length);
  assert.equal(cv.yearsOfExperience, view.yearsOfExperience);
});

// ---------------------------------------------------------------------------
// /llms.txt
// ---------------------------------------------------------------------------

test("/llms.txt has the sections an agent looks for", () => {
  for (const heading of ["# ", "## Contacto", "## Stack", "## Experiencia", "## Proyectos"]) {
    assert.ok(llms.includes(heading), `/llms.txt is missing the "${heading.trim()}" section`);
  }
});

test("/llms.txt has no empty fields", () => {
  // The failure mode: a template that assembles `- Label: ${value}` with an
  // undefined value. The endpoint still answers 200 and the line reads as if
  // the datum were empty rather than missing.
  const offenders = llms
    .split("\n")
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => /^(-|###?)\s*[^:]*:\s*$/.test(line) || /:\s*(undefined|null)\b/.test(line))
    .map(([n, line]) => `${n}: ${line.trim()}`);

  assert.deepEqual(offenders, [], `/llms.txt has empty or undefined fields:\n  ${offenders.join("\n  ")}`);
});

test("/llms.txt prints role titles whole", async () => {
  // This is the bug that already got through: `formatRoleTitle` is what adds
  // the "(en paralelo)" of rule 2, and building the heading by hand loses it.
  const view = await content.getView("public-api", "es");
  for (const role of view.experience) {
    const title = formatRoleTitle(role, "es");
    assert.ok(
      llms.includes(title),
      `the role title "${title}" does not appear whole in /llms.txt`,
    );
  }
});

test("/llms.txt groups the skills the same way the CV does", async () => {
  // Both surfaces read `groupedSkills`. Before that they kept two lists: the CV
  // printed `Lenguajes:` in editorial order and this one `- language:` in
  // insertion order, so an agent comparing them saw two taxonomies (§9).
  const view = await content.getView("public-api", "es");
  for (const { label, skills } of groupedSkills(view.skills, "es")) {
    assert.ok(
      llms.includes(`- ${label}: `),
      `/llms.txt does not print the "${label}" group`,
    );
    assert.ok(
      llms.includes(skills[0]!.name),
      `"${skills[0]!.name}" is missing from the "${label}" group`,
    );
  }
});

test("no dataset TODO reaches /llms.txt as a bare field", () => {
  // TODOs in the prose are expected and reported by `audit:todos` without
  // blocking. What must not happen is a heading or a label whose entire value is
  // a TODO: that is a structural hole, not missing content.
  const offenders = llms
    .split("\n")
    .filter((line) => /^(###?|-\s*[^:]+:)\s*TODO/.test(line.trim()));
  assert.deepEqual(offenders, [], `/llms.txt has TODO as a whole field:\n  ${offenders.join("\n  ")}`);
});
