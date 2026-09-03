/**
 * The landing's three section anchors, per locale.
 *
 * `#mapa`/`#proyectos`/`#cv` are addresses, not code — CLAUDE.md says so
 * explicitly for the Spanish ones, and the same reasoning applies to English:
 * an address in a language the reader does not speak is noise. `#cv` stays the
 * same word in both because it is a coincidence of vocabulary, not a reason to
 * special-case it.
 *
 * ONE exported table because two places name these ids and used to do it by
 * hand: `src/pages/index.astro` (the pill nav's `href`s and the sections'
 * `id`s) and `scripts/single-landing.check.ts` (verifying the anchors survive
 * the build). Splitting the id from the href in either place is how they drift.
 *
 * Relative import and NOT the `@content` alias: this module is loaded both by
 * Vite (`.astro` files) and by `tsx` running a `*.check.ts` on its own, which
 * does not resolve the alias. Same reason as `src/lib/jsonld.ts` and
 * `src/lib/lab-hover-css.ts`. It is `import type`, so there is no runtime cost.
 */
import type { Locale } from "../../content/source/index";

export interface LandingAnchors {
  map: string;
  projects: string;
  cv: string;
}

export const ANCHORS: Record<Locale, LandingAnchors> = {
  es: { map: "mapa", projects: "proyectos", cv: "cv" },
  en: { map: "map", projects: "projects", cv: "cv" },
};
