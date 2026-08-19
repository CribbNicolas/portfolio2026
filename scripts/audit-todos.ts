/**
 * Reporte de los TODO del dataset que llegan a un output público.
 *
 * NO bloquea el build a propósito. Son datos pendientes conocidos del autor
 * (métricas, outcomes de proyectos, nivel de inglés), y un pipeline en rojo
 * permanente deja de dar señal: a la tercera vez nadie lo mira.
 *
 * Lo que sí bloquea es que un TODO llegue al PDF, y eso lo verifica
 * `scripts/pdf-output.check.ts`, porque el PDF es lo que se manda.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";
const EXTENSIONES = [".html", ".json", ".txt"];

async function* archivos(dir: string): AsyncGenerator<string> {
  for (const entrada of await readdir(dir)) {
    const ruta = join(dir, entrada);
    if ((await stat(ruta)).isDirectory()) yield* archivos(ruta);
    else if (EXTENSIONES.some((ext) => ruta.endsWith(ext))) yield ruta;
  }
}

let encontrados = 0;

for await (const ruta of archivos(DIST)) {
  const contenido = await readFile(ruta, "utf8");
  contenido.split("\n").forEach((linea, i) => {
    if (!linea.includes("TODO")) return;
    encontrados++;
    console.log(`${ruta}:${i + 1}  ${linea.trim().slice(0, 140)}`);
  });
}

console.log(
  encontrados === 0
    ? "\nSin TODOs en los outputs publicados."
    : `\n${encontrados} TODO(s) publicados. No bloquea, pero cada uno es un dato que un lector va a ver.`,
);
