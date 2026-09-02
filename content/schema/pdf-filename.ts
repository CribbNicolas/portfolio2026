/**
 * The name the CV PDF is saved under. ONE definition.
 *
 * Four places need it and would otherwise drift: the landing's `download`
 * attribute (which is what actually names the file on a click), the
 * `content-disposition` header of the Function (for a direct hit on the URL),
 * the local render, and the check that asserts the two agree. Same reason
 * `pdf-options.ts` exists.
 *
 * An ATS does not read this. It extracts the document's text — that is what
 * `pdf-output.check.ts` layer 1 tests. What the name does is show up in the
 * ATS's list and in the recruiter's mail client, both of which truncate near
 * 30-35 visible characters.
 *
 * The date is the DATASET's `updatedAt`, not the clock's: two copies in the
 * same folder sort by which content is newer, and because each locale carries
 * its own, the English file's name shows on its face when the translation is
 * behind.
 */

import type { Locale } from "./content-schema";

/** Surname first: it is how a folder of CVs sorts usefully. */
const STEM = "Cribb_Nicolas_CV";

export function pdfFilename(locale: Locale, updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`pdfFilename: updatedAt is not a date: "${updatedAt}"`);
  }
  // `toISOString` and not the local date: the build machine, the Cloudflare
  // colo and the author are in three different timezones, and the name has to
  // be the same in all three.
  const day = date.toISOString().slice(0, 10);
  const tag = locale === "es" ? "" : `_${locale.toUpperCase()}`;
  return `${STEM}${tag}_${day}.pdf`;
}
