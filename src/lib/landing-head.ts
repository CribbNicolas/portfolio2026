/**
 * The landing's inline head script, run before the first paint:
 *
 * - `js` on <html>: the chapters' CSS keys on it, and without it (no script)
 *   the page lays out still (v2.css).
 * - `data-build`: this deploy's id, read from <meta name="build-id"> (the
 *   commit Cloudflare builds, "local" otherwise), what the loader's "seen"
 *   flag is stamped with.
 * - `seen` on <html> when this browser already watched the loader for THIS
 *   build: the CSS hides the loader before it can flash, and main.ts skips
 *   it. A new deploy, a new id: the loader shows once more.
 *
 * The script is a CONSTANT on purpose: the CSP in `public/_headers` allows
 * no inline script except this one, by its sha256. A build id inside the
 * script would change the hash on every deploy; in the <meta> it does not.
 * `scripts/no-client-js.check.ts` recomputes the hash and fails when the two
 * drift.
 *
 * Nothing here touches `process` or the file system: `src/scripts/v2/main.ts`
 * imports `LOADER_KEY` from this file, so it ends up in the browser bundle.
 */

/** localStorage key; main.ts writes it when the loader finishes. */
export const LOADER_KEY = "landing:loader";

/** The <meta name> that carries the build id. */
export const BUILD_META = "build-id";

export const LANDING_HEAD_SCRIPT =
  `(function(){var h=document.documentElement;h.classList.add("js");` +
  `var m=document.querySelector('meta[name="${BUILD_META}"]');var id=m&&m.content;if(!id)return;h.dataset.build=id;` +
  `try{if(localStorage.getItem(${JSON.stringify(LOADER_KEY)})===id)h.classList.add("seen")}catch(e){}})();`;
