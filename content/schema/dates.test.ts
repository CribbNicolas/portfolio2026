/**
 * Tests for the date arithmetic.
 *
 * `monthsFromPeriods` is the one that matters: it decides how many years of
 * experience a skill claims. An end-to-end span would count the gaps as
 * experience, and that is exactly the number that collapses in an interview.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { monthsFromPeriods, monthsBetween } from "./dates";

test("monthsFromPeriods: a closed period is its own length", () => {
  assert.equal(monthsFromPeriods([{ start: "2020-01", end: "2020-07" }]), 6);
});

test("monthsFromPeriods: periods with a gap add up, the gap does NOT count", () => {
  // 2019-01→2021-01 is 24 months and 2024-01→2025-01 another 12. The three
  // year gap is not experience: the total is 36, not the 72 of an end-to-end
  // span.
  const months = monthsFromPeriods([
    { start: "2019-01", end: "2021-01" },
    { start: "2024-01", end: "2025-01" },
  ]);
  assert.equal(months, 36);
});

test("monthsFromPeriods: overlapping periods count once", () => {
  // Using React in two jobs at once is not twice the same years.
  const months = monthsFromPeriods([
    { start: "2020-01", end: "2022-01" },
    { start: "2021-01", end: "2023-01" },
  ]);
  assert.equal(months, 36);
});

test("monthsFromPeriods: touching periods become one", () => {
  const months = monthsFromPeriods([
    { start: "2020-01", end: "2021-01" },
    { start: "2021-01", end: "2022-01" },
  ]);
  assert.equal(months, 24);
});

test("monthsFromPeriods: a period without `end` runs up to today", () => {
  const months = monthsFromPeriods([{ start: "2020-01" }]);
  assert.equal(months, monthsBetween("2020-01", null));
});

test("monthsFromPeriods: an open period absorbs the ones after it", () => {
  // The open one reaches today, so a closed period starting later is contained
  // in it: adding it would count the same months twice.
  const months = monthsFromPeriods([
    { start: "2020-01" },
    { start: "2021-01", end: "2022-01" },
  ]);
  assert.equal(months, monthsBetween("2020-01", null));
});

test("monthsFromPeriods: no periods, zero", () => {
  // Invariant 4: with no evidence, nothing is estimated.
  assert.equal(monthsFromPeriods([]), 0);
});

test("monthsFromPeriods: input order does not change the total", () => {
  const unordered = monthsFromPeriods([
    { start: "2024-01", end: "2025-01" },
    { start: "2019-01", end: "2021-01" },
  ]);
  assert.equal(unordered, 36);
});
