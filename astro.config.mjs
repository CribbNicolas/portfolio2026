import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// `site` has to be absolute: the JSON-LD and the canonical need it, and crawlers
// do not resolve relative paths. The .invalid TLD is reserved by RFC 2606, so if
// somebody deploys without setting SITE_URL it breaks visibly instead of
// publishing a wrong URL that looks fine.
const SITE = process.env.SITE_URL ?? "https://portfolio.invalid";

/**
 * `astro dev` does not run Pages Functions, so `/cv.pdf` 404s and the download
 * button saves the HTML 404 under a .pdf name. Serve the file `pdf:local`
 * already wrote. Production is unchanged: `functions/cv.pdf.ts` owns the route.
 */
function localCvPdf() {
  const candidates = [
    join(process.cwd(), "public", "cv.pdf"),
    join(process.cwd(), "dist", "cv.pdf"),
  ];
  const filename = "Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf";
  return {
    name: "local-cv-pdf",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url ?? "").split("?")[0] !== "/cv.pdf") {
          next();
          return;
        }
        let body;
        for (const file of candidates) {
          try {
            body = await readFile(file);
            break;
          } catch {
            // Try the next place `pdf:local` writes.
          }
        }
        if (!body) {
          res.statusCode = 503;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(
            "El PDF local se genera con `pnpm run build` y `pnpm run pdf:local`.\nEn producción /cv.pdf lo sirve la Function.\n",
          );
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-length", String(body.length));
        res.setHeader("content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("x-content-type-options", "nosniff");
        // Chrome's download manager may HEAD first. A body on HEAD makes it
        // report the file as missing.
        res.end(req.method === "HEAD" ? undefined : body);
      });
    },
  };
}

export default defineConfig({
  site: SITE,
  output: "static",
  build: { format: "directory" },
  vite: {
    plugins: [localCvPdf()],
    build: {
      // Vite warns at 500 kB and the 3D chunk is 509 kB raw — 129 KB gzip,
      // which is what actually travels. The warning describes the intended
      // design: `three` has ONE importer and is loaded with a dynamic
      // `import()`, off the critical path.
      //
      // The real ceiling is not this number, it is `bundle-budget.check.ts`:
      // 4 KB gzip for the critical chunks, 150 KB for the deferred one, and a
      // test asserting `WebGLRenderer` never appears in a critical chunk. That
      // gate is stricter and better informed than this one.
      //
      // It is raised and not silenced: a warning that is always there is a
      // warning nobody reads, and the day a critical chunk crosses 500 kB the
      // line would look identical to today's.
      chunkSizeWarningLimit: 600,
    },
  },
  integrations: [
    sitemap({
      // `/cv` carries noindex and has no incoming links: it exists so Browser
      // Rendering can print the PDF, not to be visited. Listing it in the
      // sitemap would invite the crawler to the one page we ask it to ignore —
      // and two contradictory signals confuse more than the absence of one.
      // `single-landing.check.ts` guards the rest of that invariant.
      filter: (page) => !page.includes("/cv/"),
    }),
  ],
});
