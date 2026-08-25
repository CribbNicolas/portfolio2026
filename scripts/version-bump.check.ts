/**
 * Gate: un merge a `staging` tiene que subir la versión de `package.json`.
 *
 * `package.json` es la ÚNICA fuente de verdad del versionado (docs/08). Esa
 * afirmación solo vale si el número cambia cuando cambia lo publicado, y eso no
 * se sostiene con disciplina: se sostiene con un check que rompe el PR.
 *
 * El bump se hace A MANO, en el mismo PR. Elegir entre patch, minor y major es
 * una decisión semántica sobre qué cambió para quien consume el sitio, y una
 * máquina que mira diffs no la puede tomar bien. Lo que sí puede la máquina es
 * no dejar que te lo olvides.
 *
 * No es `*.test.ts`: necesita el repo git con la rama base disponible, así que
 * no puede correr en el `pnpm test` de cualquiera. La lógica pura que sí puede
 * vive en `version.ts` y se testea en `version.test.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { verificarBump } from "./version";

/**
 * La rama contra la que se compara. En CI la pone el workflow desde
 * `github.base_ref`; en local el default sirve para chequear antes de abrir
 * el PR.
 */
const BASE = process.env.VERSION_BASE_REF ?? "origin/staging";

function versionDe(json: string): string {
  const v = JSON.parse(json).version;
  assert.equal(typeof v, "string", "package.json no declara una version");
  return v;
}

function versionEnLaBase(): string {
  try {
    const json = execFileSync("git", ["show", `${BASE}:package.json`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return versionDe(json);
  } catch (e) {
    // El modo de falla más probable no es un bug del check: es que la rama base
    // no esté fetcheada. Decirlo con el comando exacto ahorra el rato de mirar
    // el código del check buscando un error que no está ahí.
    throw new Error(
      `no se pudo leer package.json de "${BASE}".\n` +
        `  Si estás en local: git fetch origin ${BASE.replace(/^origin\//, "")}\n` +
        `  Causa original: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

test("el merge sube la versión de package.json", () => {
  const base = versionEnLaBase();
  const nueva = versionDe(readFileSync("package.json", "utf8"));

  const { ok, motivo } = verificarBump(base, nueva);
  // Se imprime pase o falle: cuando pasa, el log del PR queda diciendo qué
  // versión se está publicando, que es justo lo que uno quiere ver ahí.
  console.log(`versión: ${motivo}`);
  assert.ok(ok, motivo);
});
