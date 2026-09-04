/**
 * Microsoft Clarity. Heatmaps, scroll depth and session recordings.
 *
 * What gets bundled from here is ~800 bytes: `@microsoft/clarity` is a wrapper
 * that injects `<script async src="https://www.clarity.ms/tag/<id>">` and then
 * delegates everything to `window.clarity(...)`. The real payload is served
 * from `clarity.ms`, so it does not count against `CRITICAL_BUDGET_KB` in
 * `bundle-budget.check.ts` — which measures chunks in `dist/_astro/`.
 *
 * The package was chosen over the inline snippet for two concrete reasons: it
 * ships types, and `init()` checks `getElementById("clarity-script")` before
 * injecting, so calling it twice does not duplicate the tag.
 *
 * It is called ONLY from `src/pages/index.astro`. Never from `Base.astro`:
 * `/cv` has to stay at zero JavaScript because Browser Rendering prints the PDF
 * from there, and a third-party script would change the render with nobody
 * noticing. `no-client-js.check.ts` verifies that across all of `dist/`.
 *
 * This file does NOT import from `@content`, like everything in
 * `src/scripts/`: `json-source.ts` drags zod and the whole dataset into the
 * browser.
 *
 * NO Subresource Integrity, and not by oversight: the `clarity.ms` tag is an
 * artifact Microsoft updates server-side, so a fixed hash would break it on the
 * first new version. What does bound the risk is where it runs: only on the
 * landing, never on `/cv`, and the landing has no forms and no credentials a
 * compromised script could take.
 */

import Clarity from "@microsoft/clarity";

/**
 * Vite inlines this at build time. An undefined `PUBLIC_` stays `undefined`,
 * and then Clarity is never called: in `pnpm run dev` and in any build without
 * the variable, the analytics simply do not exist.
 *
 * The ID is not a secret — it travels in the HTML of every visit — but it is
 * read from a variable anyway, so changing project does not touch code.
 */
const ID: string | undefined = import.meta.env.PUBLIC_CLARITY_ID;

/**
 * Events that count as "somebody is actually here". `scroll` is the one that
 * fires for almost every real visit, including the reader who never clicks;
 * the pointer and keyboard ones are what a phone and a keyboard user hit
 * first. All passive: none of them is being cancelled, and saying so keeps
 * them off the scroll's critical path.
 */
const WAKE_EVENTS = ["scroll", "pointerdown", "keydown", "touchstart"] as const;

/**
 * Starts Clarity on the visitor's first interaction, not on load.
 *
 * Clarity is not one script: the tag pulls `clarity.js` (~26 KB) and then
 * writes eight third-party cookies, `MUID` and `MR` on `bing.com` among them.
 * Paid at load, that is bytes and cookies spent on every bounce — and it is
 * the whole distance between this page's Lighthouse Best Practices and the
 * 100 that `/cv`, which has no analytics, already scores. Behind the first
 * interaction the cost lands only on visits that turned into something, and
 * the recordings still cover every session where anything happened.
 *
 * Not a consent banner, and not pretending to be one: it changes WHEN the
 * measurement starts, not what it collects. The privacy line in the footer
 * says what Clarity does either way.
 *
 * `init` never throws — the package's `injectScript` wraps everything in its
 * own try/catch — so this cannot take the map down with it.
 */
export function startAnalytics(): void {
  const id = ID;
  if (!id) return;

  const fire = (): void => {
    // The fired listener removed itself (`once`); these are the others.
    for (const type of WAKE_EVENTS) removeEventListener(type, fire);
    Clarity.init(id);
  };

  for (const type of WAKE_EVENTS) {
    addEventListener(type, fire, { passive: true, once: true });
  }
}
