/**
 * The pages allowed to ship client JavaScript, and why each one.
 *
 * Pulled out of `no-client-js.check.ts` so `bundle-budget.check.ts` can import
 * it too. "Which pages may load a script" and "which pages get a byte
 * ceiling" are the same question asked from two angles, and until this file
 * existed they had two separate answers: the byte check hard-coded
 * `dist/index.html` and never learned about `/en/`, so the second landing
 * shipped with no ceiling at all. A plain
 * constant module, not a `.check.ts`: importing a file that calls `test()` at
 * the top level would register its tests a second time in whichever check
 * imports it.
 *
 * Adding a page here is a decision that shows up in a diff, never the fix for
 * a failing `test:js`. `/cv` and `/en/cv` never belong here: the PDF is
 * printed from them.
 */

/**
 * The landing: scroll-driven chapters (GSAP, ScrollTrigger, Lenis, held
 * scenes). This is CLAUDE.md invariant 7's one exception: these pages, and
 * only these, may listen for `wheel`/`touchmove` and hold the scroll, and
 * they carry the one inline script the CSP allows (`src/lib/landing-head.ts`).
 */
export const SCROLL_DRIVEN_PAGES: ReadonlySet<string> = new Set(["index.html", "en/index.html"]);

/**
 * Every page that may load a script: the landing, plus the brief view
 * (`/brief`, `/en/brief`): its animated background and reveal-on-enter
 * fades, plus the analytics. The brief view gets no scroll exception.
 */
export const PAGES_WITH_JS: ReadonlySet<string> = new Set([
  ...SCROLL_DRIVEN_PAGES,
  "brief/index.html",
  "en/brief/index.html",
]);
