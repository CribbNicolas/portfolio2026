import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfFilename } from "./pdf-filename";

test("the name carries surname, name, CV and the date of the data", () => {
  assert.equal(
    pdfFilename("es", "2026-09-02T18:23:48.650Z"),
    "Cribb_Nicolas_CV_2026-09-02.pdf",
  );
});

test("the English one is told apart before the date", () => {
  // Told apart at all, because both land in the same Downloads folder. Before
  // the date, so the two sort next to each other rather than by language.
  assert.equal(
    pdfFilename("en", "2026-09-02T18:23:48.650Z"),
    "Cribb_Nicolas_CV_EN_2026-09-02.pdf",
  );
});

test("only the date part of the timestamp is used", () => {
  assert.match(pdfFilename("es", "2026-01-05T00:00:00.000Z"), /_2026-01-05\.pdf$/);
});

test("the name needs no URL escaping", () => {
  // It travels in a `content-disposition` header and in a `download`
  // attribute. A space becomes %20 in one of them and a mangled name in some
  // mail clients, which is why the separator is an underscore.
  for (const locale of ["es", "en"] as const) {
    assert.match(pdfFilename(locale, "2026-09-02T18:23:48.650Z"), /^[A-Za-z0-9_.-]+$/);
  }
});

test("it fits where it is actually read", () => {
  // An ATS list and a mail client truncate around 30-35 visible characters.
  // The name this replaced was 47 and got cut exactly at the role.
  assert.ok(pdfFilename("en", "2026-09-02T00:00:00.000Z").length <= 35);
});

test("a timestamp it cannot read is a throw, not a wrong name", () => {
  // Silently emitting `Cribb_Nicolas_CV_Invalid_Date.pdf` is worse than a build
  // that stops: the file would go out to a recruiter under that name.
  assert.throws(() => pdfFilename("es", "not-a-date"), /updatedAt/);
});
