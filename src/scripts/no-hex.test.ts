/**
 * Zero hex colors in client code.
 *
 * Every color the browser scripts paint with (the landing's map and morph,
 * the brief view's field) is read from the CSS tokens at runtime
 * (`getComputedStyle(...).getPropertyValue("--accent")`), never written into
 * the script. A hex in a script is a second copy of the palette that the next
 * palette change misses — it happened with the terracotta → violet move,
 * where only the hand-copied places (favicon, OG card) needed touching.
 *
 * Comments are stripped first: talking about "#131417" in a comment is fine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, ".");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// A hex color inside a string or template literal: #rgb, #rrggbb, #rrggbbaa.
const HEX = /["'`][^"'`\n]*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

test("no client script writes a hex color", () => {
  const offenders = files(ROOT).filter((f) => HEX.test(stripComments(readFileSync(f, "utf8"))));
  assert.deepEqual(
    offenders.map((f) => relative(ROOT, f)),
    [],
    "read the color from the tokens (getComputedStyle on --accent, --ink…) instead of writing it",
  );
});

test("the detector catches what it is for", () => {
  assert.ok(HEX.test(`ctx.fillStyle = "#5e4bc4";`));
  assert.ok(HEX.test("const c = `rgb from #a99bf0`;"));
  assert.ok(!HEX.test(stripComments(`// the old accent was #e2825f\nconst x = 1;`)));
  assert.ok(!HEX.test(`const href = "#top";`));
});
