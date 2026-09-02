/**
 * Chrome copy: the words the SITE says, as opposed to the words the AUTHOR
 * wrote. Section headings, the download button, the label of an open date
 * range.
 *
 * It is code and not dataset on purpose. `content.es.json` holds atomic facts;
 * "Experiencia" is not a fact about a career, it is a heading. Keeping it here
 * means `Record<Locale, Messages>` makes a missing translation a COMPILE error,
 * so this layer needs no gate of its own — while the dataset, which the type
 * system cannot check, gets `translation.lock.json`.
 *
 * The CV headings are the standard ones of `docs/03-cv.md` §2 in both
 * languages: a parser maps them to fields, and an invented heading maps to
 * nothing.
 */

import type { Locale } from "./content-schema";

export interface Messages {
  /** CV sections. docs/03 §2. */
  sectionProfile: string;
  sectionSkills: string;
  sectionExperience: string;
  sectionEducation: string;
  sectionLanguages: string;
  /** Education qualifiers. */
  studyPartial: string;
  studyInProgress: string;
  /** Language levels that are words rather than a CEFR code. */
  levelNative: string;
  /** An open date range. Rule 1: it is "current", not a missing datum. */
  present: string;
  /** Rule 2: a role that overlapped another one says so in its title. */
  concurrentSuffix: string;
  /** Durations. Rule 1. */
  year: string;
  years: string;
  month: string;
  months: string;
  /** `formatSeniority`. */
  senioritySuffix: string;
  /** Contact labels in the CV header. They are written out, never icons. */
  emailLabel: string;
  phoneLabel: string;
  /** `formatMetric`. The connectives of a before/after movement, rule 4. */
  metricFrom: string;
  metricTo: string;
  /** The landing's download buttons. */
  downloadCv: string;
  downloadCvOtherLocale: string;
}

export const MESSAGES: Record<Locale, Messages> = {
  es: {
    sectionProfile: "Perfil",
    sectionSkills: "Habilidades técnicas",
    sectionExperience: "Experiencia",
    sectionEducation: "Educación",
    sectionLanguages: "Idiomas",
    studyPartial: "Cursado parcial",
    studyInProgress: "En curso",
    levelNative: "Nativo",
    present: "Actualidad",
    concurrentSuffix: "en paralelo",
    year: "año",
    years: "años",
    month: "mes",
    months: "meses",
    senioritySuffix: "años",
    emailLabel: "Email",
    phoneLabel: "Tel",
    metricFrom: "de",
    metricTo: "a",
    downloadCv: "Descargar CV",
    downloadCvOtherLocale: "Download CV (English)",
  },
  en: {
    sectionProfile: "Profile",
    sectionSkills: "Technical skills",
    sectionExperience: "Experience",
    sectionEducation: "Education",
    sectionLanguages: "Languages",
    studyPartial: "Partially completed",
    studyInProgress: "In progress",
    levelNative: "Native",
    present: "Present",
    concurrentSuffix: "concurrent",
    year: "year",
    years: "years",
    month: "month",
    months: "months",
    senioritySuffix: "years",
    emailLabel: "Email",
    phoneLabel: "Phone",
    metricFrom: "from",
    metricTo: "to",
    downloadCv: "Download CV",
    downloadCvOtherLocale: "Descargar CV (español)",
  },
};
