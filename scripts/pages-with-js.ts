/**
 * The pages allowed to ship client JavaScript.
 *
 * Pulled out of `no-client-js.check.ts` so `bundle-budget.check.ts` can import
 * it too. "Which pages may load a script" and "which pages get a byte
 * ceiling" are the same question asked from two angles, and until this file
 * existed they had two separate answers: the byte check hard-coded
 * `dist/index.html` and never learned about `/en/`, so the second landing
 * shipped with no ceiling at all (docs/07-technical-debt.md #37). A plain
 * constant module, not a `.check.ts`: importing a file that calls `test()` at
 * the top level would register its tests a second time in whichever check
 * imports it.
 */
export const PAGES_WITH_JS: ReadonlySet<string> = new Set(["index.html", "en/index.html"]);
