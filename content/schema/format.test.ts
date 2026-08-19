/**
 * Tests del contrato de salida.
 *
 * Estas funciones son el único lugar donde un dato se convierte en texto
 * visible. La regla 4 (estimados con "~") y la regla 1 (duraciones derivadas)
 * se hacen cumplir acá o no se hacen cumplir en ningún lado.
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

test("regla 4: una métrica measured no lleva ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "-40%", confidence: "measured" });
  assert.equal(out, "-40%");
});

test("regla 4: una métrica estimated lleva ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" });
  assert.equal(out, "~40%");
});

test("regla 4: before/after estimado marca los DOS extremos", () => {
  const out = formatMetric({
    label: "tiempo de build",
    before: "90 s",
    after: "12 s",
    confidence: "estimated",
  });
  assert.equal(out, "~90 s → ~12 s");
});

test("una métrica sin números devuelve null, no un string vacío", () => {
  // El llamador tiene que poder omitir el fragmento entero. Un "" se cuela
  // silenciosamente en un template y deja un guion suelto en el CV.
  const out = formatMetric({ label: "algo", confidence: "measured" });
  assert.equal(out, null);
});

test("formatYearMonth usa MM/AAAA (docs/03 §2)", () => {
  assert.equal(formatYearMonth("2023-07"), "07/2023");
});

test("formatDateRange: end null es Actualidad, no una fecha inventada", () => {
  assert.equal(formatDateRange("2024-09", null), "09/2024 — Actualidad");
  assert.equal(formatDateRange("2022-06", "2024-09"), "06/2022 — 09/2024");
});

test("formatDuration: años y meses en palabras, singular incluido", () => {
  assert.equal(formatDuration(23), "1 año 11 meses");
  assert.equal(formatDuration(12), "1 año");
  assert.equal(formatDuration(5), "5 meses");
  assert.equal(formatDuration(1), "1 mes");
});

test("regla 2: un rol concurrent se declara en el título", () => {
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
  assert.equal(formatRoleTitle(role), "Frontend Developer (en paralelo)");
});

test("formatRoleTitle prefiere displayTitle cuando existe", () => {
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
  assert.equal(formatRoleTitle(role), "Desarrollador Full Stack");
});

test("formatSeniority no escribe el número a mano", () => {
  assert.equal(formatSeniority(6), "6+ años");
});
