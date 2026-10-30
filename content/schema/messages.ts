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
 * The CV headings are the standard ones in both languages: a parser maps them to fields, and an invented heading maps to
 * nothing.
 */

import type { Locale } from "./content-schema";

export interface Messages {
  /** CV sections. Standard headings, so a parser maps them. */
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
  /** The landing's download control: the button label (also the modal title)
   *  and the dialog's close action. Language names of the two PDFs live in
   *  the component — they are the files' own languages, not chrome copy. */
  downloadCv: string;
  closeDialog: string;
  /** Landing section headings outside the CV proper. */
  projectsTitle: string;
  cvTitle: string;
  /** `ProjectList`'s status labels (`archived` is not labelled — it adds
   *  nothing). */
  projectStatusInProgress: string;
  projectStatusPrototype: string;
  /**
   * The footer's Clarity/privacy note, split around the link so the anchor
   * stays real markup instead of being flattened into a template string.
   */
  footerPrivacyIntro: string;
  footerPrivacyLinkText: string;
  footerPrivacyOutro: string;
  /** The OG/Twitter image alt text's suffix, appended to the page title. */
  ogImageAltSuffix: string;
  /**
   * `/cv.pdf` and `/en/cv.pdf`'s visitor-facing error bodies. Chrome copy, not
   * CV content, but the same rule applies: a Spanish 503 on the English route
   * is the same category of mistake as a Spanish heading on the English CV.
   */
  pdfUnconfigured: string;
  pdfTimeout: string;
  pdfQuotaExceeded: string;
  pdfGenerationFailed: string;
  /** `/llms.txt` section headings and line labels. */
  llmsContact: string;
  llmsStack: string;
  llmsExperience: string;
  llmsProjects: string;
  llmsHtmlCv: string;
  llmsPdfCv: string;
  llmsJson: string;
  /** 404 page. Spanish first on the one shared `404.html`. */
  errorTitle: string;
  errorDescription: string;
  errorText: string;
  errorBack: string;
  errorNavLabel: string;
  errorDestProjects: string;
  errorDestCv: string;
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
    closeDialog: "Cerrar",
    projectsTitle: "Proyectos",
    cvTitle: "Currículum",
    projectStatusInProgress: "En curso",
    projectStatusPrototype: "Prototipo",
    footerPrivacyIntro:
      "Uso Microsoft Clarity para ver qué partes de esta página se leen: mide clicks y scroll, y graba " +
      "sesiones anónimas, sin cookies. ",
    footerPrivacyLinkText: "Su política de privacidad",
    footerPrivacyOutro:
      ". También uso Cloudflare Web Analytics para el tráfico y la velocidad de carga: tampoco usa " +
      "cookies ni identifica visitantes.",
    ogImageAltSuffix: "Retrato y marca.",
    pdfUnconfigured: "El PDF no está configurado en este entorno.",
    pdfTimeout: "El render del PDF tardó demasiado. Probá de nuevo en un minuto.",
    pdfQuotaExceeded: "Se agotó la cuota de render del día. Probá más tarde.",
    pdfGenerationFailed: "No se pudo generar el PDF.",
    llmsContact: "Contacto",
    llmsStack: "Stack",
    llmsExperience: "Experiencia",
    llmsProjects: "Proyectos",
    llmsHtmlCv: "CV en HTML",
    llmsPdfCv: "CV en PDF",
    llmsJson: "Datos en JSON",
    errorTitle: "Esta página no existe",
    errorDescription: "La dirección que pediste no corresponde a ninguna página de este sitio.",
    errorText:
      "La dirección que pediste no corresponde a ninguna página del sitio. Puede que el link estuviera mal copiado, o que apuntara a algo que ya no está.",
    errorBack: "Volver al inicio",
    errorNavLabel: "Secciones del sitio",
    errorDestProjects: "Los proyectos",
    errorDestCv: "El CV completo",
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
    closeDialog: "Close",
    projectsTitle: "Projects",
    cvTitle: "CV",
    projectStatusInProgress: "In progress",
    projectStatusPrototype: "Prototype",
    footerPrivacyIntro:
      "I use Microsoft Clarity to see which parts of this page get read: it measures " +
      "clicks and scroll, and records anonymous sessions, with no cookies. ",
    footerPrivacyLinkText: "Its privacy policy",
    footerPrivacyOutro:
      ". I also use Cloudflare Web Analytics for traffic and load speed: it uses no cookies " +
      "either and identifies no visitors.",
    ogImageAltSuffix: "Portrait and branding.",
    pdfUnconfigured: "The PDF isn't configured in this environment.",
    pdfTimeout: "The PDF render took too long. Try again in a minute.",
    pdfQuotaExceeded: "Today's render quota is used up. Try again later.",
    pdfGenerationFailed: "The PDF could not be generated.",
    llmsContact: "Contact",
    llmsStack: "Stack",
    llmsExperience: "Experience",
    llmsProjects: "Projects",
    llmsHtmlCv: "CV in HTML",
    llmsPdfCv: "CV as PDF",
    llmsJson: "Data as JSON",
    errorTitle: "This page doesn't exist",
    errorDescription: "The address you asked for doesn't match any page on this site.",
    errorText:
      "The address you asked for doesn't match any page on this site. The link may have been copied wrong, or it pointed at something that is no longer here.",
    errorBack: "Back to the home page",
    errorNavLabel: "Site sections",
    errorDestProjects: "The projects",
    errorDestCv: "The full CV",
  },
};
