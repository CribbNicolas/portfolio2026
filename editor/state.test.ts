/**
 * The in-memory dataset, including the prune that clearing an optional object
 * depends on. Lives next to the other editor tests; the module itself is a
 * browser ESM file the typecheck never sees.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createState } from "./public/state.js";

test("clearing the last field of a nested object removes the empty container", () => {
  const state = createState({
    achievements: [{ id: "a", metric: { label: "build time", confidence: "estimated" } }],
  });

  state.set("achievements.0.metric.confidence", undefined);
  state.set("achievements.0.metric.label", undefined);

  assert.equal(state.get("achievements.0.metric"), undefined);
  assert.deepEqual(state.all(), { achievements: [{ id: "a" }] });
});

test("clearing a required nested string to empty drops the optional container", () => {
  // metric.label is required on Metric, so the input writes "" not undefined.
  // That is the path the page actually takes when the author types into an
  // absent metric and then deletes the text.
  const state = createState({
    achievements: [{ id: "a", metric: { label: "tiempo de build" } }],
  });

  state.set("achievements.0.metric.label", "");

  assert.equal(state.get("achievements.0.metric"), undefined);
  assert.deepEqual(state.all(), { achievements: [{ id: "a" }] });
});

test("clearing one field of a nested object leaves the siblings", () => {
  const state = createState({
    achievements: [{ id: "a", metric: { label: "build time", confidence: "estimated" } }],
  });

  state.set("achievements.0.metric.label", undefined);

  assert.deepEqual(state.get("achievements.0.metric"), { confidence: "estimated" });
});

test("clearing a top-level object's last field does not delete the object", () => {
  const state = createState({ identity: { name: "x" }, roles: [] });

  state.set("identity.name", undefined);

  assert.deepEqual(state.all().identity, {});
  assert.ok("identity" in state.all());
});

test("an empty nested array is left in place: it is not an empty object", () => {
  const state = createState({
    skills: [{ id: "react", periods: [{ start: "2020-01" }] }],
  });

  state.removeAt("skills.0.periods", 0);

  assert.deepEqual(state.get("skills.0.periods"), []);
});
