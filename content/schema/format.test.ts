/**
 * Tests of the output contract.
 *
 * These functions are the only place a datum turns into visible text. Rule 4
 * (estimates with "~") and rule 1 (derived durations) are enforced here or
 * they are not enforced anywhere.
 *
 * The expected strings stay in Spanish: they are CV content, not code.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMetric } from "./format-metric";
import {
  formatDateRange,
  formatDuration,
  formatRoleTitle,
  formatSeniority,
  formatYearMonth,
} from "./format";
import type { Role } from "./content-schema";

test("rule 4: a measured metric carries no ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "-40%", confidence: "measured" });
  assert.equal(out, "-40%");
});

test("rule 4: an estimated metric carries a ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" });
  assert.equal(out, "~40%");
});

test("rule 4: an estimated before/after marks BOTH ends", () => {
  const out = formatMetric({
    label: "tiempo de build",
    before: "90 s",
    after: "12 s",
    confidence: "estimated",
  });
  assert.equal(out, "de ~90 s a ~12 s");
});

test("what formatMetric emits stays inside the loaded font subset", () => {
  // The pages load Manrope's `latin` subset only. A glyph outside it — `→` was
  // the one that got through — makes Chromium substitute a system font for that
  // character, and the PDF stops being fully embedded. Caught in CI on Linux;
  // on Windows the substitute has another name and the check stayed quiet.
  const out = formatMetric({
    label: "tiempo de indexado",
    before: "3-5 s",
    after: "500 ms",
    confidence: "estimated",
  })!;
  const outside = [...out].filter((c) => c.codePointAt(0)! > 0xff);
  assert.deepEqual(outside, [], `outside the latin subset: ${outside.join(" ")}`);
});

test("a metric with no numbers returns null, not an empty string", () => {
  // The caller has to be able to drop the whole fragment. An "" slips silently
  // into a template and leaves a dangling dash in the CV.
  const out = formatMetric({ label: "algo", confidence: "measured" });
  assert.equal(out, null);
});

test("formatYearMonth uses MM/AAAA (docs/03 §2)", () => {
  assert.equal(formatYearMonth("2023-07", "es"), "07/2023");
});

test("formatDateRange: a null end is Actualidad, not an invented date", () => {
  assert.equal(formatDateRange("2024-09", null, "es"), "09/2024 — Actualidad");
  assert.equal(formatDateRange("2022-06", "2024-09", "es"), "06/2022 — 09/2024");
});

test("formatDuration: years and months spelled out, singular included", () => {
  assert.equal(formatDuration(23, "es"), "1 año 11 meses");
  assert.equal(formatDuration(12, "es"), "1 año");
  assert.equal(formatDuration(5, "es"), "5 meses");
  assert.equal(formatDuration(1, "es"), "1 mes");
});

test("rule 2: a concurrent role declares it in the title", () => {
  const role = {
    id: "hogarth",
    company: "Hogarth",
    title: "Frontend Developer",
    employmentType: "contract",
    concurrent: true,
    workMode: "remote",
    start: "2023-07",
    end: "2024-01",
    context: { short: "x" },
    visibility: { priority: 2 },
  } as Role;
  assert.equal(formatRoleTitle(role, "es"), "Frontend Developer (en paralelo)");
});

test("formatRoleTitle prefers displayTitle when present", () => {
  const role = {
    id: "dinkum",
    company: "Dinkum",
    title: "Desarrollador de front-end",
    displayTitle: "Desarrollador Full Stack",
    employmentType: "full-time",
    workMode: "remote",
    start: "2024-09",
    end: null,
    context: { short: "x" },
    visibility: { priority: 1 },
  } as Role;
  assert.equal(formatRoleTitle(role, "es"), "Desarrollador Full Stack");
});

test("formatSeniority does not write the number by hand", () => {
  assert.equal(formatSeniority(6, "es"), "6+ años");
});

test("formatDuration speaks the locale it is asked for", () => {
  assert.equal(formatDuration(23, "es"), "1 año 11 meses");
  assert.equal(formatDuration(23, "en"), "1 year 11 months");
  assert.equal(formatDuration(1, "en"), "1 month");
  assert.equal(formatDuration(12, "en"), "1 year");
});

test("an open range says it is open, in both languages", () => {
  assert.equal(formatDateRange("2024-01", null, "es"), "01/2024 — Actualidad");
  assert.equal(formatDateRange("2024-01", null, "en"), "01/2024 — Present");
});

test("rule 2: a concurrent role declares it in both languages", () => {
  const role = { title: "Dev", concurrent: true } as Parameters<typeof formatRoleTitle>[0];
  assert.equal(formatRoleTitle(role, "es"), "Dev (en paralelo)");
  assert.equal(formatRoleTitle(role, "en"), "Dev (concurrent)");
});
