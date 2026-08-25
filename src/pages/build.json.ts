/**
 * Qué commit está publicado. Existe para un solo consumidor: el smoke.
 *
 * `smoke-deploy.yml` corre al pushear a `staging` o `main`, pero el push y el
 * deploy no son el mismo evento: Cloudflare tarda uno o dos minutos. Sin una
 * forma de preguntar "¿ya estás sirviendo ESTE commit?", el smoke tendría que
 * dormir un rato fijo y cruzar los dedos — y verificaría el deploy anterior
 * cada vez que el build tardara de más.
 *
 * Por qué hizo falta: la versión original del smoke escuchaba
 * `deployment_status`, asumiendo que Pages creaba GitHub Deployments. No los
 * crea: publica un *check run* llamado "Cloudflare Pages". El evento nunca se
 * disparó y el gate estuvo semanas sin correr ni una vez (deuda técnica §14).
 *
 * `CF_PAGES_COMMIT_SHA` la inyecta Cloudflare en el entorno de build. En local
 * no existe y sale `"local"`, que es exactamente lo que queremos ver si alguien
 * apunta el smoke a un `dist/` servido a mano.
 *
 * NO lleva la versión de `package.json` ni un timestamp. La versión porque
 * docs/08 §3 decidió no exponerla mientras no haya quién la consuma, y el smoke
 * no la necesita. El timestamp porque haría que dos builds del mismo commit
 * produjeran bytes distintos, y la determinismo del build es una propiedad que
 * este repo ya cuida en otros lados (`graph-layout.ts`).
 */

import type { APIRoute } from "astro";

/**
 * Sin cabecera de caché acá, y no por olvido: con `output: "static"` Astro
 * prerenderiza esto a un archivo y descarta las cabeceras del `Response`. Las
 * pone Pages, que para assets estáticos sirve `max-age=0, must-revalidate`
 * —verificado sobre el sitio publicado—, así que cada pedido revalida. El
 * workflow además le agrega un `?t=<epoch>` para no depender de eso.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ commit: process.env.CF_PAGES_COMMIT_SHA ?? "local" }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
