/**
 * Los workflows de CI son YAML válido y declaran un disparador.
 *
 * Existe por un fallo real, el 2026-08-25: un carácter CR literal se coló en
 * medio de una línea de `smoke-deploy.yml`. El parser lo leyó como salto de
 * línea, el archivo dejó de ser YAML válido, y GitHub marcó cada corrida como
 * fallida SIN JOBS. O sea: el gate que verifica el PDF publicado estuvo tres
 * commits sin correr, y desde la lista de Actions se veía igual que cualquier
 * otro fallo.
 *
 * Ese es el modo de falla que este check ataja: un workflow roto no se anuncia
 * como roto, se anuncia como "algo falló". Y un gate que no corre es peor que
 * no tener gate, porque igual da la sensación de estar cubierto.
 *
 * NO valida el esquema de GitHub Actions —eso necesitaría actionlint y un
 * binario externo—. Valida lo que se rompe de verdad al editar estos archivos
 * a mano o con un script.
 *
 * Las dos capas son necesarias por separado: medido sobre el caso real, un CR
 * incrustado NO siempre hace fallar al parser. A veces rompe el YAML y a veces
 * sólo deja una línea que se comporta distinto de como se lee. Por eso el CR se
 * busca a mano además de parsear.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const DIR = ".github/workflows";
const archivos = readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

test("hay workflows que verificar", () => {
  // Si alguien renombra el directorio, los otros tests pasarían por vacíos.
  assert.ok(archivos.length > 0, `no se encontró ningún workflow en ${DIR}`);
});

for (const archivo of archivos) {
  const ruta = join(DIR, archivo);
  const crudo = readFileSync(ruta, "utf8");

  test(`${archivo}: sin CR sueltos ni tabs`, () => {
    // Un CR fuera de un par CRLF parte la línea para el parser de YAML aunque
    // se vea normal en el editor. Es exactamente el bug que originó el check.
    const lineas = crudo.split(/\r?\n/);
    lineas.forEach((linea, i) => {
      assert.ok(
        !linea.includes("\r"),
        `${ruta}:${i + 1} tiene un CR en el medio de la línea: parte el YAML sin verse`,
      );
      assert.ok(!linea.includes("\t"), `${ruta}:${i + 1} tiene un tab; YAML no admite tabs`);
    });
  });

  test(`${archivo}: parsea como YAML`, () => {
    // El mensaje del parser trae línea y columna: se propaga entero.
    assert.doesNotThrow(() => parse(crudo), `${ruta} no es YAML válido`);
  });

  test(`${archivo}: declara jobs y un disparador`, () => {
    const doc = parse(crudo) as Record<string, unknown> | null;
    assert.ok(doc && typeof doc === "object", `${ruta} no define un mapa en la raíz`);

    // Verificado: la librería `yaml` usa el esquema core de YAML 1.2, donde
    // `on` es la cadena "on" y no el booleano true (eso es YAML 1.1). Se acepta
    // igual la forma booleana porque no cuesta nada y el día que se cambie de
    // parser el check no se vuelve un falso positivo silencioso.
    const disparador = "on" in doc || "true" in doc;
    assert.ok(disparador, `${ruta} no declara \`on:\``);

    const jobs = doc["jobs"];
    assert.ok(
      jobs && typeof jobs === "object" && Object.keys(jobs).length > 0,
      `${ruta} no declara ningún job`,
    );
  });
}
