/**
 * The dataset's verdict, in a shape a form can render.
 *
 * `validateDataset` throws one Error with every violation concatenated into its
 * message. That is right for `pnpm run validate` and useless for a field: the
 * editor has to anchor each Zod issue to the path it came from, and to keep
 * shape errors apart from rule violations, which are cross-entity and belong in
 * a panel rather than on an input.
 *
 * What this must NOT do is decide anything itself. Every verdict below comes
 * from `content/schema/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { inspectDataset } from "./inspect";

const DATA_FILE = "content/data/content.es.json";
const dataset = JSON.parse(
  (await readFile(DATA_FILE, "utf8")).replace(/\r\n/g, "\n"),
) as Record<string, unknown>;

const clone = (): Record<string, unknown> => structuredClone(dataset);

test("the committed dataset is ok, with nothing to report", () => {
  const report = inspectDataset(dataset);
  assert.equal(report.ok, true);
  assert.deepEqual(report.zodIssues, []);
  assert.deepEqual(report.violations, []);
});

test("a shape error comes back as a Zod issue carrying its path", () => {
  const broken = clone();
  (broken.identity as Record<string, unknown>).fullName = 42;

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  const issue = report.zodIssues.find((i) => i.path === "identity.fullName");
  assert.ok(issue, `expected an issue at identity.fullName, got ${JSON.stringify(report.zodIssues)}`);
  assert.ok(issue.message.length > 0);
});

test("an array index appears in the path, so the form can find the row", () => {
  const broken = clone();
  (broken.skills as Array<Record<string, unknown>>)[0].name = null;

  const report = inspectDataset(broken);
  assert.ok(report.zodIssues.some((i) => i.path === "skills.0.name"));
});

test("an undeclared key is an issue, not a silent drop: the schema is strict", () => {
  const broken = clone();
  (broken.identity as Record<string, unknown>).nickname = "Nico";

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  assert.ok(report.zodIssues.length > 0);
});

test("a rule violation comes back as a violation, not as a Zod issue", () => {
  const broken = clone();
  // Referential integrity: rule 0. The shape is still perfectly valid.
  (broken.achievements as Array<Record<string, unknown>>)[0].roleId = "does-not-exist";

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  assert.deepEqual(report.zodIssues, []);
  assert.ok(report.violations.some((v) => v.message.includes("does-not-exist")));
});

test("rules are not evaluated when the shape is wrong", () => {
  // checkRules indexes into a dataset it assumes is parsed. Running it over
  // garbage would throw where a report is expected, so a shape failure returns
  // early and the violations list stays empty by construction.
  const report = inspectDataset({ nonsense: true });
  assert.equal(report.ok, false);
  assert.ok(report.zodIssues.length > 0);
  assert.deepEqual(report.violations, []);
});

test("a value that is not an object at all is a report, never a throw", () => {
  assert.doesNotThrow(() => inspectDataset(null));
  assert.equal(inspectDataset(null).ok, false);
});
