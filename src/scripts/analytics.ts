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
 * It is called ONLY from `src/components/Analytics.astro`, which only the
 * reader-facing pages use (the landings and the brief views). Never from
 * `Base.astro`:
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
 * Clarity is not one script: the tag pulls `clarity.js` (~26 KB). With
 * consent granted it would also write eight third-party cookies (`MUID` and
 * `MR` on `bing.com` among them); see below for why it never is.
 * Paid at load, that is bytes spent on every bounce — and it is
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
 * own try/catch — so this cannot take the page down with it.
 *
 * Cookieless, for every visitor (author, 2026-10-29): consent is declared
 * DENIED for both storages right after `init`, so Clarity writes no
 * first-party cookie (`_clck`, `_clsk`) and still records heatmaps and
 * sessions over `/collect` (learn.microsoft.com/clarity/consent-mode).
 * That is what makes a consent banner unnecessary for EU visitors. The cost
 * is recognising a returning visitor, which a one-page site barely uses.
 * The call goes through the queue `init` sets up, so it lands before the tag
 * itself has loaded.
 *
 * This call ALONE is not enough. Measured on production, 2026-10-30: the tag
 * and its sync pixels (`c.gif`) still set third-party cookies (`CLID`,
 * `MUID`, `MR`, `SM`, `ANONCHK` on clarity.ms; `MUID`, `MR`, `SRM_B` on
 * bing.com), whatever the consent said or when. What stopped them is the
 * Clarity project's own setting: Settings → Setup → Advanced → Cookies OFF.
 * Turning it back on makes the footer's "sin cookies" false.
 */
export function startAnalytics(): void {
  const id = ID;
  if (!id) return;

  const fire = (): void => {
    // The fired listener removed itself (`once`); these are the others.
    for (const type of WAKE_EVENTS) removeEventListener(type, fire);
    Clarity.init(id);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "denied" });
  };

  for (const type of WAKE_EVENTS) {
    addEventListener(type, fire, { passive: true, once: true });
  }
}
