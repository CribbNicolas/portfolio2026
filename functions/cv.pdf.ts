/**
 * `/cv.pdf` — el CV impreso a demanda.
 *
 * Antes esto era un archivo estático que `pnpm run build` generaba con
 * Playwright. Eso ataba el build a un Chromium instalado, y por eso el build no
 * podía correr en Cloudflare. Ahora el build es `astro build` y nada más, y la
 * impresión pasó a runtime: esta Function le pide a Browser Rendering que
 * imprima nuestro propio `/cv` y devuelve los bytes.
 *
 * Consecuencia buscada, más allá del build: el día que los datos vengan de una
 * API, el PDF sale al día sin que nadie regenere un archivo. Lo único que hace
 * falta es que `/cv` esté al día, y de eso se encarga el deploy.
 *
 * El binding de Browser Rendering NO está disponible en Pages Functions (solo
 * KV, D1, R2, DO, Queues, AI y service bindings). Por eso se usa la REST API
 * con un token, que sí es un `fetch` común y corriente.
 *
 * `/cv` tiene que seguir en cero JavaScript. Antes un script que se colara
 * rompía tu build; ahora rompe el PDF en producción. El invariante no cambió,
 * subió de precio. Lo verifica `scripts/no-client-js.check.ts`.
 */

import {
  NOMBRE_POR_DEFECTO,
  TIMEOUT_MS,
  cabecerasPdf,
  claveDeCache,
  cuerpoPeticion,
  endpointBrowserRendering,
} from "./_pdf";

interface Env {
  /** Account ID de Cloudflare. No es secreto, pero se configura igual. */
  BROWSER_RENDERING_ACCOUNT_ID?: string;
  /** Token con UN permiso: Browser Rendering → Edit. Va como secret. */
  BROWSER_RENDERING_TOKEN?: string;
  /** Opcional. Con qué nombre lo guarda quien lo baja. */
  PDF_FILENAME?: string;
}

/**
 * El contexto que Pages le pasa a la Function. Se declara a mano en vez de
 * traer `@cloudflare/workers-types`: ese paquete redefine globals del DOM y el
 * `tsconfig` de acá compila `src/` con `lib: ["ES2022","DOM"]`. Tres campos no
 * justifican pelearse con eso.
 */
interface Contexto {
  request: Request;
  env: Env;
  waitUntil(promesa: Promise<unknown>): void;
}

/** `caches.default` es de Cloudflare y no está en el `CacheStorage` del DOM. */
const cacheDeBorde = (caches as unknown as { default: Cache }).default;

function error(estado: number, mensaje: string): Response {
  // Sin `cache-control` permisivo: un fallo no se cachea. Y el cuerpo no
  // reexpone nada de la respuesta de la API — ahí puede venir el account ID.
  return new Response(`${mensaje}\n`, {
    status: estado,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet(contexto: Contexto): Promise<Response> {
  const { request, env, waitUntil } = contexto;

  const cuenta = env.BROWSER_RENDERING_ACCOUNT_ID;
  const token = env.BROWSER_RENDERING_TOKEN;
  if (!cuenta || !token) {
    // 503 y no 500: el sitio está bien, falta configuración. Se distingue en
    // los logs de un fallo de Browser Rendering, que es 502.
    return error(503, "El PDF no está configurado en este entorno.");
  }

  const clave = claveDeCache(request.url);
  const cacheado = await cacheDeBorde.match(clave);
  if (cacheado) return cacheado;

  let respuesta: Response;
  try {
    respuesta = await fetch(endpointBrowserRendering(cuenta), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: cuerpoPeticion(new URL(request.url).origin),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Timeout o red caída. 504 para que quede claro que no es un 4xx nuestro.
    return error(504, "El render del PDF tardó demasiado. Probá de nuevo en un minuto.");
  }

  if (!respuesta.ok) {
    // 429 = se agotó el presupuesto diario de Browser Rendering. Se propaga tal
    // cual, con Retry-After si vino, porque es la única señal que distingue
    // "cuota" de "roto" cuando alguien mire esto en seis meses.
    if (respuesta.status === 429) {
      const reintentar = respuesta.headers.get("retry-after");
      const r = error(429, "Se agotó la cuota de render del día. Probá más tarde.");
      if (reintentar) r.headers.set("retry-after", reintentar);
      return r;
    }
    return error(502, "No se pudo generar el PDF.");
  }

  const bytes = await respuesta.arrayBuffer();
  const pdf = new Response(bytes, {
    headers: cabecerasPdf(env.PDF_FILENAME ?? NOMBRE_POR_DEFECTO),
  });

  // `clone()` porque un Response se puede leer una sola vez y hay que devolver
  // uno y guardar el otro. `waitUntil` para no hacer esperar al visitante por
  // la escritura en caché.
  waitUntil(cacheDeBorde.put(clave, pdf.clone()));
  return pdf;
}
