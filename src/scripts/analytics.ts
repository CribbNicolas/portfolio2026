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
 * Starts Clarity when a project is configured.
 *
 * It never throws: the package's `injectScript` wraps everything in a try/catch
 * that returns silently. That is why it can be called before the rest of the
 * boot with no risk of an analytics failure taking the map down with it.
 */
export function startAnalytics(): void {
  if (!ID) return;
  Clarity.init(ID);
}
