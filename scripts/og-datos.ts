/**
 * Lo que comparten el generador de la tarjeta social y su verificación.
 *
 * Vive aparte por el mismo motivo que `pdf-options.ts`: `build-og.ts` es un
 * entry point —corre `main()` al importarse—, así que si el check importara de
 * ahí, verificar la imagen levantaría un Chromium para regenerarla. Y si cada
 * uno tuviera su copia de estas dos funciones, la huella que escribe el
 * generador y la que recalcula el check dejarían de coincidir el día que una
 * de las dos cambie: el gate pasaría a comparar la imagen contra sí misma.
 */

import { createHash } from "node:crypto";

// Invariante 2: la vista sale de `content/source/index.ts`, nunca de la
// implementación. Es la línea que cambia el día que el backend sea otro.
import { content, formatSeniority } from "../content/source/index";

export const FOTO = "public/foto.jpeg";
export const IMAGEN = "public/og.jpg";
export const ICONO = "public/apple-touch-icon.png";
export const PLANTILLA = "scripts/og-template.ts";
/** La geometría de la marca. Entra en la huella: los dos artefactos la dibujan. */
export const MARCA = "src/lib/marca.ts";
export const LOCK = "og.lock.json";

/** Los textos de la tarjeta, todos derivados del dataset. Nada escrito a mano. */
export async function textosOg(): Promise<Record<string, string>> {
  const view = await content.getView("portfolio", "es");
  const { identity } = view;
  return {
    nombre: identity.fullName,
    kicker: identity.brandTitle,
    // La misma línea que arma el hero de la landing. La antigüedad se DERIVA
    // (invariante 3): `formatSeniority` sobre los años que ya calculó la vista,
    // nunca un número escrito acá.
    rol: `${identity.searchTitle} · ${formatSeniority(view.yearsOfExperience)} · ${identity.location.city}, ${identity.location.country}`,
  };
}

/**
 * La huella de todo lo que se ve en la tarjeta.
 *
 * `public/og.jpg` es un artefacto commiteado: si cambia una entrada y nadie lo
 * regenera, el sitio dice una cosa y la imagen que ve LinkedIn dice otra, sin
 * que nada falle. Este número es lo que convierte ese silencio en un test rojo.
 *
 * Incluye el fuente de la plantilla Y el de `marca.ts` a propósito: retocar el
 * diseño, o ajustar una curva del logo, también invalidan los artefactos — no
 * solo cambiar un dato del dataset. Sin `marca.ts` adentro, cambiar la marca
 * dejaba la tarjeta y el ícono de iOS dibujando la vieja y nada fallaba.
 *
 * Los saltos de línea de la plantilla se normalizan antes de hashear. El repo
 * corre con `core.autocrlf=true`, así que el archivo llega con CRLF a Windows y
 * con LF a Linux: sin normalizar, la huella daría distinto en la máquina de uno
 * y en el runner de CI, y el gate fallaría sin que nada hubiera cambiado. La
 * foto NO se toca — es binaria, y "normalizarla" la corrompería.
 */
export function huella(
  textos: Record<string, string>,
  foto: Buffer,
  ...fuentes: Buffer[]
): string {
  const h = createHash("sha256").update(JSON.stringify(textos)).update(foto);
  for (const f of fuentes) h.update(f.toString("utf8").replace(/\r\n/g, "\n"));
  return h.digest("hex").slice(0, 16);
}
