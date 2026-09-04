/**
 * The CV print options. ONE definition.
 *
 * Two paths consume them, and both have to produce the SAME PDF:
 *  - `scripts/render-pdf.ts` (Playwright, local and CI) — the one `test:pdf` checks.
 *  - `functions/cv.pdf.ts` (Browser Rendering, production) — the one people download.
 *
 * If they lived in two files, the tested PDF and the served PDF would diverge
 * the day someone touched only one, and the test would stay green. The field
 * names match because both sides end up in the same Chromium API: Playwright's
 * `page.pdf()` and Browser Rendering's `pdfOptions` are the same Chrome
 * DevTools Protocol contract.
 */

export const PDF_OPTIONS = {
  format: "a4",
  printBackground: true,
  // The CSS @page wins over these options: the margins live with the layout,
  // not split between CSS and script.
  preferCSSPageSize: true,
  // Accessible PDF: it makes the reading order explicit inside the file rather
  // than having the parser deduce it from coordinates.
  //
  // `pdf-output.check.ts` verifies it with `getMarkInfo()`/`getOutline()`. That
  // test runs over BOTH paths — local and served — so if Browser Rendering ever
  // stopped accepting these two keys, the post-deploy smoke goes red instead of
  // degrading silently. That is the safety net.
  tagged: true,
  outline: true,
  // Chrome's headers and footers break parsing (docs/01 §1).
  displayHeaderFooter: false,
} as const;

/**
 * `networkidle0` and not `networkidle`: two different APIs with the same
 * spirit. Playwright calls "zero connections for 500 ms" `networkidle`;
 * Puppeteer — what runs behind Browser Rendering — calls it `networkidle0`. The
 * condition is the same, the name is not.
 */
export const LOAD_WAIT = "networkidle0" as const;
