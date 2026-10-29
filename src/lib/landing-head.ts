/**
 * The landing's inline head script, run before the first paint:
 *
 * - `js` on <html>: the chapters' CSS keys on it, and without it (no script)
 *   the page lays out still (v2.css).
 * - `data-build`: this deploy's id (the commit Cloudflare builds, "local"
 *   otherwise), what the loader's "seen" flag is stamped with.
 * - `seen` on <html> when this browser already watched the loader for THIS
 *   build: the CSS hides the loader before it can flash, and main.ts skips
 *   it. A new deploy, a new id: the loader shows once more.
 *
 * Plain JS in a string, not a module: it has to run synchronously in <head>.
 * Nothing here touches `process` or the file system: `src/scripts/v2/main.ts`
 * imports `LOADER_KEY` from this file, so it ends up in the browser bundle.
 * The build id is passed in by the page (`process.env.CF_PAGES_COMMIT_SHA`,
 * the same value `build.json` serves).
 */

/** localStorage key; main.ts writes it when the loader finishes. */
export const LOADER_KEY = "landing:loader";

export function landingHeadScript(build: string): string {
  const id = JSON.stringify(build);
  const key = JSON.stringify(LOADER_KEY);
  return (
    `(function(){var h=document.documentElement;h.classList.add("js");h.dataset.build=${id};` +
    `try{if(localStorage.getItem(${key})===${id})h.classList.add("seen")}catch(e){}})();`
  );
}
