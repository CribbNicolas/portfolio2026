/**
 * Runs `pdf-output.check.ts` once per locale. This is `pnpm run test:pdf`'s
 * entry point.
 *
 * The name deliberately avoids every shape `node:test`'s default discovery
 * matches (`*.test.*`, `test-*`, `test_*`, `*-test.*`, `*_test.*`, bare
 * `test.*`, anything under a `test/` folder) — `test-pdf.ts` does not, and
 * `pnpm test` silently ran it as a test file the first time, spawning
 * `pdf-output.check.ts` against whatever `dist/` happened to contain instead
 * of leaving that to `test:pdf`, which is exactly the failure mode
 * `pdf-output.check.ts`'s own header comment already warns about for itself.
 *
 * `PDF_LOCALE` is an env var, not a CLI flag, to match how `PDF_SOURCE` already
 * works. Two separate `tsx --test` processes rather than importing the check
 * file twice in one process: `node:test` registers every `test()` at import
 * time, and ESM's module cache turns a second `import()` of the same path into
 * a no-op — it would silently re-run the FIRST locale's assertions twice
 * instead of covering both.
 *
 * The child's env is set through `spawnSync`'s `env` option, never a shell
 * `VAR=value` prefix written into `package.json`: that syntax means two
 * different things on `cmd.exe` and on a POSIX shell, and this repo's CI and
 * this repo's author's machine are not the same one.
 *
 * `PDF_SOURCE`, when the caller sets it (the smoke, verifying a published
 * deploy), names the SPANISH pdf — `https://…/cv.pdf`, unchanged since before
 * locales existed. The English URL is derived from it with `sourcePath`, the
 * same function the Function itself uses to decide which page to print: the
 * PDF route is always that path plus `.pdf`. Deriving it here means the smoke
 * workflow does not need to know that rule too and keep it in sync by hand.
 */

import { spawnSync } from "node:child_process";
import type { Locale } from "../content/schema/content-schema";
import { sourcePath } from "../functions/_pdf";

const LOCALES: readonly Locale[] = ["es", "en"];

/** `https://host/cv.pdf` -> `https://host`. Only the Spanish shape is ever handed in. */
function originOf(esPdfUrl: string): string {
  const suffix = `${sourcePath("es")}.pdf`; // "/cv.pdf"
  if (!esPdfUrl.endsWith(suffix)) {
    throw new Error(`PDF_SOURCE "${esPdfUrl}" does not end in "${suffix}" — cannot derive the English URL from it.`);
  }
  return esPdfUrl.slice(0, -suffix.length);
}

// Run checks for both locales and collect results. One CI run should tell you
// about both languages, not require a fix-and-retry loop to learn which one
// is broken. Exit with the first non-zero status if either failed.
let firstFailure = 0;

for (const locale of LOCALES) {
  console.log(`\n— pdf-output.check.ts (PDF_LOCALE=${locale}) —`);

  const env: NodeJS.ProcessEnv = { ...process.env, PDF_LOCALE: locale };
  // With no PDF_SOURCE, `pdf-output.check.ts` falls back to its own per-locale
  // default (`dist/cv.pdf` / `dist/en/cv.pdf`) — leave it alone in that case.
  if (process.env.PDF_SOURCE) {
    env.PDF_SOURCE = `${originOf(process.env.PDF_SOURCE)}${sourcePath(locale)}.pdf`;
  }

  // A single command string, not a command + args array, under `shell: true`:
  // Node warns (DEP0190) that array args are concatenated rather than escaped
  // in that combination. Every token here is a fixed literal, never user
  // input, so there is nothing to escape — but the warning is silenced by
  // giving it nothing to warn about.
  const result = spawnSync("pnpm exec tsx --test scripts/pdf-output.check.ts", {
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !firstFailure) {
    firstFailure = result.status ?? 1;
  }
}

if (firstFailure) {
  process.exit(firstFailure);
}
