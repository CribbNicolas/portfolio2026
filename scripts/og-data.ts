/**
 * What the social card generator and its verification share.
 *
 * It lives apart for the same reason as `pdf-options.ts`: `build-og.ts` is an
 * entry point — it runs `main()` on import — so if the check imported from
 * there, verifying the image would launch a Chromium to regenerate it. And if
 * each had its own copy of these two functions, the fingerprint the generator
 * writes and the one the check recomputes would stop matching the day one of
 * them changed: the gate would end up comparing the image against itself.
 */

import { createHash } from "node:crypto";

// Invariant 2: the view comes from `content/source/index.ts`, never from the
// implementation. It is the line that changes the day the backend is another.
import { content, formatSeniority } from "../content/source/index";
import type { Locale } from "../content/schema/content-schema";

export const PHOTO = "public/foto.jpeg";
export const IMAGE: Record<Locale, string> = {
  es: "public/og.jpg",
  en: "public/og.en.jpg",
};
export const ICON = "public/apple-touch-icon.png";
export const TEMPLATE = "scripts/og-template.ts";
/** The brand geometry. It enters the fingerprint: both artifacts draw it. */
export const BRAND = "src/lib/brand.ts";
export const LOCK = "og.lock.json";

/** The card texts, all derived from the dataset. Nothing written by hand. */
export async function ogTexts(locale: Locale): Promise<Record<string, string>> {
  const view = await content.getView("portfolio", locale);
  const { identity } = view;
  return {
    name: identity.fullName,
    kicker: identity.brandTitle,
    // The same line the landing hero builds. Seniority is DERIVED (invariant
    // 3): `formatSeniority` over the years the view already computed, never a
    // number written here.
    role: `${identity.searchTitle} · ${formatSeniority(view.yearsOfExperience, locale)} · ${identity.location.city}, ${identity.location.country}`,
  };
}

/**
 * The fingerprint of everything visible on the card.
 *
 * `public/og.jpg` and `public/og.en.jpg` are committed artifacts: if an input
 * changes and nobody regenerates them, the site says one thing and the image
 * LinkedIn sees says another, with nothing failing. This number is what turns
 * that silence into a red test.
 *
 * It includes the template source AND `brand.ts` on purpose: retouching the
 * design, or adjusting a curve of the logo, also invalidates the artifacts —
 * not only changing a datum in the dataset. Without `brand.ts` inside,
 * changing the brand left the card and the iOS icon drawing the old one and
 * nothing failed.
 *
 * The template's line endings are normalized before hashing. The repo runs with
 * `core.autocrlf=true`, so the file arrives with CRLF on Windows and LF on
 * Linux: without normalizing, the fingerprint would differ between your machine
 * and the CI runner, and the gate would fail with nothing having changed. The
 * photo is NOT touched — it is binary, and "normalizing" it would corrupt it.
 */
export function fingerprint(
  texts: Record<string, string>,
  photo: Buffer,
  ...sources: Buffer[]
): string {
  const h = createHash("sha256").update(JSON.stringify(texts)).update(photo);
  for (const f of sources) h.update(f.toString("utf8").replace(/\r\n/g, "\n"));
  return h.digest("hex").slice(0, 16);
}
