/**
 * Política de JavaScript de cliente, página por página, sobre TODO `dist/`.
 *
 * Reemplaza al criterio viejo (`grep -c "<script" dist/cv/index.html`), que
 * tenía dos problemas: nunca se automatizó —vivía como fila de una tabla en un
 * doc— y contaba lo que no alcanza. Astro puede meter JS en una página sin
 * emitir un `<script src>` que ese grep matchee: `<link rel="modulepreload">`,
 * `prefetch`, o un `<ClientRouter/>` en el layout. Y al revés: el
 * `<script type="application/json">` del grafo en /lab matchearía el grep sin
 * ser código ejecutable.
 *
 * Por qué importa blindar /cv en particular: el PDF se renderiza desde ahí con
 * Playwright esperando `networkidle`. Un script que se cuele cambia el render
 * del PDF en silencio.
 *
 * El nombre NO termina en `.test.ts` a propósito: necesita un build previo.
 * Mismo motivo que `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const DIST = "dist";

/**
 * Las ÚNICAS páginas que pueden enviar JavaScript. Agregar una es una decisión
 * explícita en un diff, no un accidente que nadie nota.
 */
const PAGINAS_CON_JS = new Set(["index.html"]);

/** Tipos de `<script>` que NO son código: son datos para crawlers y agentes. */
const TIPOS_DE_DATOS = new Set(["application/ld+json", "application/json"]);

async function htmls(dir: string): Promise<string[]> {
  const salida: string[] = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await htmls(p)));
    else if (entrada.name.endsWith(".html")) salida.push(p);
  }
  return salida;
}

const paginas = await htmls(DIST);

test("hay páginas que verificar (el build corrió)", () => {
  assert.ok(paginas.length > 0, `no se encontró ningún .html en ${DIST}/ — ¿corriste el build?`);
});

for (const archivo of paginas) {
  const ruta = relative(DIST, archivo).split(sep).join("/");
  const html = await readFile(archivo, "utf8");
  const permitida = PAGINAS_CON_JS.has(ruta);

  test(`${ruta}: todo <script> sin src es de datos, no de código`, () => {
    for (const m of html.matchAll(/<script([^>]*)>/g)) {
      const attrs = m[1] ?? "";
      if (/\ssrc=/.test(attrs)) continue;
      const tipo = /type=["']([^"']+)["']/.exec(attrs)?.[1];
      assert.ok(
        tipo && TIPOS_DE_DATOS.has(tipo),
        `${ruta} tiene un <script${attrs}> ejecutable inline. ` +
        `Solo se admiten ${[...TIPOS_DE_DATOS].join(" y ")}.`,
      );
    }
  });

  if (permitida) continue;

  test(`${ruta}: no carga ningún script externo`, () => {
    const externos = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
    assert.deepEqual(
      externos, [],
      `${ruta} no puede cargar JS. Si es a propósito, agregala a PAGINAS_CON_JS y decí por qué.`,
    );
  });

  test(`${ruta}: sin modulepreload ni prefetch`, () => {
    // Son las vías por las que Astro inyecta JS sin emitir un <script src>.
    const preloads = [...html.matchAll(/<link[^>]*rel=["'](modulepreload|prefetch)["'][^>]*>/g)];
    assert.equal(
      preloads.length, 0,
      `${ruta} tiene ${preloads.length} link(s) de precarga de módulos. ` +
      `Revisá si se activó \`prefetch\` o \`experimental.clientPrerender\` en astro.config.mjs.`,
    );
  });

  test(`${ruta}: no referencia bundles de /_astro/`, () => {
    const refs = [...html.matchAll(/["'](\/_astro\/[^"']+\.js)["']/g)].map((m) => m[1]);
    assert.deepEqual(refs, [], `${ruta} referencia bundles JS: ${refs.join(", ")}`);
  });
}

test("la analítica vive SOLO en la landing", async () => {
  // Los tests de arriba ya lo cubren de rebote: Clarity en `Base.astro` haría
  // que `/cv` emitiera un `<script src>` y varios fallarían. Pero fallarían
  // diciendo "cv/index.html no puede cargar JS", y quien lea eso va a buscar el
  // problema en el mapa, no en la analítica.
  //
  // Esto nombra el riesgo: `/cv` es de donde Browser Rendering imprime el PDF,
  // y un script de terceros ahí cambia el render en producción sin que ningún
  // test del PDF lo note — el texto extraído sigue siendo el mismo.
  const culpables: string[] = [];
  for (const archivo of paginas) {
    const ruta = relative(DIST, archivo).split(sep).join("/");
    if (ruta === "index.html") continue;
    if (/clarity/i.test(await readFile(archivo, "utf8"))) culpables.push(ruta);
  }
  assert.deepEqual(
    culpables,
    [],
    `Clarity llegó a ${culpables.join(", ")}. Va SOLO en index.astro: si se ` +
      "movió a Base.astro, /cv dejó de estar en cero JS y el PDF se imprime desde ahí.",
  );
});
