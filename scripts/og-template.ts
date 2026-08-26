/**
 * La tarjeta de Open Graph: el HTML del que sale `public/og.jpg`.
 *
 * Función PURA a propósito —no lee archivos, no abre un browser—: recibe los
 * textos ya resueltos y los binarios ya en `data:`. Eso la deja testeable sin
 * Chromium y hace que `build-og.ts` sea lo único con I/O, igual que
 * `render-pdf.ts` frente a `build-pdf.ts`.
 *
 * Por qué una plantilla suelta y no una página en `src/pages/`: una página se
 * buildea, entra en `dist/`, y los tres checks que recorren `dist/`
 * —`no-client-js`, `bundle-budget`, `landing-unica`— tendrían que aprender a
 * ignorarla. Una excepción en un check es una grieta permanente. Además sería
 * una ruta indexable que no es un destino, justo lo que la landing única
 * promete que no existe.
 */

/**
 * 1200×630 es la relación 1.91:1 que piden Facebook, LinkedIn, WhatsApp, Slack
 * y Discord, y también la del `summary_large_image` de Twitter. NO hace falta
 * una imagen por plataforma: todas leen la misma etiqueta `og:image`, y lo que
 * cambia entre ellas es cómo la recortan, no qué archivo piden.
 */
export const OG_ANCHO = 1200;
export const OG_ALTO = 630;

/**
 * El techo de peso. WhatsApp no llega a mostrar la previsualización si la
 * imagen pesa de más, así que este número no es prolijidad: es la diferencia
 * entre que la tarjeta aparezca en un chat o no. Por eso el archivo sale en
 * JPEG y no en PNG — con una foto adentro, un PNG se va a más de 800 KB.
 */
export const OG_PESO_MAXIMO = 300 * 1024;

export interface DatosOg {
  /** `identity.fullName`. */
  nombre: string;
  /** `identity.brandTitle`. El volanta de arriba. */
  kicker: string;
  /** Rol, antigüedad y ciudad, ya formateados con los helpers del contrato. */
  rol: string;
  /** La foto como `data:`. Cuadrada; se recorta al círculo. */
  fotoDataUri: string;
  /** Los `@font-face` de Manrope con las fuentes embebidas en `data:`. */
  fuenteCss: string;
  /** El SVG de la marca, de `src/lib/marca.ts`. */
  marca: string;
}

// Tokens de `src/styles/tokens.css`, resueltos a mano porque este HTML no pasa
// por el bundler y no hay cascada de la que heredarlos. Modo claro siempre: la
// tarjeta la renderiza el servidor de cada red social, no el browser de nadie,
// así que no hay `prefers-color-scheme` que consultar.
const FONDO = "#f7f6f4";
const TINTA = "#17181c";
const SUAVE = "#5f636e";
const ACENTO = "#b0472a";
const LINEA = "#e5e3df";

/** El aro que enmarca la foto. Mismo idioma que la marca: abierto a la derecha. */
const HUECO = 24; // % del perímetro
const RETRATO = 380;

function retrato(fotoDataUri: string): string {
  const c = RETRATO / 2;
  const rAro = c - 12;
  const rFoto = c - 30;
  const lado = rFoto * 2;
  return (
    `<svg width="${RETRATO}" height="${RETRATO}" viewBox="0 0 ${RETRATO} ${RETRATO}" aria-hidden="true">` +
    `<defs><clipPath id="recorte"><circle cx="${c}" cy="${c}" r="${rFoto}"/></clipPath></defs>` +
    `<image href="${fotoDataUri}" x="${c - rFoto}" y="${c - rFoto}" width="${lado}" height="${lado}"` +
    ` clip-path="url(#recorte)" preserveAspectRatio="xMidYMid slice"/>` +
    // `pathLength=100` hace que el hueco se mida en porcentaje del perímetro y
    // no en unidades, y `rotate(hueco * 1.8)` lo centra exacto a la derecha.
    // La cuenta es la misma que la del aro de la marca.
    `<circle cx="${c}" cy="${c}" r="${rAro}" fill="none" stroke="${ACENTO}" stroke-width="14"` +
    ` stroke-linecap="round" pathLength="100" stroke-dasharray="${100 - HUECO} ${HUECO}"` +
    ` transform="rotate(${HUECO * 1.8} ${c} ${c})"/>` +
    `</svg>`
  );
}

export function buildOgHtml(d: DatosOg): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
${d.fuenteCss}
* { box-sizing: border-box; margin: 0; }
body {
  width: ${OG_ANCHO}px;
  height: ${OG_ALTO}px;
  background: ${FONDO};
  color: ${TINTA};
  font-family: "Manrope", system-ui, sans-serif;
  /* Las mismas ligaduras apagadas que en el sitio: acá no hay parser que las
     lea, pero un rasterizado que difiera del HTML sería una sorpresa. */
  font-variant-ligatures: none;
  letter-spacing: -0.005em;
  display: flex;
  flex-direction: column;
  padding: 60px 68px;
}
.cuerpo { display: flex; flex: 1; align-items: center; gap: 52px; min-width: 0; }
.texto { display: flex; flex-direction: column; gap: 18px; min-width: 0; flex: 1; }
/* La marca arriba de todo y sola: no lleva el dominio al lado porque cada red
   ya imprime el host abajo de la tarjeta, y repetirlo es ruido. */
.marca { display: flex; margin-bottom: 10px; }
.kicker {
  font-size: 19px; font-weight: 800; letter-spacing: 0.13em;
  text-transform: uppercase; color: ${ACENTO};
}
.nombre {
  font-size: 76px; font-weight: 800; letter-spacing: -0.035em;
  line-height: 1.02; text-wrap: balance;
}
.rol {
  font-size: 26px; font-weight: 400; color: ${SUAVE}; line-height: 1.35;
  text-wrap: pretty; padding-top: 14px; border-top: 1px solid ${LINEA};
}
.retrato { flex: none; display: flex; }
</style>
</head>
<body>
  <div class="cuerpo">
    <div class="texto">
      <div class="marca">${d.marca}</div>
      <p class="kicker">${escapar(d.kicker)}</p>
      <h1 class="nombre">${escapar(d.nombre)}</h1>
      <p class="rol">${escapar(d.rol)}</p>
    </div>
    <div class="retrato">${retrato(d.fotoDataUri)}</div>
  </div>
</body>
</html>`;
}

/**
 * El lado del ícono de iOS. 180 es lo que pide el iPhone a 3x, y el tamaño
 * único que Apple recomienda declarar desde iOS 8: los demás los deriva solo.
 */
export const ICONO_LADO = 180;

/**
 * El ícono de la pantalla de inicio de iOS.
 *
 * Existe aparte del favicon porque Safari **no acepta SVG** para
 * `apple-touch-icon`: tiene que ser un bitmap. Sin este archivo, guardar el
 * sitio en la pantalla de inicio no da un ícono sino una captura reducida de la
 * página, ilegible.
 *
 * Lleva la marca COMPLETA —el aro con la N— y no solo el aro: acá hay 180 px,
 * que es cuatro veces lo que tiene un favicon, y a ese tamaño las letras se
 * leen sin problema. La regla de "silueta sola" era por los 16 px, no por
 * gusto.
 *
 * Fondo opaco y esquinas cuadradas a propósito: iOS aplica su propia máscara
 * redondeada y compone la transparencia sobre negro, así que redondear acá deja
 * un borde raro y dejarlo transparente lo pone sobre un cuadrado negro.
 */
export function buildIconoHtml(marca: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;width:${ICONO_LADO}px;height:${ICONO_LADO}px;background:${FONDO};display:flex;align-items:center;justify-content:center">
${marca}
</body>
</html>`;
}

/** Los textos salen del dataset, no de nosotros: pueden traer `&` o comillas. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
