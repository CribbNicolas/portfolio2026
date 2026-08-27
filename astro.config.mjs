import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// `site` has to be absolute: the JSON-LD and the canonical need it, and crawlers
// do not resolve relative paths. The .invalid TLD is reserved by RFC 2606, so if
// somebody deploys without setting SITE_URL it breaks visibly instead of
// publishing a wrong URL that looks fine.
const SITE = process.env.SITE_URL ?? "https://portfolio.invalid";

export default defineConfig({
  site: SITE,
  output: "static",
  build: { format: "directory" },
  vite: {
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
