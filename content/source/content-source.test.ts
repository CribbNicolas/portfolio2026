/**
 * Tests of the content contract. They run in CI (`pnpm test`).
 *
 * They cover the rules that break SILENTLY: 7 and 8 are not validated by the
 * schema, they live in `resolveView`. The day someone writes `sanity-source.ts`
 * and forgets to delegate, these tests are the only thing that catches it
 * before a `streetAddress` or a phone number gets published where it must not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Locale } from "../schema/content-schema";
import { content } from "./index";
import { resolveView } from "../schema/resolve-view";
import { validateDataset } from "../schema/validation";
import { formatMetric } from "../schema/format-metric";
import datasetEs from "../data/content.es.json";

test("rule 8: phone only on the surfaces in publishPhoneOn", async () => {
  // The real dataset no longer carries a phone number (decided 2026-08-25, when
  // the repo went public). This test used to read the number from there, which
  // made it depend on a datum that has no reason to exist: the day it was
  // removed it would have failed for the wrong reason — "the phone is missing"
  // instead of "the filter broke".
  //
  // The number is now injected here, obviously fake, and what gets verified is
  // the FILTER, which is what rule 8 promises. The machinery stays tested even
  // with the field empty, so loading a phone number again tomorrow needs no
  // change here.
  const base = await content.getDataset("es");
  const withPhone = {
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

  const cv = resolveView(withPhone, "cv"); // cv ∈ publishPhoneOn
  assert.equal(
    cv.identity.contact.phone,
    "+00 0 000 000-0000",
    "phone should appear on a surface listed in publishPhoneOn",
  );

  const pub = resolveView(withPhone, "public-api"); // not ∈ publishPhoneOn
  assert.equal(pub.identity.contact.phone, undefined, "phone must NOT appear in public-api");
});

test("rule 8: the dataset carries no phone today, and no surface publishes one", () => {
  // Anchors the decision: if someone loads a number again, this test reminds
  // them the repo is public and the datum enters the git history, where it
  // cannot be removed without rewriting it.
  // `in` and not `.phone`: with the key absent from the JSON, TypeScript no
  // longer declares it in the inferred type and reading it does not compile.
  // Having the compiler notice too is an extra guarantee, not an obstacle.
  assert.ok(
    !("phone" in datasetEs.identity.contact),
    "the dataset has a phone number again: the repo is public, that stays in the history",
  );
  assert.deepEqual(
    datasetEs.identity.contact.publishPhoneOn,
    [],
    "publishPhoneOn stopped being empty with no phone number to publish",
  );
});

test("rule 8: streetAddress never leaves on any surface", async () => {
  for (const surface of ["cv", "cv-ats", "portfolio", "public-api"] as const) {
    const view = await content.getView(surface, "es");
    assert.equal(
      view.identity.location.streetAddress,
      undefined,
      `streetAddress must not appear in ${surface}`,
    );
  }
});

test("rule 7: cv-short cuts harder than portfolio", async () => {
  const short = await content.getView("cv-short", "es");
  const portfolio = await content.getView("portfolio", "es");
  const bullets = (v: typeof short) =>
    v.experience.reduce((n, r) => n + r.achievements.length, 0);
  assert.ok(
    bullets(short) <= bullets(portfolio),
    "cv-short cannot hold more bullets than portfolio",
  );
});

test("strict: an unknown key in the dataset throws instead of being dropped", () => {
  // Without `.strict()` on the Zod schemas, a field present in the JSON but
  // absent from the schema is dropped silently. This blocks it: if someone adds
  // a field to an interface and forgets the schema, data carrying that field
  // blows up right here.
  const withGarbage = structuredClone(datasetEs) as Record<string, unknown>;
  (withGarbage.identity as Record<string, unknown>).campoInventado = "x";
  assert.throws(() => validateDataset(withGarbage), /Unrecognized key|campoInventado/i);
});

test("the English dataset loads and resolves for every surface", async () => {
  const data = await content.getDataset("en");
  assert.equal(data.locale, "en");
  for (const surface of ["cv-ats", "portfolio", "public-api"] as const) {
    const view = await content.getView(surface, "en");
    assert.ok(view.experience.length > 0, `${surface} came out empty in English`);
  }
});

test("a locale with no dataset throws instead of silently returning another", async () => {
  // `es` and `en` both load now, so the loud failure is only reachable through
  // a locale the type does not admit. The cast is the point: it stands in for
  // the third language somebody adds to `Locale` without adding a dataset.
  await assert.rejects(
    () => content.getView("cv", "pt" as Locale),
    /Unsupported locale/,
  );
});

test("the view carries no authoring-only field", async () => {
  // `/cv.json` serializes the whole view, so anything the view holds is
  // published — rendered or not. `visibility` and `priority` are the editorial
  // ranking of your own work; `publishPhoneOn` is a privacy policy; and
  // `Metric.source` is the evidence note written for you to reread before an
  // interview, one of which carries the API URL the number came from.
  const view = await content.getView("public-api", "es");
  const json = JSON.stringify(view);

  for (const key of ['"visibility"', '"priority"', '"publishPhoneOn"', '"source"']) {
    assert.equal(json.includes(key), false, `${key} still leaves in the view`);
  }
});

test("every surface is projected, not just the public one", async () => {
  // A projection applied only to `public-api` is one somebody forgets when a
  // new surface appears. The rule is the view, not the surface.
  for (const surface of ["cv", "cv-short", "cv-ats", "portfolio", "linkedin"] as const) {
    const json = JSON.stringify(await content.getView(surface, "es"));
    assert.equal(json.includes('"visibility"'), false, `${surface} leaks visibility`);
  }
});

// Rule 4: an `estimated` Metric renders with "~" or "aprox.".
// This test sat in `todo` until `formatMetric` existed. Full coverage lives in
// `content/schema/format.test.ts`; the minimal case stays here because this
// file is the one documenting the rules the schema does not validate.
test("rule 4: an estimated Metric renders with ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" }, "es");
  assert.match(String(out), /~|aprox\./);
});
