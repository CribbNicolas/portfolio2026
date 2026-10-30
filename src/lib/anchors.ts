/**
 * The landing's three section anchors, per locale.
 *
 * `#mapa`/`#proyectos`/`#cv` are addresses, not code — CLAUDE.md says so
 * explicitly for the Spanish ones, and the same reasoning applies to English:
 * an address in a language the reader does not speak is noise. `#cv` stays the
 * same word in both because it is a coincidence of vocabulary, not a reason to
 * special-case it.
 *
 * On the landing (`components/v2/Landing.astro`) `#mapa` is the RPPL map
 * chapter, `#cv` the CV chapter and `#proyectos` its projects list. They
 * outlived the old landing on purpose: shared links, `llms.txt` and the 404
 * point at them.
 *
 * ONE exported table because several places name these ids: the landing,
 * the brief view, the 404, `llms.txt` and `scripts/single-landing.check.ts`
 * (verifying the anchors survive the build). Splitting the id from the href
 * in any of them is how they drift.
 *
 * Relative import and NOT the `@content` alias: this module is loaded both by
 * Vite (`.astro` files) and by `tsx` running a `*.check.ts` on its own, which
 * does not resolve the alias. Same reason as `src/lib/jsonld.ts`. Functions
 * import it too (`functions/_pdf.ts`),
 * so Locale comes from `content-schema` rather than the content source.
 *
 * Locale → URL used to be four copies, two of them ternaries: adding a third
 * language made the tables a compile error and the ternaries silently English.
 * `LOCALE_PATHS` is the one table; `sourcePath` / the switch / hreflang / the
 * PDF buttons all read it.
 */
import type { Locale } from "../../content/schema/content-schema";

export interface LandingAnchors {
  map: string;
  projects: string;
  cv: string;
}

export const ANCHORS: Record<Locale, LandingAnchors> = {
  es: { map: "mapa", projects: "proyectos", cv: "cv" },
  en: { map: "map", projects: "projects", cv: "cv" },
};

export interface LocalePaths {
  home: string;
  /** The brief view: the landing without the chapters. Paths are English in
   *  both locales (author, 2026-10-29); anchors follow the page's language. */
  brief: string;
  cv: string;
  pdf: string;
  json: string;
  llms: string;
}

export const LOCALE_PATHS: Record<Locale, LocalePaths> = {
  es: { home: "/", brief: "/brief", cv: "/cv", pdf: "/cv.pdf", json: "/cv.json", llms: "/llms.txt" },
  en: { home: "/en/", brief: "/en/brief", cv: "/en/cv", pdf: "/en/cv.pdf", json: "/en/cv.json", llms: "/en/llms.txt" },
};

/** Social card JPEG, one committed file per locale. */
export const OG_IMAGE_PATH: Record<Locale, string> = {
  es: "/og.jpg",
  en: "/og.en.jpg",
};

/** The binary switch. A third language is a compile error here, not a guess. */
export const OTHER_LOCALE: Record<Locale, Locale> = {
  es: "en",
  en: "es",
};

/** The page Browser Rendering prints, per locale. */
export const sourcePath = (locale: Locale): string => LOCALE_PATHS[locale].cv;

/**
 * `hreflang` for the two indexable landings, including the self-reference the
 * spec requires, plus `x-default` → Spanish (the market is LatAm).
 */
export const HREFLANG: { hreflang: string; path: string }[] = [
  { hreflang: "es", path: LOCALE_PATHS.es.home },
  { hreflang: "en", path: LOCALE_PATHS.en.home },
  { hreflang: "x-default", path: LOCALE_PATHS.es.home },
];

/** Selector listing every landing section id, both languages. */
export function anchorScrollSelector(): string {
  const ids = new Set<string>();
  for (const anchors of Object.values(ANCHORS) as LandingAnchors[]) {
    ids.add(anchors.map);
    ids.add(anchors.projects);
    ids.add(anchors.cv);
  }
  return [...ids].map((id) => `#${id}`).join(", ");
}

/**
 * The pill is `fixed`: without this, an anchor jump hides the heading under
 * it. Emitted from `ANCHORS` so renaming an id cannot drop the offset.
 */
export function anchorScrollCss(): string {
  return `${anchorScrollSelector()} { scroll-margin-top: calc(var(--space) * 9); }`;
}
