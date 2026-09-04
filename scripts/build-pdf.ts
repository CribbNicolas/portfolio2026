/**
 * Serves `dist/` and asks Chromium to print `/cv` and `/en/cv` into
 * `dist/cv.pdf` and `dist/en/cv.pdf`.
 *
 * It is NO LONGER part of `pnpm run build`. The production PDFs are generated
 * by `functions/cv.pdf.ts` / `functions/en/cv.pdf.ts` on demand; this exists
 * for two things: looking at either PDF locally without deploying, and
 * producing the files `pnpm run test:pdf` runs against BEFORE anything is
 * published. It is the pre-deploy gate, not the generator of the deliverable.
 *
 * It is served over HTTP and not `file://` because the absolute asset paths
 * (`/_astro/...`) do not resolve from the filesystem, and the PDF would come
 * out with no fonts and no styles.
 *
 * The server is 30 lines on purpose: adding a dependency for this would be more
 * maintenance surface than the problem it solves.
 */

import { createServer } from "node:http";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { renderPdf } from "./render-pdf";

const DIST = "dist";

/**
 * One entry per locale: the page it prints and where the two copies of the
 * result land. `OUT` is what `pdf-output.check.ts` reads by default (Spanish)
 * or via `PDF_SOURCE`/`PDF_LOCALE` (either). `OUT_DEV` is so `astro dev` can
 * serve the PDF the same way it serves `/og.jpg` — `astro dev` does not run
 * Pages Functions, see `astro.config.mjs`'s `localCvPdf`.
 */
const TARGETS = [
  { path: "/cv", out: join(DIST, "cv.pdf"), outDev: join("public", "cv.pdf") },
  { path: "/en/cv", out: join(DIST, "en", "cv.pdf"), outDev: join("public", "en", "cv.pdf") },
] as const;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  // normalize() strips any `..`: the server never leaves dist/.
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const candidates = [join(DIST, path), join(DIST, path, "index.html")];

  for (const file of candidates) {
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
      return;
    } catch {
      // Try the next candidate.
    }
  }

  res.writeHead(404).end("not found");
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as { port: number };

try {
  for (const { path, out, outDev } of TARGETS) {
    await renderPdf({ url: `http://127.0.0.1:${port}${path}`, out });
    await mkdir(dirname(outDev), { recursive: true });
    await copyFile(out, outDev);
    console.log(`PDF written to ${out} and ${outDev}`);
  }
} finally {
  server.close();
}
