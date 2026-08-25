/**
 * Las opciones de impresión del CV. UNA sola definición.
 *
 * Las consumen dos caminos que tienen que producir el MISMO PDF:
 *  - `scripts/render-pdf.ts` (Playwright, local y CI) — el que verifica `test:pdf`.
 *  - `functions/cv.pdf.ts` (Browser Rendering, producción) — el que baja la gente.
 *
 * Si vivieran en dos archivos, el PDF testeado y el PDF servido divergirían el
 * día que alguien tocara uno solo, y el test seguiría en verde. Los nombres de
 * campo coinciden porque los dos lados terminan en la misma API de Chromium: el
 * `page.pdf()` de Playwright y el `pdfOptions` de Browser Rendering son el mismo
 * contrato de Chrome DevTools Protocol.
 */

export const OPCIONES_PDF = {
  format: "a4",
  printBackground: true,
  // El @page del CSS manda sobre estas opciones: los márgenes viven con el
  // layout, no repartidos entre CSS y script.
  preferCSSPageSize: true,
  // PDF accesible: deja el orden de lectura explícito adentro del archivo en
  // vez de que el parser lo deduzca de las coordenadas.
  //
  // `pdf-output.check.ts` lo verifica con `getMarkInfo()`/`getOutline()`. Ese
  // test corre sobre los DOS caminos —el local y el servido—, así que si
  // Browser Rendering dejara de aceptar estas dos claves, el smoke post-deploy
  // se pone en rojo en vez de degradar en silencio. Esa es la red.
  tagged: true,
  outline: true,
  // Los headers y footers de Chrome rompen el parseo (docs/01 §1).
  displayHeaderFooter: false,
} as const;

/**
 * `networkidle0` y no `networkidle`: son dos APIs distintas con el mismo
 * espíritu. Playwright llama `networkidle` a "cero conexiones por 500 ms";
 * Puppeteer —que es lo que corre atrás de Browser Rendering— lo llama
 * `networkidle0`. La condición es la misma, el nombre no.
 */
export const ESPERA_CARGA = "networkidle0" as const;
