/**
 * La marca, en un solo lugar.
 *
 * Son dos piezas: el ARO —que es la C del apellido, un anillo grueso con la
 * abertura a la derecha— y la N que va adentro. El aro solo es el ícono chico;
 * las dos juntas son el logo. A 16 px una letra se convierte en una mancha y
 * una silueta no, así que el favicon se identifica por forma y las letras
 * aparecen recién cuando hay lugar para leerlas.
 *
 * Este módulo existe porque la marca la dibujan TRES consumidores —el logo del
 * header, la tarjeta de Open Graph y el favicon— y una `d=` copiada tres veces
 * diverge la primera vez que alguien ajusta una curva. Acá los dos primeros
 * importan; el favicon no puede (es un archivo estático que se sirve tal cual),
 * y por eso `og-output.check.ts` verifica que su path siga siendo el de acá.
 *
 * Es geometría, nunca `<text>`: un SVG que se carga como imagen —lo que es un
 * favicon— no puede traer una webfont, así que Manrope no cargaría y la N
 * saldría en la fuente del sistema, distinta en cada máquina.
 */

/** La caja de dibujo. Es la del favicon, y por eso todo se mide en 32avos. */
export const MARCA_VIEWBOX = "0 0 32 32";

/** El aro abierto. La C. Relleno, no trazo: es lo que permite cortar las
 *  terminales apuntando al centro en vez de dejarlas redondas. */
export const ARO_PATH =
  "M28.1 24.16A14.6 14.6 0 1 1 28.1 7.84L21.31 12.42A6.4 6.4 0 1 0 21.31 19.58Z";

/** La N. Trazo y no relleno, para que el grosor viva en un solo número. */
export const N_PATH = "M11.5 21.5V11l8 10.5V11";

/**
 * El grosor de la N.
 *
 * Con 4 se veía bien de 48 px para arriba, pero a 24 px —el tamaño al que vive
 * en la barra— los ojos de la letra se cerraban y quedaba una mancha. 3.6 los
 * mantiene abiertos ahí sin restarle peso en grande.
 */
export const N_GROSOR = 3.6;

/**
 * La marca como SVG suelto, para quien no puede montar un componente de Astro
 * —hoy, el generador de la tarjeta de Open Graph, que arma HTML a mano—.
 *
 * Los colores se pasan explícitos porque este SVG termina dentro de una página
 * que Chromium imprime sin la cascada del sitio. El logo del header, en cambio,
 * usa `var(--acento)` y `var(--tinta)`: ahí sí hay tokens, y por eso el modo
 * oscuro le sale gratis.
 */
export function marcaSvg({
  tam,
  acento,
  tinta,
}: {
  tam: number;
  acento: string;
  tinta: string;
}): string {
  return (
    `<svg viewBox="${MARCA_VIEWBOX}" width="${tam}" height="${tam}" aria-hidden="true">` +
    `<path d="${ARO_PATH}" fill="${acento}"/>` +
    `<path d="${N_PATH}" fill="none" stroke="${tinta}" stroke-width="${N_GROSOR}"` +
    ` stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
