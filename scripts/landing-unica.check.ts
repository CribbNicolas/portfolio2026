/**
 * La landing es la única puerta.
 *
 * `/cv` sigue existiendo porque `build-pdf.ts` la imprime, pero dejó de ser un
 * destino: sin links entrantes y sin indexar. Eso es una decisión de UX que se
 * desarma sola —alguien agrega un link "ver CV completo" y nadie se entera— si
 * no hay algo que la sostenga. Esto es ese algo.
 *
 * Además verifica que la sección CV de la landing no se desincronice del PDF:
 * las dos páginas renderizan los mismos componentes, pero con superficies
 * distintas la cantidad de logros dejaría de coincidir en silencio.
 *
 * El nombre NO termina en `.test.ts` a propósito: necesita un build previo.
 * Mismo motivo que `no-client-js.check.ts` y `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";
const landing = await readFile(join(DIST, "index.html"), "utf8");
const cv = await readFile(join(DIST, "cv", "index.html"), "utf8");

test("la landing no linkea `/cv`", () => {
  // Solo la ruta exacta: `/cv.pdf` y `/cv.json` son destinos legítimos y tienen
  // que seguir funcionando.
  const links = [...landing.matchAll(/href="(\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    links, [],
    "la landing volvió a linkear /cv. Esa ruta existe solo para imprimir el " +
    "PDF: el destino del lector es el ancla #cv.",
  );
});

test("`/cv` no se indexa", () => {
  assert.match(
    cv,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/cv sin noindex: Google la va a indexar y el lector va a caer en una " +
    "página suelta, sin mapa y sin proyectos.",
  );
});

test("la landing tiene las tres anclas del índice", () => {
  for (const id of ["mapa", "proyectos", "cv"]) {
    assert.match(landing, new RegExp(`id="${id}"`), `falta la sección #${id}`);
    assert.ok(landing.includes(`href="#${id}"`), `el índice no apunta a #${id}`);
  }
});

test("la sección CV de la landing no se desincronizó del PDF", () => {
  // `#cv` es la ÚLTIMA sección de la landing, así que todo lo que viene después
  // del marcador es el CV. El botón flotante que le sigue no aporta `<li>`.
  const inicio = landing.indexOf('id="cv"');
  assert.ok(inicio > 0, "no se encontró la sección #cv en la landing");
  const cola = landing.slice(inicio);

  const roles = (html: string) => (html.match(/class="role"/g) ?? []).length;
  // Los logros son `<li>` sin clase propia: `RoleBlock` los mete en un
  // `<ul class="role__bullets">`. Contar `<li>` sobre la cola alcanza.
  const logros = (html: string) => (html.match(/<li[ >]/g) ?? []).length;

  assert.ok(roles(cv) > 0, "`class=\"role\"` ya no existe: actualizá este test");
  assert.equal(
    roles(cola), roles(cv),
    `la landing muestra ${roles(cola)} roles y /cv ${roles(cv)}`,
  );
  assert.equal(
    logros(cola), logros(cv),
    `la landing muestra ${logros(cola)} logros y /cv ${logros(cv)}. ` +
    `Regla 7: \`portfolio\` no topea logros por rol y \`cv-ats\` topea en 5 — ` +
    `alguien cambió la superficie de una de las dos páginas.`,
  );
});

test("la landing NO repite el encabezado del CV", () => {
  // `Header.astro` emite `<h1 class="cv__name">`. El hero de la landing ya
  // tiene su `<h1>`, y dos en una página rompen el orden para un lector de
  // pantalla. La landing arranca su CV en "Perfil".
  assert.ok(!landing.includes("cv__name"), "la landing renderizó <Header> del CV");
  assert.ok(cv.includes("cv__name"), "/cv perdió su <Header>: el PDF necesita el nombre arriba");
});
