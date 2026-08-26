/**
 * La estructura del sitio: la landing es la única puerta, y las rutas rotas
 * avisan que están rotas.
 *
 * `/cv` sigue existiendo porque de ahí se imprime el PDF, pero dejó de ser un
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
import { accessSync, constants } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const DIST = "dist";
const landing = await readFile(join(DIST, "index.html"), "utf8");
const cv = await readFile(join(DIST, "cv", "index.html"), "utf8");

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
const contenidos = new Map<string, string>();
for (const archivo of paginas) contenidos.set(archivo, await readFile(archivo, "utf8"));

/**
 * El HTML sin las hojas de estilo inline.
 *
 * Un nombre de clase aparece dos veces en una página: en el `class=` del
 * marcado y en el selector del CSS. Astro decide inlinear una hoja o dejarla
 * externa según cómo le quede el chunking, así que un test que busque el nombre
 * en el archivo entero cambia de resultado cuando se agrega una página
 * cualquiera. Esto deja solo lo que el navegador dibuja.
 */
const marcado = (html: string): string => html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

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

test("NINGUNA página linkea `/cv`, no solo la landing", () => {
  // El test de arriba mira `index.html` porque cuando se escribió era la única
  // página que podía linkear algo. Desde que existe `404.astro` hay más de una,
  // y el invariante nunca fue "la landing no linkea /cv" sino "/cv no tiene
  // links entrantes". Esto cubre lo que la promesa siempre dijo.
  const culpables: string[] = [];
  for (const archivo of paginas) {
    const ruta = relative(DIST, archivo).split(sep).join("/");
    if ([...contenidos.get(archivo)!.matchAll(/href="(\/cv\/?)"/g)].length > 0) {
      culpables.push(ruta);
    }
  }
  assert.deepEqual(
    culpables,
    [],
    `estas páginas linkean /cv: ${culpables.join(", ")}. Esa ruta existe solo ` +
      "para imprimir el PDF; el destino del lector es el ancla #cv de la landing.",
  );
});

test("existe una página 404 propia", () => {
  // Sin `dist/404.html`, Cloudflare Pages devuelve 200 con HTML para cualquier
  // ruta inventada. Eso es un soft-404 y los crawlers lo penalizan (deuda
  // técnica §1, medido antes de arreglarlo). El archivo se genera solo desde
  // `src/pages/404.astro`: si alguien borra esa página, esto avisa.
  const rutas = paginas.map((a) => relative(DIST, a).split(sep).join("/"));
  assert.ok(
    rutas.includes("404.html"),
    `no hay 404.html en ${DIST}/. Sin él, una ruta inexistente devuelve 200 y ` +
      `el sitio vuelve al soft-404. Se genera desde src/pages/404.astro.`,
  );
});

test("solo la landing emite Open Graph", () => {
  // `compartible` es opt-in en `Base.astro`, pero eso solo evita el olvido en
  // una dirección: nada impide marcarla en `/cv`. Y ahí sería peor que un
  // descuido — esa página va con `noindex`, así que estaríamos pidiéndole al
  // crawler que no la indexe y ofreciéndole una tarjeta para compartirla.
  const conOg: string[] = [];
  for (const archivo of paginas) {
    const ruta = relative(DIST, archivo).split(sep).join("/");
    if (ruta === "index.html") continue;
    if (contenidos.get(archivo)!.includes('property="og:')) conOg.push(ruta);
  }
  assert.deepEqual(
    conOg,
    [],
    `estas páginas emiten Open Graph: ${conOg.join(", ")}. Solo la landing es ` +
      "compartible; /cv es noindex y el 404 no es un destino.",
  );

  assert.ok(
    landing.includes('property="og:title"'),
    "la landing dejó de emitir Open Graph: pegar el link vuelve a mostrar una URL pelada",
  );
});

test("el favicon y el sitemap existen de verdad", () => {
  // `Base.astro` linkea /favicon.svg en las tres páginas y robots.txt anuncia
  // el sitemap. Si los archivos no están, cada visita se lleva un 404 silencioso
  // y el sitemap anunciado no existe — peor que no anunciarlo.
  for (const archivo of ["favicon.svg", "sitemap-index.xml"]) {
    assert.doesNotThrow(
      () => accessSync(join(DIST, archivo), constants.F_OK),
      `falta ${DIST}/${archivo}, y algo lo referencia.`,
    );
  }
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
  //
  // Se mira el MARCADO, no el HTML entero. Buscar "cv__name" en todo el archivo
  // también matchea el SELECTOR dentro de un `<style>`, y Astro decide inlinear
  // o no una hoja según cómo le quede el chunking — o sea que el resultado del
  // test dependía de cuántas páginas tuviera el sitio. Se descubrió al agregar
  // `404.astro`: cv.css pasó de externo a inline y el test empezó a fallar sin
  // que la landing cambiara una línea.
  assert.ok(!marcado(landing).includes("cv__name"), "la landing renderizó <Header> del CV");
  assert.ok(
    marcado(cv).includes("cv__name"),
    "/cv perdió su <Header>: el PDF necesita el nombre arriba",
  );
});
