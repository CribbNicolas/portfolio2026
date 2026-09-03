/**
 * Path stability and the denylist exceptions `i18n.check.ts` cannot see
 * against empty collections.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { ContentDataset, Service } from "../content/schema/content-schema";
import { translatableFields } from "./i18n-fields";
import es from "../content/data/content.es.json";

const dataset = es as never as ContentDataset;

test("reordering identity.links does not change tracked paths", () => {
  const original = translatableFields(dataset);
  assert.ok(original.has("identity.links.github.label"));
  assert.equal(original.has("identity.links.0.label"), false);

  const swapped = structuredClone(dataset);
  swapped.identity.links = [...swapped.identity.links].reverse();
  const after = translatableFields(swapped);
  for (const path of [...original.keys()].filter((p) => p.startsWith("identity.links."))) {
    assert.equal(after.get(path), original.get(path), path);
  }
});

test("languages are keyed by code, not by index", () => {
  const fields = translatableFields(dataset);
  assert.ok(fields.has("languages.es.name"));
  assert.ok(fields.has("languages.en.name"));
  assert.equal(fields.has("languages.0.name"), false);
  assert.equal(fields.has("languages.es.code"), false);
});

test("Service.name is tracked as a title, not dropped as a proper noun", () => {
  const withService = structuredClone(dataset);
  const service: Service = {
    id: "panel",
    name: "Custom dashboard",
    description: { short: "A made-to-measure panel." },
    idealFor: "teams that already have a product",
    deliverables: ["repo"],
    visibility: { priority: 3 },
  };
  withService.services = [service];
  const fields = translatableFields(withService);
  assert.equal(fields.get("services.panel.name"), "Custom dashboard");
});
