/**
 * The PDF seam, via Playwright.
 *
 * It takes a URL, not a component. In production the PDF does NOT come from
 * here: it comes from `functions/cv.pdf.ts`, which asks Browser Rendering for
 * the same render. This file remains the verification tool — it is what
 * produces the `dist/cv.pdf` that `pnpm run test:pdf` runs against before
 * deploying — and the way to look at the PDF locally without depending on
 * anybody's network.
 *
 * The print options do NOT live here: they live in `scripts/pdf-options.ts`,
 * shared with the Function. See that file for why.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PDF_OPTIONS } from "./pdf-options";

export interface RenderPdfOptions {
  url: string;
  /** When given, the Buffer is also written to disk. */
  out?: string;
}

export async function renderPdf({ url, out }: RenderPdfOptions): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    // Without this, Chromium can print with the fallback font and the PDF comes
    // out different on every machine.
    await page.evaluate(() => document.fonts.ready);

    const buffer = await page.pdf({ ...PDF_OPTIONS });

    if (out) await writeFile(out, buffer);
    return buffer;
  } finally {
    await browser.close();
  }
}
