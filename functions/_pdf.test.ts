/**
 * Tests de las piezas puras de `/cv.pdf`.
 *
 * No levantan un Worker a propósito: lo que se puede romper en silencio acá es
 * el CUERPO que se le manda a Browser Rendering (que el PDF servido deje de
 * pedir las mismas opciones que el PDF testeado) y la clave de caché (que cada
 * `?utm_source=` gaste un render). Las dos cosas se verifican sin red.
 *
 * Que el PDF resultante parsee lo verifica `pdf-output.check.ts`, que corre
 * contra los bytes reales — en local contra `dist/cv.pdf` y post-deploy contra
 * la URL publicada.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_OPTIONS, LOAD_WAIT } from "../scripts/pdf-options";
import {
  NOMBRE_POR_DEFECTO,
  RUTA_ORIGEN,
  SEGUNDOS_DE_CACHE,
  cabecerasPdf,
  claveDeCache,
  cuerpoPeticion,
  endpointBrowserRendering,
} from "./_pdf";

test("el cuerpo pide exactamente las mismas opciones que el PDF que se testea", () => {
  // Este es EL test del archivo. Si alguien toca las opciones de un solo lado,
  // el PDF que baja la gente deja de ser el PDF que pasó `test:pdf` y nadie se
  // entera. Por eso `pdf-options.ts` es una sola fuente y esto lo custodia.
  const cuerpo = JSON.parse(cuerpoPeticion("https://ejemplo.com"));
  assert.deepEqual(cuerpo.pdfOptions, PDF_OPTIONS);
  assert.equal(cuerpo.gotoOptions.waitUntil, LOAD_WAIT);
});

test("tagged y outline viajan en el pedido", () => {
  // Redundante con el test de arriba a propósito: si alguien decidiera sacar
  // `tagged` de `PDF_OPTIONS`, aquel test seguiría en verde (compara contra la
  // misma constante que cambió). Este falla, y el mensaje dice qué se perdió.
  const { pdfOptions } = JSON.parse(cuerpoPeticion("https://ejemplo.com"));
  assert.equal(pdfOptions.tagged, true, "sin tagged el PDF pierde el orden de lectura explícito");
  assert.equal(pdfOptions.outline, true, "sin outline el PDF no tiene marcadores por sección");
});

test("se imprime /cv del MISMO origen que recibió el pedido", () => {
  // Un origen hardcodeado haría que el smoke de una preview testeara el PDF de
  // producción, que es justo el bug que el smoke existe para atajar.
  const { url } = JSON.parse(cuerpoPeticion("https://staging.portfolio2026.pages.dev"));
  assert.equal(url, `https://staging.portfolio2026.pages.dev${RUTA_ORIGEN}`);
});

test("el origen se respeta aunque venga con puerto o path", () => {
  const { url } = JSON.parse(cuerpoPeticion("http://127.0.0.1:8788"));
  assert.equal(url, `http://127.0.0.1:8788${RUTA_ORIGEN}`);
});

test("el endpoint apunta a la cuenta que se le pasa", () => {
  assert.equal(
    endpointBrowserRendering("abc123"),
    "https://api.cloudflare.com/client/v4/accounts/abc123/browser-rendering/pdf",
  );
});

test("la clave de caché descarta el query string", () => {
  // Sin esto, cada campaña con su propio `utm_` es un render pago por visitante
  // y el presupuesto diario se va en tráfico que pide el mismo archivo.
  const conQuery = claveDeCache("https://ejemplo.com/cv.pdf?utm_source=linkedin");
  const sinQuery = claveDeCache("https://ejemplo.com/cv.pdf");
  assert.equal(conQuery.url, sinQuery.url);
  assert.equal(conQuery.url, "https://ejemplo.com/cv.pdf");
});

test("la clave de caché descarta el fragmento", () => {
  const conHash = claveDeCache("https://ejemplo.com/cv.pdf#pagina2");
  assert.equal(conHash.url, "https://ejemplo.com/cv.pdf");
});

test("las cabeceras declaran PDF, nombre de archivo y TTL", () => {
  const h = cabecerasPdf("CV-Ejemplo.pdf");
  assert.equal(h.get("content-type"), "application/pdf");
  assert.equal(h.get("content-disposition"), 'inline; filename="CV-Ejemplo.pdf"');
  assert.equal(h.get("cache-control"), `public, max-age=${SEGUNDOS_DE_CACHE}`);
  assert.equal(h.get("x-content-type-options"), "nosniff");
});

test("el nombre por defecto es un .pdf", () => {
  // `content-disposition` con un nombre sin extensión hace que Windows guarde
  // un archivo que no abre con nada.
  assert.match(NOMBRE_POR_DEFECTO, /\.pdf$/);
});
