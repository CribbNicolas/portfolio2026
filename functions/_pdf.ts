/**
 * Las piezas puras de `functions/cv.pdf.ts`.
 *
 * Vive con guion bajo adelante a propósito: Cloudflare Pages excluye del ruteo
 * todo lo que empieza con `_`, así que este archivo se puede importar sin que
 * aparezca como una URL pública. El handler queda con la parte que toca red y
 * caché; todo lo que se puede decidir sin I/O está acá, y por eso tiene tests
 * (`_pdf.test.ts`) sin necesidad de levantar un Worker.
 */

import { OPCIONES_PDF, ESPERA_CARGA } from "../scripts/pdf-options";

/**
 * La página que se imprime. Es la MISMA que imprime `scripts/build-pdf.ts` en
 * local: un solo layout, `src/pages/cv.astro`, y de ahí salen los dos PDFs.
 */
export const RUTA_ORIGEN = "/cv";

/** Con qué nombre lo guarda quien lo baja, si no se configura `PDF_FILENAME`. */
export const NOMBRE_POR_DEFECTO = "cv.pdf";

/**
 * Una hora. El dataset cambia por deploy, no por minuto, y cada miss consume
 * del presupuesto de Browser Rendering (10 min de browser por día en el plan
 * gratuito, ~3-5 s por render). Con este TTL el costo real es una render por
 * deploy y algún miss suelto por colo.
 */
export const SEGUNDOS_DE_CACHE = 3600;

/** Cuánto esperamos a Browser Rendering antes de cortar y devolver 504. */
export const TIMEOUT_MS = 45_000;

export function endpointBrowserRendering(cuenta: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${cuenta}/browser-rendering/pdf`;
}

/**
 * El cuerpo del POST a Browser Rendering.
 *
 * `url` se arma desde el origen del pedido y no desde una constante: así la
 * Function imprime la preview cuando corre en una preview de Pages y la
 * producción cuando corre en producción, sin configuración por entorno. Un
 * `SITE_URL` hardcodeado haría que el smoke de una rama testeara el PDF de
 * main, que es exactamente el bug que el smoke existe para atajar.
 */
export function cuerpoPeticion(origen: string): string {
  return JSON.stringify({
    url: new URL(RUTA_ORIGEN, origen).toString(),
    pdfOptions: OPCIONES_PDF,
    gotoOptions: { waitUntil: ESPERA_CARGA },
  });
}

/**
 * La clave de caché, normalizada.
 *
 * Se descarta el query string: `/cv.pdf?utm_source=linkedin` es el mismo PDF
 * que `/cv.pdf`, y sin normalizar cada campaña con su propio parámetro sería un
 * miss —o sea, un render pago— por visitante.
 */
export function claveDeCache(urlPedida: string): Request {
  const url = new URL(urlPedida);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

/**
 * `inline` y no `attachment`: el que hace click quiere VER el CV, y un download
 * forzado en el medio de la landing es fricción. El nombre igual viaja, así que
 * quien lo guarda no termina con un `download.pdf` en Descargas.
 */
export function cabecerasPdf(nombreArchivo: string): Headers {
  return new Headers({
    "content-type": "application/pdf",
    "content-disposition": `inline; filename="${nombreArchivo}"`,
    "cache-control": `public, max-age=${SEGUNDOS_DE_CACHE}`,
    // El CV es público y lo consumen agentes y scrapers de reclutamiento.
    "access-control-allow-origin": "*",
    // El PDF sale de nuestro propio `/cv`. Si alguna vez el content-type
    // llegara mal, que el browser no adivine.
    "x-content-type-options": "nosniff",
  });
}
