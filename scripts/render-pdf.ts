/**
 * La costura del PDF.
 *
 * Recibe una URL, no un componente. Hoy la URL es `dist/` servido en localhost;
 * el día que exista una ruta SSR que arme un CV por aviso, esa ruta se le pasa
 * acá y este archivo no cambia una línea. Ese es todo el motivo de que la firma
 * sea así.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

export interface RenderPdfOptions {
  url: string;
  /** Si se pasa, además de devolver el Buffer lo escribe en disco. */
  out?: string;
}

export async function renderPdf({ url, out }: RenderPdfOptions): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    // Sin esto, Chromium puede imprimir con la fuente de fallback y el PDF
    // sale distinto en cada máquina.
    await page.evaluate(() => document.fonts.ready);

    const buffer = await page.pdf({
      format: "a4",
      printBackground: true,
      // El @page del CSS manda sobre estas opciones: los márgenes viven con el
      // layout, no repartidos entre CSS y script.
      preferCSSPageSize: true,
      // PDF accesible: deja el orden de lectura explícito adentro del archivo
      // en vez de que el parser lo deduzca de las coordenadas.
      tagged: true,
      outline: true,
      // Los headers y footers de Chrome rompen el parseo (docs/01 §1).
      displayHeaderFooter: false,
    });

    if (out) await writeFile(out, buffer);
    return buffer;
  } finally {
    await browser.close();
  }
}
