/**
 * La tarjeta social: que exista, que entre en los límites que imponen las
 * plataformas, que no haya quedado vieja, y que el HTML publicado la apunte.
 *
 * Existe porque `public/og.jpg` es un artefacto COMMITEADO —se genera con
 * `pnpm run og:local` y no en el build, porque el builder de Cloudflare no
 * tiene Chromium (docs/07 §18)—. Un artefacto commiteado se desincroniza en
 * silencio: cambiás el rol en el dataset, el sitio dice una cosa y la imagen
 * que ve LinkedIn sigue diciendo la otra. Nadie se entera hasta que alguien
 * comparte el link.
 *
 * El nombre NO termina en `.test.ts` a propósito: necesita un build previo para
 * mirar `dist/`. Mismo motivo que `pdf-output.check.ts` y
 * `landing-unica.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ARO_PATH } from "../src/lib/marca";
import { FOTO, huella, IMAGEN, LOCK, PLANTILLA, textosOg } from "./og-datos";
import { OG_ALTO, OG_ANCHO, OG_PESO_MAXIMO } from "./og-template";

const jpeg = await readFile(IMAGEN);
const lock = JSON.parse(await readFile(LOCK, "utf8")) as {
  huella: string;
  ancho: number;
  alto: number;
  textos: Record<string, string>;
};
const landing = await readFile(join("dist", "index.html"), "utf8");

/**
 * El alto y el ancho reales del JPEG, leídos del marcador SOF.
 *
 * Se parsea a mano en vez de sumar una dependencia de imágenes: son veinte
 * líneas y el precedente está en `build-pdf.ts`, que levanta su propio servidor
 * por el mismo motivo —"agregar una dependencia para esto sería más superficie
 * de mantenimiento que el problema que resuelve"—.
 */
function medirJpeg(bin: Buffer): { ancho: number; alto: number } {
  let i = 2; // saltar SOI
  while (i < bin.length) {
    if (bin[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = bin[i + 1];
    // Los SOF (C0–CF) traen las dimensiones. C4, C8 y CC no son SOF.
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return { alto: bin.readUInt16BE(i + 5), ancho: bin.readUInt16BE(i + 7) };
    }
    if (marcador === 0xd8 || marcador === 0xd9) {
      i += 2;
      continue;
    }
    i += 2 + bin.readUInt16BE(i + 2);
  }
  throw new Error(`${IMAGEN} no parece un JPEG: no se encontró el marcador SOF.`);
}

test("la tarjeta mide 1200×630", () => {
  const { ancho, alto } = medirJpeg(jpeg);
  // 1.91:1 es lo que piden Facebook, LinkedIn, WhatsApp, Slack y Discord, y
  // también el `summary_large_image` de Twitter. Fuera de esa relación cada
  // plataforma recorta por su cuenta y la cara queda cortada en alguna.
  assert.equal(ancho, OG_ANCHO, `ancho ${ancho}, esperado ${OG_ANCHO}`);
  assert.equal(alto, OG_ALTO, `alto ${alto}, esperado ${OG_ALTO}`);
});

test("la tarjeta entra en el techo de peso de WhatsApp", () => {
  assert.ok(
    jpeg.byteLength <= OG_PESO_MAXIMO,
    `og.jpg pesa ${(jpeg.byteLength / 1024).toFixed(0)} KB y el techo es ${OG_PESO_MAXIMO / 1024} KB. ` +
      `Pasado ese punto WhatsApp no muestra la previsualización: bajá CALIDAD en scripts/build-og.ts.`,
  );
});

test("la tarjeta no quedó vieja: la huella coincide con el dataset", async () => {
  const textos = await textosOg();
  const foto = await readFile(FOTO);
  const plantilla = await readFile(PLANTILLA);

  assert.equal(
    huella(textos, foto, plantilla),
    lock.huella,
    "Cambió el dataset, la foto o la plantilla, y `public/og.jpg` sigue siendo el de antes.\n" +
      "Corré `pnpm run og:local` y commiteá el JPEG junto con og.lock.json.",
  );
});

test("los textos de la tarjeta salen del dataset", async () => {
  // No alcanza con que la huella cierre: si alguien edita el lock a mano para
  // silenciar el test anterior, esto lo vuelve a agarrar contra la fuente real.
  assert.deepEqual(lock.textos, await textosOg());
});

test("la landing publica og:image absoluta y con sus medidas", () => {
  // Absoluta y no relativa: ningún scraper resuelve rutas relativas, y una
  // `og:image` que no se puede pedir es lo mismo que no tenerla.
  const imagen = landing.match(/<meta property="og:image" content="([^"]+)"/);
  assert.ok(imagen, "falta og:image en la landing");
  assert.match(imagen[1], /^https?:\/\/\S+\/og\.jpg$/, `og:image no es absoluta: ${imagen[1]}`);

  // LinkedIn y Slack reservan el hueco con estas dos antes de bajar la imagen.
  // Sin ellas la tarjeta salta de tamaño cuando termina de cargar.
  assert.match(landing, new RegExp(`<meta property="og:image:width" content="${OG_ANCHO}"`));
  assert.match(landing, new RegExp(`<meta property="og:image:height" content="${OG_ALTO}"`));
  assert.match(landing, /<meta property="og:image:alt" content="[^"]+"/, "og:image sin alt");
});

test("Twitter pide la tarjeta grande, no la chica", () => {
  // `summary` reserva un cuadrado chico al costado del texto. Ahora que hay
  // imagen de 1.91:1, la que corresponde es `summary_large_image`: si quedara
  // en `summary`, Twitter recortaría la tarjeta a un cuadradito.
  assert.match(landing, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(landing, /<meta name="twitter:image" content="https?:\/\/\S+\/og\.jpg"/);
});

test("/cv sigue sin emitir etiquetas sociales", async () => {
  // El opt-in de `Base.astro` ya lo cubre y `landing-unica.check.ts` también,
  // pero la imagen es nueva: si alguien la agrega como default del layout, /cv
  // pasaría a ser compartible sin que nadie lo decida.
  const cv = await readFile(join("dist", "cv", "index.html"), "utf8");
  assert.doesNotMatch(cv, /og:image/, "/cv emite og:image y no debería");
});

test("el favicon dibuja el mismo aro que src/lib/marca.ts", async () => {
  // El favicon es un archivo estático: no puede importar el módulo, así que su
  // `d=` es la única copia de esa geometría fuera de `marca.ts`. Esto es lo que
  // impide que se separen — ajustás la curva en un lado y el ícono de la
  // pestaña se queda con la vieja para siempre.
  const favicon = await readFile("public/favicon.svg", "utf8");
  assert.ok(
    favicon.includes(ARO_PATH),
    "public/favicon.svg no dibuja el aro de src/lib/marca.ts. Copiá ARO_PATH ahí.",
  );
});

test("el favicon parsea como XML", async () => {
  // Un SVG que se carga como imagen se parsea en XML ESTRICTO, y XML prohíbe
  // dos guiones seguidos adentro de un comentario. Cuando pasa, no hay error
  // visible en ningún lado: no hay consola, no hay 404, el archivo se sirve con
  // 200 y simplemente no aparece el ícono. Eso ya ocurrió una vez, por escribir
  // los nombres de los custom properties en un comentario.
  const favicon = await readFile("public/favicon.svg", "utf8");
  for (const comentario of favicon.match(/<!--[\s\S]*?-->/g) ?? []) {
    assert.ok(
      !comentario.slice(4, -3).includes("--"),
      "Hay un comentario con dos guiones seguidos en public/favicon.svg.\n" +
        "XML lo prohíbe y el favicon deja de renderizar sin avisar.",
    );
  }
});
