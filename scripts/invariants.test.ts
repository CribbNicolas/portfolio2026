/**
 * Invariant 1, enforced instead of trusted.
 *
 * `resolveView` is the only place that decides what a surface shows. The
 * frontend receives resolved lists: a `.filter(v => v.visibility...)` or a
 * `.priority` comparison inside `src/` means that logic forked, and a forked
 * rule is one that will diverge — the CV and the landing would start disagreeing
 * about which achievements exist, silently.
 *
 * This started as criterion 5 of `docs/superpowers/plans/2026-08-13-cv-como-sistema.md`,
 * a `grep` to paste into a terminal. A criterion that does not run on its own is
 * an intention, which is exactly what CONTRACT.md says we do not do
 * (`07-technical-debt.md` §12).
 *
 * It IS a `*.test.ts`: it reads sources, not `dist/`, so it needs no build and
 * runs in `pnpm test` with everything else.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const SRC = "src";

/** Every `.ts` and `.astro` under `src/`. */
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(p)));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".astro")) out.push(p);
  }
  return out;
}

const files = await sources(SRC);

test("there are sources to check", () => {
  // If `src/` moves, the test below would pass by being empty.
  assert.ok(files.length > 0, `no .ts or .astro found under ${SRC}/`);
});

test("invariant 1: nothing in src/ filters by visibility or priority", async () => {
  // Property access, not the bare word: `visibility` also appears in prose and
  // in CSS (`visibility: hidden`), and neither is a filter.
  const pattern = /\.(visibility|priority)\b/g;

  const offenders: string[] = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    src.split("\n").forEach((line, i) => {
      // A comment naming the invariant is not a violation of it.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (pattern.test(code)) {
        offenders.push(`${relative(SRC, file).split(sep).join("/")}:${i + 1}  ${line.trim()}`);
      }
      pattern.lastIndex = 0;
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "visibility logic leaked into the frontend:\n  " + offenders.join("\n  ") +
      "\n\nAll of it belongs in content/schema/resolve-view.ts. The components " +
      "receive resolved props and filter nothing (invariant 1).",
  );
});

test("invariant 3: nothing in src/ computes durations by hand", async () => {
  // Rule 1 says every duration derives from `dates.ts`. The validator catches
  // hand-written durations in the DATA; this catches them in the CODE, which is
  // the other half and had nothing guarding it.
  //
  // It looks for the arithmetic, not for the word: `* 12`, `/ 12` and `getMonth`
  // over a date are how a month calculation is spelled.
  const pattern = /(getMonth\(\)|getFullYear\(\)\s*\*\s*12|\*\s*12\s*\+|\/\s*12\b)/;

  const offenders: string[] = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    src.split("\n").forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (pattern.test(code)) {
        offenders.push(`${relative(SRC, file).split(sep).join("/")}:${i + 1}  ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "a duration is being computed in the frontend:\n  " + offenders.join("\n  ") +
      "\n\nIt derives from content/schema/dates.ts (rule 1). If this is a false " +
      "positive — arithmetic that has nothing to do with dates — narrow the " +
      "pattern here and say why.",
  );
});
