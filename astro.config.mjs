import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// `site` tiene que ser absoluta: el JSON-LD y el canonical la necesitan, y los
// crawlers no resuelven rutas relativas. El TLD .invalid está reservado por RFC
// 2606, así que si alguien deployea sin definir SITE_URL, rompe visiblemente en
// vez de publicar una URL equivocada que parece buena.
const SITE = process.env.SITE_URL ?? "https://portfolio.invalid";

export default defineConfig({
  site: SITE,
  output: "static",
  build: { format: "directory" },
  integrations: [
    sitemap({
      // `/cv` va con noindex y sin links entrantes: existe para que Browser
      // Rendering imprima el PDF, no para que la visiten. Listarla en el
      // sitemap sería invitar al crawler a la única página que le pedimos que
      // ignore — y las dos señales en contra confunden más que la ausencia de
      // una. `landing-unica.check.ts` custodia el resto de ese invariante.
      filter: (pagina) => !pagina.includes("/cv/"),
    }),
  ],
});
