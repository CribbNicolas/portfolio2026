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
