/**
 * La costura del PDF, por Playwright.
 *
 * Recibe una URL, no un componente. En producción el PDF NO sale de acá: sale
 * de `functions/cv.pdf.ts`, que le pide el mismo render a Browser Rendering.
 * Este archivo queda como la herramienta de verificación —es lo que produce el
 * `dist/cv.pdf` contra el que corre `pnpm run test:pdf` antes de deployar— y
 * como la forma de mirar el PDF en local sin depender de la red de nadie.
 *
 * Las opciones de impresión NO viven acá: viven en `scripts/pdf-options.ts`,
 * compartidas con la Function. Ver el porqué en ese archivo.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { OPCIONES_PDF } from "./pdf-options";

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

    const buffer = await page.pdf({ ...OPCIONES_PDF });

    if (out) await writeFile(out, buffer);
    return buffer;
  } finally {
    await browser.close();
  }
}
