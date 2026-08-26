/**
 * The brand, in one place.
 *
 * Two pieces: the RING — the C of the surname, a thick ring open on the right —
 * and the N inside it. The ring alone is the small icon; together they are the
 * logo. At 16 px a letter turns into a smudge and a silhouette does not, so the
 * favicon is identified by shape and the letters only appear once there is room
 * to read them.
 *
 * This module exists because the brand is drawn by THREE consumers — the header
 * logo, the Open Graph card and the favicon — and a `d=` copied three times
 * diverges the first time someone adjusts a curve. The first two import from
 * here; the favicon cannot (it is a static file served as-is), which is why
 * `og-output.check.ts` verifies its path is still the one defined here.
 *
 * It is geometry, never `<text>`: an SVG loaded as an image — which is what a
 * favicon is — cannot pull a webfont, so Manrope would not load and the N would
 * render in the system font, different on every machine.
 */

/** The drawing box. It is the favicon's, which is why everything is in 32nds. */
export const BRAND_VIEWBOX = "0 0 32 32";

/** The open ring. The C. Filled, not stroked: that is what allows cutting the
 *  terminals so they point at the center instead of staying round. */
export const RING_PATH =
  "M28.1 24.16A14.6 14.6 0 1 1 28.1 7.84L21.31 12.42A6.4 6.4 0 1 0 21.31 19.58Z";

/** The N. Stroked and not filled, so the weight lives in a single number. */
export const N_PATH = "M11.5 21.5V11l8 10.5V11";

/**
 * The weight of the N.
 *
 * At 4 it looked right from 48 px up, but at 24 px — the size it lives at in
 * the bar — the counters of the letter closed and it became a smudge. 3.6 keeps
 * them open there without costing it weight at large sizes.
 */
export const N_WEIGHT = 3.6;

/**
 * The brand as a standalone SVG, for whoever cannot mount an Astro component —
 * today, the Open Graph card generator, which assembles HTML by hand.
 *
 * Colors are passed explicitly because this SVG ends up inside a page Chromium
 * prints without the site cascade. The header logo, by contrast, uses
 * `var(--accent)` and `var(--ink)`: there are tokens there, and that is why
 * dark mode comes for free.
 */
export function brandSvg({
  size,
  accent,
  ink,
}: {
  size: number;
  accent: string;
  ink: string;
}): string {
  return (
    `<svg viewBox="${BRAND_VIEWBOX}" width="${size}" height="${size}" aria-hidden="true">` +
    `<path d="${RING_PATH}" fill="${accent}"/>` +
    `<path d="${N_PATH}" fill="none" stroke="${ink}" stroke-width="${N_WEIGHT}"` +
    ` stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
