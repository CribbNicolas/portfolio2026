/**
 * Tests de la comparación de versiones.
 *
 * Corre en `pnpm test` porque no necesita build ni repo git: la lógica que
 * decide si un bump es válido es pura, y esa fue la razón de separarla de
 * `version-bump.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parsear, salto, verificarBump } from "./version";

test("parsear acepta x.y.z y nada más", () => {
  assert.deepEqual(parsear("1.2.3"), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parsear("  0.1.0 "), { major: 0, minor: 1, patch: 0 });

  // Válidos en semver, rechazados acá a propósito: no hay canal de prerelease
  // ni builds numerados, así que aceptarlos obligaría a definir cómo ordenan.
  assert.equal(parsear("1.0.0-rc.1"), null);
  assert.equal(parsear("1.0.0+build.5"), null);
  assert.equal(parsear("1.2"), null);
  assert.equal(parsear("v1.2.3"), null);
  assert.equal(parsear(""), null);
});

test("el bump tiene que subir", () => {
  assert.equal(verificarBump("0.1.0", "0.2.0").ok, true);
  assert.equal(verificarBump("0.1.0", "0.1.1").ok, true);
  assert.equal(verificarBump("0.9.0", "1.0.0").ok, true);
});

test("la misma versión falla: es el caso que el gate existe para atajar", () => {
  const v = verificarBump("0.2.0", "0.2.0");
  assert.equal(v.ok, false);
  assert.match(v.motivo, /no sube la versión/);
});

test("bajar la versión falla", () => {
  const v = verificarBump("0.3.0", "0.2.0");
  assert.equal(v.ok, false);
  assert.match(v.motivo, /ANTERIOR/);
});

test("una versión con forma inválida falla con el texto que la causó", () => {
  const v = verificarBump("0.1.0", "0.2");
  assert.equal(v.ok, false);
  assert.match(v.motivo, /"0\.2"/);
});

test("clasificar el salto: un escalón limpio de cada tipo", () => {
  assert.equal(salto({ major: 0, minor: 1, patch: 0 }, { major: 0, minor: 1, patch: 1 }), "patch");
  assert.equal(salto({ major: 0, minor: 1, patch: 5 }, { major: 0, minor: 2, patch: 0 }), "minor");
  assert.equal(salto({ major: 0, minor: 9, patch: 2 }, { major: 1, minor: 0, patch: 0 }), "major");
});

test("un salto irregular pasa pero lo dice", () => {
  // 0.1.0 → 0.3.0 sube, así que no bloquea. Pero es la firma de un typo
  // (quisiste 0.2.0), y callarlo sería peor que avisar de más.
  const v = verificarBump("0.1.0", "0.3.0");
  assert.equal(v.ok, true);
  assert.match(v.motivo, /no es un escalón limpio/);
});

test("un minor que no resetea el patch es irregular", () => {
  assert.equal(salto({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 3, patch: 4 }), "irregular");
});
