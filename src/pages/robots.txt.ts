/**
 * Our own `robots.txt`.
 *
 * It is an endpoint and not a file in `public/` because the `Sitemap:` line has
 * to carry the site's absolute URL, and that comes from `Astro.site` — i.e.
 * from the `SITE_URL` variable. A static file would have it written by hand and
 * would drift the day the domain changes, which is exactly the day nobody
 * remembers this file.
 *
 * Until now Cloudflare served a managed one that is ONLY comments: no
 * `User-agent`, no `Disallow`, no `Sitemap`. It restricted nothing, but it
 * announced nothing either.
 *
 * ⚠️ UNVERIFIED: that this one beats Cloudflare's managed one. It is checked by
 * opening `/robots.txt` on the `staging` preview and seeing whether this shows
 * up or the "content signals" block does. If Cloudflare's wins, the sitemap has
 * to be announced through Search Console and the limitation noted (docs/07 §17).
 */

import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  // `site` comes from `astro.config.mjs`, which blows up on purpose when
  // SITE_URL is missing. It is handled anyway: a robots.txt without a Sitemap is
  // useful; one that breaks the build is not.
  const sitemap = site ? `Sitemap: ${new URL("sitemap-index.xml", site)}` : null;

  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    "# /cv y /en/cv existen solo para que Browser Rendering imprima cada PDF.",
    "# Van con noindex y sin links entrantes; el destino del lector es el ancla",
    "# #cv de la landing correspondiente. Se desalienta el rastreo para que no",
    "# compita con la home.",
    "Disallow: /cv/",
    "Disallow: /en/cv/",
    "",
    "# /build.json dice qué commit está publicado. Lo consume el smoke de CI,",
    "# no un lector.",
    "Disallow: /build.json",
    "",
    "# Para agentes: el CV en markdown plano y el dataset resuelto en JSON.",
    "# No hace falta scrapear el HTML.",
    `# ${site ? new URL("llms.txt", site) : "/llms.txt"}`,
    `# ${site ? new URL("cv.json", site) : "/cv.json"}`,
    `# ${site ? new URL("en/llms.txt", site) : "/en/llms.txt"}`,
    `# ${site ? new URL("en/cv.json", site) : "/en/cv.json"}`,
    ...(sitemap ? ["", sitemap] : []),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
