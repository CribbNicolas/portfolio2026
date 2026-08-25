/**
 * `robots.txt` propio.
 *
 * Es un endpoint y no un archivo en `public/` porque la línea `Sitemap:` tiene
 * que llevar la URL absoluta del sitio, y esa sale de `Astro.site` — o sea de
 * la variable `SITE_URL`. Un archivo estático la tendría escrita a mano y se
 * desincronizaría el día que cambie el dominio, que es justo el día en que uno
 * no se acuerda de este archivo.
 *
 * Hasta ahora Cloudflare servía uno gestionado que son SOLO comentarios: cero
 * `User-agent`, cero `Disallow`, cero `Sitemap`. No restringía nada, pero
 * tampoco anunciaba nada.
 *
 * ⚠️ SIN VERIFICAR: que este le gane al gestionado de Cloudflare. Se comprueba
 * abriendo `/robots.txt` en la preview de `staging` y viendo si aparece esto o
 * el bloque de "content signals". Si gana el de Cloudflare, el sitemap hay que
 * anunciarlo por Search Console y anotar la limitación (docs/07 §17).
 */

import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  // `site` viene de `astro.config.mjs`, que revienta a propósito si falta
  // SITE_URL. Igual se contempla: un robots.txt sin Sitemap sirve; uno que
  // rompe el build, no.
  const sitemap = site ? `Sitemap: ${new URL("sitemap-index.xml", site)}` : null;

  const lineas = [
    "User-agent: *",
    "Allow: /",
    "",
    "# /cv existe solo para que Browser Rendering imprima el PDF. Va con",
    "# noindex y sin links entrantes; el destino del lector es el ancla #cv de",
    "# la landing. Se desalienta el rastreo para que no compita con la home.",
    "Disallow: /cv/",
    "",
    "# /build.json dice qué commit está publicado. Lo consume el smoke de CI,",
    "# no un lector.",
    "Disallow: /build.json",
    "",
    "# Para agentes: el CV en markdown plano y el dataset resuelto en JSON.",
    "# No hace falta scrapear el HTML.",
    `# ${site ? new URL("llms.txt", site) : "/llms.txt"}`,
    `# ${site ? new URL("cv.json", site) : "/cv.json"}`,
    ...(sitemap ? ["", sitemap] : []),
    "",
  ];

  return new Response(lineas.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
