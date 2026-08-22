/**
 * Presupuesto de bytes del mapa de la home.
 *
 * La afirmación que este archivo defiende no es "three es liviano" —no lo es,
 * son 127 KB gzip— sino que **está fuera del camino crítico**. Sin este check
 * eso es una promesa: alcanza con que alguien agregue un import estático a
 * `grafo-3d` para que Rollup hoistee three al bundle inicial, y nada avisa.
 *
 * Los umbrales salen de la primera medición verde más margen. Cuando uno falla,
 * el mensaje dice el valor medido, el techo y qué mirar.
 *
 * El nombre NO termina en `.test.ts` a propósito: necesita un build previo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

import { content, buildKnowledgeGraph } from "../content/source/index";

const DIST = "dist";
const ASTRO = join(DIST, "_astro");
const HOME = join(DIST, "index.html");

/** Lo que la home ejecuta antes de decidir si vale la pena cargar el 3D. */
const TECHO_CRITICO_KB = 4;
/** El chunk diferido con three adentro. Medido: 127 KB. */
const TECHO_DIFERIDO_KB = 150;
/** El campo del fondo: WebGL a mano, sin librería. Medido: 1.9 KB. */
const TECHO_CAMPO_KB = 8;
/** El HTML de la home lleva las coordenadas del grafo adentro. */
const TECHO_HTML_KB = 30;

const kb = (b: Buffer): number => Math.round((gzipSync(b).length / 1024) * 10) / 10;

const html = await readFile(HOME, "utf8");
const chunks = (await readdir(ASTRO)).filter((f) => f.endsWith(".js"));

const leer = async (f: string) => readFile(join(ASTRO, f));

/** Los que la home carga de entrada: el `<script src>` del boot. */
const criticos = [...html.matchAll(/<script[^>]*\ssrc=["']\/_astro\/([^"']+)["']/g)].map((m) => m[1]!);

test("el camino crítico de la home es solo el bootstrap", async () => {
  let total = 0;
  for (const f of criticos) total += kb(await leer(f));
  assert.ok(
    total <= TECHO_CRITICO_KB,
    `el JS crítico de la home pesa ${total} KB gzip, techo ${TECHO_CRITICO_KB} KB. ` +
    `Chunks: ${criticos.join(", ")}. Probablemente entró un import estático que debía ser dinámico.`,
  );
});

test("three NO está en el camino crítico", async () => {
  // La afirmación central. Si un import estático hoistea el chunk, esto lo caza.
  for (const f of criticos) {
    const src = (await leer(f)).toString("utf8");
    assert.ok(
      !src.includes("WebGLRenderer"),
      `three quedó dentro del chunk crítico ${f}. Revisá que nadie importe ` +
      `\`grafo-3d\` de forma estática: alcanza un \`import\` de tipo sin \`type\`.`,
    );
  }
});

test("el chunk de three existe como archivo aparte y entra en presupuesto", async () => {
  const conThree: string[] = [];
  for (const f of chunks) {
    if ((await leer(f)).toString("utf8").includes("WebGLRenderer")) conThree.push(f);
  }
  assert.equal(conThree.length, 1, `se esperaba 1 chunk con three, hay ${conThree.length}: ${conThree.join(", ")}`);
  assert.ok(!criticos.includes(conThree[0]!), "el chunk de three es también un chunk crítico");

  const peso = kb(await leer(conThree[0]!));
  assert.ok(
    peso <= TECHO_DIFERIDO_KB,
    `el chunk 3D pesa ${peso} KB gzip, techo ${TECHO_DIFERIDO_KB} KB. ` +
    `Revisá que no haya entrado nada de \`three/examples\` ni postprocesado.`,
  );
});

test("el campo del fondo no arrastró una librería", async () => {
  const campo = chunks.find((f) => f.startsWith("campo."));
  assert.ok(campo, `no se encontró el chunk del campo entre: ${chunks.join(", ")}`);
  const peso = kb(await leer(campo));
  assert.ok(
    peso <= TECHO_CAMPO_KB,
    `el chunk del campo pesa ${peso} KB gzip, techo ${TECHO_CAMPO_KB} KB. ` +
    `Es WebGL a mano: si creció así, entró una dependencia que no debería.`,
  );
});

test("ningún chunk se llevó zod ni el dataset al browser", async () => {
  // Un solo `import ... from "@content"` en código de cliente arrastra los dos:
  // `json-source.ts` los importa de forma estática.
  const view = await content.getView("portfolio", "es");
  for (const f of chunks) {
    const src = (await leer(f)).toString("utf8");
    assert.ok(!src.includes("ZodObject"), `zod terminó en el bundle ${f} — alguien importó \`@content\` desde cliente`);
    assert.ok(
      !src.includes(view.identity.fullName),
      `el dataset terminó en el bundle ${f} — alguien importó \`@content\` desde cliente`,
    );
  }
});

test("el HTML de la home entra en presupuesto", () => {
  const peso = kb(Buffer.from(html, "utf8"));
  assert.ok(peso <= TECHO_HTML_KB, `la home pesa ${peso} KB gzip de HTML, techo ${TECHO_HTML_KB} KB.`);
});

test("el fallback SVG tiene un nodo por cada nodo del grafo", async () => {
  // Impide que el SVG se atrofie sin que nadie lo note: si el 3D pasa a ser el
  // único camino real, el requisito de degradar sin JS deja de cumplirse en
  // silencio. Se compara contra la derivación, no contra un número escrito.
  const view = await content.getView("portfolio", "es");
  const esperado = buildKnowledgeGraph(view).nodes.length;
  const dibujados = [...html.matchAll(/class="lab__nodo/g)].length;
  assert.equal(
    dibujados, esperado,
    `el SVG dibuja ${dibujados} nodos y el grafo tiene ${esperado}.`,
  );
});

test("el mapa reparte el gesto táctil con el browser, no lo intercepta", async () => {
  // `touch-action: pan-y` es lo que hace que deslizar vertical scrollee la
  // página y horizontal rote el mapa. Sin esto, arrastrar en un teléfono
  // secuestraría el scroll — que es justo lo que el spec §3.4 prohíbe.
  const hojas = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const fuentes = [html, ...(await Promise.all(hojas.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));
  const ok = fuentes.some((src) => /\.lab__mapa--3d\{[^}]*touch-action:pan-y/.test(src));
  assert.ok(ok, "falta `touch-action: pan-y` en .lab__mapa--3d: el arrastre podría secuestrar el scroll");
});

test("ningún módulo de cliente escucha wheel ni touchmove", async () => {
  // El scroll queda en manos del browser por construcción. Un listener de
  // `wheel` o `touchmove` es la puerta de entrada al scroll hijacking, así que
  // se prohíbe la puerta, no el abuso.
  for (const f of chunks) {
    const src = (await leer(f)).toString("utf8");
    for (const evento of ["wheel", "touchmove"]) {
      assert.ok(
        !src.includes(`"${evento}"`) && !src.includes(`'${evento}'`),
        `el chunk ${f} registra un listener de \`${evento}\`. El puntero y el scroll se leen de forma pasiva.`,
      );
    }
  }
});

test("los canvas no pueden capturar el puntero", async () => {
  // `pointer-events: none` es lo que hace que clicks y scroll pasen de largo.
  // Es una regla de CSS, así que se verifica en lo EMITIDO, no en la intención.
  //
  // Se busca en el HTML y en los .css: Astro inlinea las hojas chicas en la
  // página, así que mirar solo `_astro/*.css` daría un falso negativo.
  const hojas = (await readdir(ASTRO)).filter((f) => f.endsWith(".css"));
  const fuentes = [html, ...(await Promise.all(hojas.map((f) => readFile(join(ASTRO, f), "utf8"))))]
    .map((s) => s.replace(/\s+/g, ""));

  for (const clase of ["lab__canvas", "lab__campo"]) {
    const encontrado = fuentes.some((src) =>
      new RegExp(`\\.${clase}\\{[^}]*pointer-events:none`).test(src),
    );
    assert.ok(encontrado, `no se encontró \`pointer-events: none\` sobre .${clase} en lo emitido`);
  }
});
