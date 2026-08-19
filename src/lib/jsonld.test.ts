/**
 * El JSON-LD se genera del dataset, nunca se escribe a mano: uno escrito a mano
 * se desincroniza del CV en el primer cambio, que es justo lo que este sistema
 * existe para impedir.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "../../content/source/index";
import { buildPersonJsonLd } from "./jsonld";

const SITE = new URL("https://ejemplo.test");

test("emite un Person con @id estable", async () => {
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE);

  assert.equal(ld["@type"], "Person");
  assert.equal(ld["@id"], "https://ejemplo.test/#person");
  assert.equal(ld.name, view.identity.fullName);
});

test("jobTitle usa searchTitle, no brandTitle", async () => {
  // Product Engineer es la marca; Desarrollador Full Stack es lo que se busca.
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE);

  assert.equal(ld.jobTitle, view.identity.searchTitle);
  assert.notEqual(ld.jobTitle, view.identity.brandTitle);
});

test("sameAs trae los perfiles externos", async () => {
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE) as { sameAs: string[] };

  assert.ok(ld.sameAs.some((u) => u.includes("github.com")));
  assert.ok(ld.sameAs.some((u) => u.includes("linkedin.com")));
});

test("regla 8: no filtra streetAddress ni teléfono", async () => {
  const view = await content.getView("public-api", "es");
  const serializado = JSON.stringify(buildPersonJsonLd(view, SITE));

  assert.ok(!serializado.includes("streetAddress"));
  assert.ok(!serializado.includes("telephone"));
});
