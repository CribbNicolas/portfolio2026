/**
 * Sirve `dist/` y le pide a Chromium que imprima `/cv` en `dist/cv.pdf`.
 *
 * YA NO forma parte de `pnpm run build`. El PDF de producción lo genera
 * `functions/cv.pdf.ts` a demanda; esto existe para dos cosas: mirar el PDF en
 * local sin deployar, y producir el archivo contra el que corre
 * `pnpm run test:pdf` ANTES de que se publique nada. Es el gate pre-deploy, no
 * el generador del entregable.
 *
 * Se sirve por HTTP y no por `file://` porque las rutas absolutas de los assets
 * (`/_astro/...`) no resuelven desde el sistema de archivos, y el PDF saldría
 * sin fuentes ni estilos.
 *
 * El servidor es de 30 líneas a propósito: agregar una dependencia para esto
 * sería más superficie de mantenimiento que el problema que resuelve.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { renderPdf } from "./render-pdf";

const DIST = "dist";
const SALIDA = join(DIST, "cv.pdf");

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

const servidor = createServer(async (req, res) => {
  // normalize() corta cualquier `..`: el server nunca sale de dist/.
  const ruta = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const candidatos = [join(DIST, ruta), join(DIST, ruta, "index.html")];

  for (const archivo of candidatos) {
    try {
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { "content-type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
      res.end(cuerpo);
      return;
    } catch {
      // Probamos el siguiente candidato.
    }
  }

  res.writeHead(404).end("no encontrado");
});

await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
const { port } = servidor.address() as { port: number };

try {
  await renderPdf({ url: `http://127.0.0.1:${port}/cv`, out: SALIDA });
  console.log(`PDF escrito en ${SALIDA}`);
} finally {
  servidor.close();
}
