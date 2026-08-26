/**
 * Verificación del PDF generado. Esto es lo que convierte "el CV pasa el ATS"
 * de intención en test (invariante 7).
 *
 * El nombre NO termina en `.test.ts` a propósito: `pnpm test` descubre todos los
 * `*.test.ts` y correría este antes de que exista el PDF. Se corre aparte, con
 * `pnpm run test:pdf`, y contra dos fuentes distintas según `PDF_SOURCE` — ver
 * abajo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// El build `legacy` es el único que corre en Node (el principal necesita APIs
// del DOM que Node 20 no tiene). Ese subpath no expone types propios.
// @ts-ignore
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { content, formatRoleTitle } from "../content/source/index";

/**
 * De dónde salen los bytes que se verifican.
 *
 * Por defecto `dist/cv.pdf`, el que produce `pnpm run pdf:local` con Playwright:
 * ese es el gate PRE-deploy y no depende de la red de nadie.
 *
 * Con `PDF_SOURCE=https://…/cv.pdf` los MISMOS tests corren contra la URL
 * publicada. Eso es lo único que prueba que el PDF que sirve `functions/cv.pdf.ts`
 * pasa el ATS, y no solo el que produce tu máquina: son dos Chromium distintos
 * —Playwright local contra Browser Rendering— sobre el mismo layout, y la única
 * forma de saber que imprimen igual es medir los dos.
 */
const FUENTE = process.env.PDF_SOURCE ?? "dist/cv.pdf";

let crudo: Uint8Array | undefined;

/**
 * Los bytes del PDF, leídos UNA sola vez.
 *
 * Cada test llamaba a `readFile` por su cuenta, que con un archivo local es
 * gratis; contra una URL serían nueve requests —y nueve renders si el caché de
 * borde no acierta—. Devuelve una copia porque pdf.js se queda con el
 * `Uint8Array` que recibe: reusar el mismo lo deja vacío en el segundo test.
 */
async function cargar(): Promise<Uint8Array> {
  if (!crudo) {
    if (FUENTE.startsWith("http://") || FUENTE.startsWith("https://")) {
      const res = await fetch(FUENTE);
      // El 429 se distingue del resto a propósito: no dice "el PDF está roto",
      // dice "esperá". Es la cuota de Browser Rendering, y confundir las dos
      // cosas manda a depurar la Function cuando no hay nada que depurar.
      assert.ok(
        res.status !== 429,
        `${FUENTE} devolvió 429: es la cuota de Browser Rendering, no un fallo del PDF. ` +
          "El plan gratuito da 3 browsers concurrentes y una instancia nueva cada 20 s. " +
          "Esperá un minuto y repetí; si persiste, se agotaron los 10 min de browser del día.",
      );
      assert.ok(res.ok, `${FUENTE} devolvió ${res.status} ${res.statusText}`);
      // Un 200 con HTML es el síntoma de que la ruta no matcheó la Function y
      // Pages devolvió el sitio. Sin este chequeo el fallo sale como
      // "InvalidPDFException" y se busca en el lado equivocado.
      const tipo = res.headers.get("content-type") ?? "";
      assert.ok(
        tipo.includes("application/pdf"),
        `${FUENTE} devolvió content-type "${tipo}": esa ruta no está sirviendo un PDF`,
      );
      crudo = new Uint8Array(await res.arrayBuffer());
    } else {
      crudo = new Uint8Array(await readFile(FUENTE));
    }
  }
  return crudo.slice();
}

/** Texto del PDF en orden de extracción: exactamente lo que ve un parser. */
async function extraer(): Promise<{ texto: string; paginas: number }> {
  const doc = await getDocument({ data: await cargar() }).promise;

  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const contenido = await page.getTextContent();
    texto += contenido.items
      // La versión instalada de pdfjs-dist sí trae tipos para este subpath
      // (un `.d.mts` que reexporta desde el paquete principal), a diferencia
      // de lo que asumía el brief: el item puede ser `TextItem` (con `str`) o
      // `TextMarkedContent` (sin `str`), de ahí el chequeo con `in`.
      .map((item) => ("str" in item ? (item.str ?? "") : ""))
      .join(" ");
    texto += "\n";
  }
  return { texto, paginas: doc.numPages };
}

test("capa 1: el PDF tiene texto extraíble, no es una imagen", async () => {
  const { texto } = await extraer();
  assert.ok(
    texto.trim().length > 500,
    `el texto extraído tiene ${texto.trim().length} caracteres; un PDF exportado como imagen se descarta entero en la capa 1`,
  );
});

test("capa 1: el parser encuentra nombre, título y todas las empresas", async () => {
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");

  const normal = texto.replace(/\s+/g, " ");
  assert.ok(normal.includes(view.identity.fullName), "falta el nombre completo");
  assert.ok(normal.includes(view.identity.searchTitle), "falta el searchTitle");

  for (const role of view.experience) {
    assert.ok(
      normal.includes(role.company),
      `falta la empresa "${role.company}" en el texto extraído`,
    );
  }
});

test("capa 1: el orden de extracción es sano (nombre antes que el primer rol)", async () => {
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");
  const normal = texto.replace(/\s+/g, " ");

  const posNombre = normal.indexOf(view.identity.fullName);
  const posPrimerRol = normal.indexOf(view.experience[0].company);
  assert.ok(
    posNombre >= 0 && posNombre < posPrimerRol,
    "el nombre no aparece antes del primer rol: el orden de lectura está roto",
  );
});

test("el CV no excede 2 páginas", async () => {
  const { paginas } = await extraer();
  assert.ok(paginas <= 2, `el PDF tiene ${paginas} páginas; el máximo es 2 (docs/03 §2)`);
});

test("ningún TODO del dataset llegó al PDF", async () => {
  const { texto } = await extraer();
  assert.ok(
    !texto.includes("TODO"),
    "hay un TODO en el PDF: o se completa el dato o se deja de renderizar ese campo",
  );
});

test("capa 1: los nombres de sección estándar se extraen enteros", async () => {
  // Un parser mapea estos títulos a campos. Si el CSS los separa en glifos
  // sueltos ("P E R F I L"), el PDF se ve bien y no lo lee nadie.
  const { texto } = await extraer();
  const normal = texto.replace(/\s+/g, " ");

  for (const seccion of ["Perfil", "Habilidades", "Experiencia", "Educación", "Idiomas"]) {
    assert.match(
      normal,
      new RegExp(seccion, "i"),
      `la sección "${seccion}" no aparece contigua en el texto extraído`,
    );
  }
});

test("capa 1: los títulos de rol y los bullets se extraen enteros", async () => {
  // formatRoleTitle y text.short son el contenido que de verdad se lee. Si el
  // CSS los parte en glifos sueltos, el PDF se ve bien y no dice nada.
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");
  const normal = texto.replace(/\s+/g, " ");

  for (const role of view.experience) {
    const titulo = formatRoleTitle(role);
    assert.ok(
      normal.includes(titulo),
      `el título de rol "${titulo}" no aparece contiguo en el texto extraído`,
    );
    for (const a of role.achievements) {
      // Los primeros 40 caracteres alcanzan: si el bullet se partió, ya falla ahí.
      const inicio = a.text.short.slice(0, 40);
      assert.ok(
        normal.includes(inicio),
        `el bullet "${inicio}..." no aparece contiguo en el texto extraído`,
      );
    }
  }
});

test("el PDF sale tagged y con outline, como se prometió", async () => {
  // `tagged: true` y `outline: true` son opciones explícitas de renderPdf. Sin
  // esto, si Chrome dejara de honrarlas nadie se enteraría.
  const doc = await getDocument({ data: await cargar() }).promise;

  const markInfo = await doc.getMarkInfo();
  assert.ok(markInfo?.Marked, "el PDF no está tagged: se pierde el orden de lectura explícito");

  const outline = await doc.getOutline();
  assert.ok(outline && outline.length > 0, "el PDF no tiene outline (marcadores por sección)");
});

test("capa 1: el email y los links se extraen enteros", async () => {
  // Una URL partida por un salto de línea se extrae con un espacio adentro y
  // deja de ser una URL. Es el campo que un ATS usa para encontrar el perfil.
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");
  const normal = texto.replace(/\s+/g, " ");

  assert.ok(
    normal.includes(view.identity.contact.email),
    `el email no aparece contiguo en el texto extraído`,
  );
  for (const link of view.identity.links) {
    assert.ok(
      normal.includes(link.url),
      `la URL de ${link.label} (${link.url}) no aparece contigua en el texto extraído`,
    );
  }
});

test("regla 8: ni el teléfono ni la dirección salen en el PDF", async () => {
  const { texto } = await extraer();
  const data = await content.getDataset("es");
  const normal = texto.replace(/\s+/g, " ");

  if (data.identity.contact.phone) {
    assert.ok(!normal.includes(data.identity.contact.phone), "el teléfono salió en el PDF");
  }
  if (data.identity.location.streetAddress) {
    assert.ok(
      !normal.includes(data.identity.location.streetAddress),
      "la dirección de calle salió en el PDF",
    );
  }
});
