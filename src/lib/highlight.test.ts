import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFigures } from "./highlight";

const figures = (s: string) => splitFigures(s).filter((p) => p.figure).map((p) => p.text);

test("figures keep their estimate mark and their unit", () => {
  assert.deepEqual(figures("bajó de ~5 s a ~500 ms en un Web Worker"), ["~5 s", "~500 ms"]);
  assert.deepEqual(figures("~13.000 distritos; el JSON pesa 7 MB"), ["~13.000", "7 MB"]);
  assert.deepEqual(figures("~13,000 school districts"), ["~13,000"]);
});

test("versions and dates are figures; a trailing period is not", () => {
  assert.deepEqual(figures("Plugin en producción (v1.1.30)."), ["v1.1.30"]);
  assert.deepEqual(figures("Publicado el 29/10/2025."), ["29/10/2025"]);
});

test("a word that starts like a unit is not one", () => {
  assert.deepEqual(figures("Suite de 19 specs"), ["19"]);
});

test("a digit inside a name or a bare single digit is not a figure", () => {
  assert.deepEqual(figures("Construí en Vue 3 el frontend"), []);
  assert.deepEqual(figures("El renderer se publica a S3"), []);
  assert.deepEqual(figures("50 estados"), ["50"]);
});

test("skipped digits stay in the text", () => {
  const s = "Vue 3 y ~5 s en S3.";
  assert.equal(splitFigures(s).map((p) => p.text).join(""), s);
});

test("the parts put the sentence back together exactly", () => {
  const s = "Publicado el 29/10/2025 con ~13.000 distritos y 50 estados.";
  assert.equal(splitFigures(s).map((p) => p.text).join(""), s);
});

test("no digits, one plain part", () => {
  assert.deepEqual(splitFigures("Sin números acá"), [{ text: "Sin números acá", figure: false }]);
});
