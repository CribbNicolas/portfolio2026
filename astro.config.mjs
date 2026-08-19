import { defineConfig } from "astro/config";

// `site` tiene que ser absoluta: el JSON-LD y el canonical la necesitan, y los
// crawlers no resuelven rutas relativas. El TLD .invalid está reservado por RFC
// 2606, así que si alguien deployea sin definir SITE_URL, rompe visiblemente en
// vez de publicar una URL equivocada que parece buena.
const SITE = process.env.SITE_URL ?? "https://portfolio.invalid";

export default defineConfig({
  site: SITE,
  output: "static",
  build: { format: "directory" },
});
