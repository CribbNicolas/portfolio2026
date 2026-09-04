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
 * `astro dev` does not run Pages Functions, so `/cv.pdf` (and `/en/cv.pdf`)
 * 404 and the download button saves the HTML 404 under a .pdf name. Serve the
 * files `pdf:local` already wrote. Production is unchanged:
 * `functions/cv.pdf.ts` / `functions/en/cv.pdf.ts` own the routes.
 */
function localCvPdf() {
  // One route per locale: the URL it answers, and where `pdf:local` leaves
  // the bytes (public/ first, dist/ as a fallback for a `pdf:local` run
  // before any `public/` copy existed). No `filename` here on purpose: the
  // landing's `download=` attribute already names the file, derived from
  // `pdfFilename` (content/schema/pdf-filename.ts) — the current dataset's
  // `updatedAt`, not a name baked into this file. A second, hand-written name
  // here would be a fourth place claiming to know the file name, and it
  // already went stale once (it used to spell out the pre-rename
  // `Nicolas-Cribb-Barbaro-Full-Stack-Developer[-EN].pdf`, 47 characters this
  // branch replaced, while claiming in a comment to match `pdfFilename`'s
  // output — it never did).
  const ROUTES = [
    {
      url: "/cv.pdf",
      candidates: [join(process.cwd(), "public", "cv.pdf"), join(process.cwd(), "dist", "cv.pdf")],
    },
    {
      url: "/en/cv.pdf",
      candidates: [
        join(process.cwd(), "public", "en", "cv.pdf"),
        join(process.cwd(), "dist", "en", "cv.pdf"),
      ],
    },
  ];
  return {
    name: "local-cv-pdf",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const route = ROUTES.find((r) => r.url === url);
        if (!route) {
          next();
          return;
        }
        let body;
        for (const file of route.candidates) {
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
            `El PDF local se genera con \`pnpm run build\` y \`pnpm run pdf:local\`.\nEn producción ${url} lo sirve la Function.\n`,
          );
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-length", String(body.length));
        // Bare `attachment`, no `filename`: the browser falls back to the
        // link's own `download=` attribute, which is where the real name
        // lives. See the comment above `ROUTES` for why a second name does
        // not belong here.
        res.setHeader("content-disposition", "attachment");
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
      // Same two landings `Base.astro`'s `hreflang` tags point at each other,
      // declared here too: a sitemap that disagrees with the `<head>` is
      // worse than a sitemap that says nothing about locales at all — it
      // gives the crawler two different answers to "what is the Spanish
      // version of this page?" instead of one it can trust.
      //
      // `locales` maps the URL's locale PATH SEGMENT (`en/…`) to the
      // `hreflang` value to emit for it — that is what this integration's
      // `parseI18nUrl` keys on, not the page's own `locale` variable. `/`
      // carries no segment, so it falls back to `defaultLocale`.
      //
      // No `x-default` entry: this integration links locales that share a
      // URL after stripping the segment, one `hreflang` per physical page —
      // there is no third page to hang an `x-default` link off, and Google's
      // sitemap guidance treats it as optional. The `<head>` tag (present on
      // both landings) is where `x-default` is actually declared.
      i18n: {
        defaultLocale: "es",
        locales: { es: "es", en: "en" },
      },
    }),
  ],
});
