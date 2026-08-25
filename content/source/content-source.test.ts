/**
 * Tests del contrato de contenido. Corren en CI (`npm test`).
 *
 * Verifican las reglas que se rompen EN SILENCIO: las 7 y 8 no las valida el
 * schema, viven en `resolveView`. El día que alguien escriba `sanity-source.ts`
 * y se olvide de delegar, estos tests son lo único que lo caza antes de publicar
 * un `streetAddress` o un teléfono donde no va.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "./index";
import { resolveView } from "../schema/resolve-view";
import { validateDataset } from "../schema/validation";
import { formatMetric } from "../schema/format-metric";
import datasetEs from "../data/content.es.json";

test("regla 8: phone solo en las superficies de publishPhoneOn", async () => {
  // El dataset real ya no lleva teléfono (decisión del 2026-08-25, al hacer el
  // repo público). Antes este test leía el número de ahí, y por eso dependía de
  // un dato que no tiene por qué existir: el día que se sacara, iba a fallar
  // por la razón equivocada — "falta el teléfono" en vez de "el filtro se
  // rompió".
  //
  // Ahora el número se inyecta acá, obviamente falso, y se verifica el FILTRO,
  // que es lo que la regla 8 promete. La maquinaria sigue testeada aunque el
  // campo esté vacío, así que volver a cargar un teléfono mañana no necesita
  // tocar nada.
  const base = await content.getDataset("es");
  const conTelefono = {
    ...base,
    identity: {
      ...base.identity,
      contact: {
        ...base.identity.contact,
        phone: "+00 0 000 000-0000",
        publishPhoneOn: ["cv" as const],
      },
    },
  };

  const cv = resolveView(conTelefono, "cv"); // cv ∈ publishPhoneOn
  assert.equal(
    cv.identity.contact.phone,
    "+00 0 000 000-0000",
    "phone debería salir en una superficie listada en publishPhoneOn",
  );

  const pub = resolveView(conTelefono, "public-api"); // no ∈ publishPhoneOn
  assert.equal(pub.identity.contact.phone, undefined, "phone NO debe salir en public-api");
});

test("regla 8: hoy el dataset no lleva teléfono, y ninguna superficie lo publica", () => {
  // Ancla la decisión: si alguien vuelve a cargar un número, este test le
  // recuerda que el repo es público y que el dato entra al historial de git,
  // donde no se puede sacar sin reescribirlo.
  // `in` y no `.phone`: al no estar la clave en el JSON, TypeScript ya no la
  // declara en el tipo inferido y leerla no compila. Que el compilador también
  // lo note es una garantía extra, no un obstáculo.
  assert.ok(
    !("phone" in datasetEs.identity.contact),
    "el dataset volvió a tener teléfono: el repo es público, eso queda en el historial",
  );
  assert.deepEqual(
    datasetEs.identity.contact.publishPhoneOn,
    [],
    "publishPhoneOn dejó de estar vacío sin que haya teléfono que publicar",
  );
});

test("regla 8: streetAddress nunca sale en ninguna superficie", async () => {
  for (const surface of ["cv", "cv-ats", "portfolio", "public-api"] as const) {
    const view = await content.getView(surface, "es");
    assert.equal(
      view.identity.location.streetAddress,
      undefined,
      `streetAddress no debe salir en ${surface}`,
    );
  }
});

test("regla 7: cv-short corta más agresivo que portfolio", async () => {
  const short = await content.getView("cv-short", "es");
  const portfolio = await content.getView("portfolio", "es");
  const bullets = (v: typeof short) =>
    v.experience.reduce((n, r) => n + r.achievements.length, 0);
  assert.ok(
    bullets(short) <= bullets(portfolio),
    "cv-short no puede tener más bullets que portfolio",
  );
});

test("strict: una clave desconocida en el dataset tira error, no se descarta", () => {
  // Sin `.strict()` en los schemas Zod, un campo que existe en el JSON pero no en
  // el schema se dropea en silencio. Esto lo bloquea: si alguien agrega un campo a
  // una interface y se olvida del schema, el dato con ese campo revienta acá.
  const conBasura = structuredClone(datasetEs) as Record<string, unknown>;
  (conBasura.identity as Record<string, unknown>).campoInventado = "x";
  assert.throws(() => validateDataset(conBasura), /Unrecognized key|campoInventado/i);
});

test("locale sin dataset tira error, no devuelve otro en silencio", async () => {
  await assert.rejects(
    () => content.getView("cv", "en"),
    /Locale no soportado/,
  );
});

// Regla 4: una Metric `estimated` se renderiza con "~" o "aprox.".
// Este test estuvo en `todo` hasta que existió `formatMetric`. La cobertura
// completa vive en `content/schema/format.test.ts`; acá queda el caso mínimo
// porque este archivo es el que documenta las reglas que el schema no valida.
test("regla 4: Metric estimated se renderiza con ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" });
  assert.match(String(out), /~|aprox\./);
});
