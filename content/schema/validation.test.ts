/**
 * Tests for the coherence rules that Zod cannot express.
 *
 * Zod checks the shape of a `SkillPeriod`; nothing in a type can say that
 * `end` must come after `start`, or that two declared periods of the same
 * skill must not overlap. Those live in `checkRules`, and this is where they
 * are held.
 *
 * The fixture is the real dataset, deep-cloned and then broken on purpose: a
 * hand-written one would drift from the schema and stop proving anything.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkRules } from "./validation";
import type { ContentDataset, Skill } from "./content-schema";
import raw from "../data/content.es.json";

/** The real dataset, cloned so a test can break it without touching the next. */
const dataset = (): ContentDataset =>
  structuredClone(raw) as unknown as ContentDataset;

/** Replaces the periods of the first skill and returns the broken dataset. */
const withPeriods = (periods: Skill["periods"]): ContentDataset => {
  const data = dataset();
  data.skills[0].periods = periods;
  return data;
};

test("the untouched dataset breaks no rule", () => {
  // If this fails, every other test here is measuring the wrong thing.
  assert.deepEqual(checkRules(dataset()), []);
});

test("a period ending before it starts is a violation", () => {
  const violations = checkRules(withPeriods([{ start: "2022-01", end: "2021-01" }]));
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /2021-01/);
});

test("a period ending exactly when it starts is a violation", () => {
  // Zero months is not a period, it is a typo.
  const violations = checkRules(withPeriods([{ start: "2022-01", end: "2022-01" }]));
  assert.equal(violations.length, 1);
});

test("two overlapping declared periods are a violation", () => {
  // Merging would hide it. Declaring the same stretch twice is a typo, and the
  // point of these rules is that the data gets fixed, not the rule.
  const violations = checkRules(
    withPeriods([
      { start: "2020-01", end: "2022-01" },
      { start: "2021-01", end: "2023-01" },
    ]),
  );
  assert.equal(violations.length, 1);
});

test("two open periods are a violation: both run to today, so they overlap", () => {
  const violations = checkRules(
    withPeriods([{ start: "2020-01" }, { start: "2021-01" }]),
  );
  assert.equal(violations.length, 1);
});

test("consecutive periods that do not overlap are fine", () => {
  const violations = checkRules(
    withPeriods([
      { start: "2019-01", end: "2021-01" },
      { start: "2024-01", end: "2025-01" },
    ]),
  );
  assert.deepEqual(violations, []);
});

test("touching periods are fine: an end and a start in the same month do not overlap", () => {
  const violations = checkRules(
    withPeriods([
      { start: "2020-01", end: "2021-01" },
      { start: "2021-01", end: "2022-01" },
    ]),
  );
  assert.deepEqual(violations, []);
});

test("a relatedIds entry that is not a skill is a violation", () => {
  const data = dataset();
  const jotai = data.skills.find((s) => s.id === "jotai");
  assert.ok(jotai);
  jotai.relatedIds = ["not-a-skill"];
  const violations = checkRules(data);
  assert.equal(violations.length, 1);
  assert.match(violations[0]!.message, /not-a-skill/);
});

test("a skill cannot list itself in relatedIds", () => {
  const data = dataset();
  const react = data.skills.find((s) => s.id === "react");
  assert.ok(react);
  react.relatedIds = ["react"];
  const violations = checkRules(data);
  assert.equal(violations.length, 1);
  assert.match(violations[0]!.message, /itself/);
});
