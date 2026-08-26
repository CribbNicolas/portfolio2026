/**
 * Genera `public/og.jpg`: la tarjeta que ven WhatsApp, LinkedIn, Twitter,
 * Facebook, Slack y Discord cuando alguien pega el link.
 *
 * `pnpm run og:local`. NO corre en el build ni en CI, y eso es la decisión de
 * fondo (docs/07 §18): rasterizar necesita Chromium y el builder de Cloudflare
 * no lo tiene —el mismo motivo por el que el PDF se fue del build—. Así que la
 * imagen se genera acá y se COMMITEA. Cero costo en runtime, cero dependencia
 * del builder, y ningún crawler esperando a que un servicio le imprima algo.
 *
 * El precio de commitearla es que puede quedar vieja en silencio: si cambia el
 * nombre, el rol o la foto, el JPEG sigue siendo el de antes. Por eso además
 * del JPEG se escribe `og.lock.json` con la huella de las entradas, y
 * `og-output.check.ts` falla en CI cuando una no coincide con la otra.
 *
 * Las etiquetas que apuntan a esta imagen viven en `src/layouts/Base.astro`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

import { marcaSvg } from "../src/lib/marca";
import { FOTO, huella, ICONO, IMAGEN, LOCK, MARCA, PLANTILLA, textosOg } from "./og-datos";
import { buildIconoHtml, buildOgHtml, ICONO_LADO, OG_ALTO, OG_ANCHO, OG_PESO_MAXIMO } from "./og-template";

/**
 * Calidad del JPEG. 84 deja la foto limpia y el archivo bien abajo del techo de
 * WhatsApp; subirlo a 92 lo duplica sin que se note en pantalla.
 */
const CALIDAD = 84;

/** Los pesos que la plantilla usa. Tienen que existir como archivo. */
const PESOS = [400, 600, 800] as const;

async function fuenteCss(): Promise<string> {
  const caras = await Promise.all(
    PESOS.map(async (peso) => {
      const bin = await readFile(`node_modules/@fontsource/manrope/files/manrope-latin-${peso}-normal.woff2`);
      // Embebida en `data:` y no por link: la plantilla se renderiza con
      // `setContent`, sin servidor y sin red. Un `<link>` a Google Fonts haría
      // que la tarjeta dependa de que haya internet al generarla.
      return `@font-face{font-family:"Manrope";font-style:normal;font-weight:${peso};font-display:block;src:url(data:font/woff2;base64,${bin.toString("base64")}) format("woff2")}`;
    }),
  );
  return caras.join("\n");
}

async function main(): Promise<void> {
  const [textos, foto, plantilla, marcaFuente] = await Promise.all([
    textosOg(),
    readFile(FOTO),
    readFile(PLANTILLA),
    readFile(MARCA),
  ]);

  const html = buildOgHtml({
    ...(textos as { nombre: string; kicker: string; rol: string }),
    fotoDataUri: `data:image/jpeg;base64,${foto.toString("base64")}`,
    fuenteCss: await fuenteCss(),
    marca: marcaSvg({ tam: 44, acento: "#b0472a", tinta: "#17181c" }),
  });

  const browser = await chromium.launch();
  let jpeg: Buffer;
  let icono: Buffer;
  try {
    // Escala 1: el viewport ES el tamaño final, así que no hay reescalado que
    // ablande los bordes del texto.
    const page = await browser.newPage({ viewport: { width: OG_ANCHO, height: OG_ALTO } });
    await page.setContent(html, { waitUntil: "load" });

    // Sin esto Chromium puede rasterizar con la fuente de fallback, y la
    // tarjeta sale distinta en cada máquina.
    await page.evaluate(() => document.fonts.ready);

    jpeg = await page.screenshot({ type: "jpeg", quality: CALIDAD });

    // El icono de iOS, en el mismo browser: levantar Chromium dos veces para
    // dibujar 180x180 seria pagar dos arranques por un archivo de 2 KB.
    // PNG y no JPEG: son cuatro colores planos, y el JPEG les mete artefactos
    // justo en el borde del aro, que es todo lo que se ve a ese tamano.
    const chico = await browser.newPage({ viewport: { width: ICONO_LADO, height: ICONO_LADO } });
    await chico.setContent(buildIconoHtml(marcaSvg({ tam: 116, acento: "#b0472a", tinta: "#17181c" })));
    icono = await chico.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }

  if (jpeg.byteLength > OG_PESO_MAXIMO) {
    throw new Error(
      `og.jpg pesa ${(jpeg.byteLength / 1024).toFixed(0)} KB y el techo es ${OG_PESO_MAXIMO / 1024} KB.\n` +
        `WhatsApp no muestra la previsualización si se pasa. Bajá CALIDAD en ${import.meta.filename ?? "scripts/build-og.ts"}.`,
    );
  }

  await writeFile(IMAGEN, jpeg);
  await writeFile(ICONO, icono);
  await writeFile(
    LOCK,
    JSON.stringify(
      {
        _: "Generado por `pnpm run og:local`. NO editar a mano: og-output.check.ts lo compara con el dataset.",
        huella: huella(textos, foto, plantilla, marcaFuente),
        ancho: OG_ANCHO,
        alto: OG_ALTO,
        textos,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `og.jpg — ${(jpeg.byteLength / 1024).toFixed(0)} KB de ${OG_PESO_MAXIMO / 1024} KB · ` +
      `apple-touch-icon.png — ${(icono.byteLength / 1024).toFixed(1)} KB`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
