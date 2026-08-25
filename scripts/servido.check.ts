/**
 * Verifica el sitio PUBLICADO, no el `dist/` que produjo el build.
 *
 * Existe por un punto ciego concreto: `no-client-js.check.ts` y los otros
 * checks leen archivos de `dist/`. Todo lo que pase después del build —una
 * inyección de Cloudflare en el borde, una regla de transformación, un
 * `_headers` mal puesto— es invisible para ellos.
 *
 * El caso que lo motivó no es hipotético: habilitar Cloudflare Web Analytics
 * desde el dashboard de Pages inyecta su beacon en TODO el sitio en el próximo
 * deploy. Eso pondría JavaScript en `/cv`, que es de donde Browser Rendering
 * imprime el PDF, y los cinco checks seguirían en verde porque el `dist/` no
 * cambió (docs/05 §3 paso 8).
 *
 * Corre desde `smoke-deploy.yml`, después de cada deploy, contra la URL real.
 *
 * `SITIO` es la base sin barra final: `SITIO=https://cribbnicolas.pages.dev`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const SITIO = process.env.SITIO?.replace(/\/+$/, "");

if (!SITIO) {
  throw new Error(
    "falta SITIO. Ejemplo: SITIO=https://cribbnicolas.pages.dev pnpm run test:servido",
  );
}

/** Una sola lectura por ruta: cada test extra sería otro request. */
const cache = new Map<string, Promise<Response>>();
const pedir = (ruta: string): Promise<Response> => {
  const url = `${SITIO}${ruta}`;
  if (!cache.has(url)) cache.set(url, fetch(url));
  return cache.get(url)!.then((r) => r.clone());
};

/**
 * Las mismas huellas que busca `no-client-js.check.ts` sobre `dist/`. Se
 * repiten a propósito en vez de importarse: si un día divergen, es porque
 * alguien tocó uno de los dos y hay que mirar los dos.
 */
const HUELLAS_DE_ANALITICA = ["clarity", "cloudflareinsights", "cf-beacon"];

test("`/cv` servida no ejecuta JavaScript", async () => {
  const res = await pedir("/cv/");
  assert.equal(res.status, 200, `/cv/ devolvió ${res.status}`);
  const html = await res.text();

  const externos = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
  assert.deepEqual(
    externos,
    [],
    `/cv servida carga JS: ${externos.join(", ")}. El dist/ puede estar limpio y ` +
      "esto igual pasar: algo lo inyectó después del build. Sospechá de Web " +
      "Analytics habilitado desde el dashboard de Pages (docs/05 §3 paso 8).",
  );
});

test("`/cv` servida no trae ninguna analítica", async () => {
  const html = await (await pedir("/cv/")).text();
  const encontradas = HUELLAS_DE_ANALITICA.filter((h) => html.toLowerCase().includes(h));
  assert.deepEqual(
    encontradas,
    [],
    `/cv servida menciona ${encontradas.join(", ")}. De esa página sale el PDF: ` +
      "un script de terceros ahí cambia el render y ningún test del PDF lo nota, " +
      "porque el texto extraído sigue siendo el mismo.",
  );
});

test("una ruta inexistente devuelve 404, no 200", async () => {
  // El soft-404 que arreglamos con `src/pages/404.astro`. Que exista el archivo
  // lo verifica `landing-unica.check.ts`; que Pages lo sirva con el estado
  // correcto solo se puede ver desde afuera.
  const res = await pedir("/esta-ruta-no-existe-jamas");
  assert.equal(
    res.status,
    404,
    `una ruta inventada devolvió ${res.status}. Con 200 vuelve el soft-404: los ` +
      "crawlers tratan la URL rota como una página válida.",
  );
});
