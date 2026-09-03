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
  /** The pill nav: its accessible label and the two section links (the CV
   *  one reuses `sectionExperience`'s sibling headings, not a nav string). */
  navSectionsLabel: string;
  navMap: string;
  navProjects: string;
  /** The knowledge map section: heading, lede and the node/edge counters. */
  mapTitle: string;
  mapLede: string;
  statsNodes: string;
  statsConnections: string;
  statsAffinity: string;
  /** The map container's accessible label (drag/click instructions). */
  mapAriaLabel: string;
  /** `GraphSvg`'s own `aria-label`, built from live counts — a function
   *  because the numbers are computed at render time, not fixed copy. */
  svgMapAriaLabel: (nodes: number, edges: number) => string;
  mapHint: string;
  /** The stack index heading's note ("Stack N of M with evidence"). A
   *  function for the same reason as `svgMapAriaLabel`. */
  stackEvidenceNote: (withEvidence: number, total: number) => string;
  /** The note under the stack list when some skills have zero connections:
   *  real skills, just not backed by a written achievement yet. */
  emptyStackNote: (count: number) => string;
  /** Landing section headings outside the CV proper. */
  projectsTitle: string;
  cvTitle: string;
  /** `ProjectList`'s status labels (`archived` is not labelled — it adds
   *  nothing). */
  projectStatusInProgress: string;
  projectStatusPrototype: string;
  /**
   * The map's node-kind labels and pluralization, read by
   * `src/scripts/lab/interaction.ts` — code that runs in the BROWSER and may
   * not import `@content` (it would drag zod and the whole dataset along,
   * see that file's header comment). These travel instead inside the
   * serialized graph payload (`LabData.strings`, `src/scripts/lab/types.ts`),
   * built once per page from this record, not per node.
   */
  mapKindRole: string;
  mapKindProject: string;
  mapKindAchievement: string;
  mapKindSkill: string;
  mapConnectionSingular: string;
  mapConnectionPlural: string;
  mapAchievementSingular: string;
  mapAchievementPlural: string;
  /** "+{n} more" / "+{n} más" — `{n}` is a literal placeholder the browser
   *  substitutes; kept as a plain string (not a function) because it crosses
   *  into `LabData`, which is JSON, not code. */
  mapMoreTemplate: string;
  /**
   * The footer's Clarity/privacy note, split around the link so the anchor
   * stays real markup instead of being flattened into a template string.
   */
  footerPrivacyIntro: string;
  footerPrivacyLinkText: string;
  footerPrivacyOutro: string;
  /** The OG/Twitter image alt text's suffix, appended to the page title. */
  ogImageAltSuffix: string;
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
    navSectionsLabel: "Secciones",
    navMap: "Mapa",
    navProjects: "Proyectos",
    mapTitle: "Mapa de conocimiento",
    mapLede:
      "\nLos logros no viven adentro de cada trabajo: viven sueltos y se cruzan por\n          tecnología, por rol y por proyecto. Esto es ese cruce, dibujado.\n",
    statsNodes: "Nodos",
    statsConnections: "Conexiones",
    statsAffinity: "Por afinidad",
    mapAriaLabel:
      "Mapa de conocimiento. Arrastrá para rotar, hacé click en un nodo para ver qué lo respalda. Las flechas también rotan.",
    svgMapAriaLabel: (nodes, edges) =>
      `Mapa de conocimiento: ${nodes} nodos y ${edges} conexiones entre roles, proyectos, logros y tecnologías.`,
    mapHint: "Arrastrá para rotar · click en un nodo",
    stackEvidenceNote: (withEvidence, total) => `${withEvidence} de ${total} con evidencia`,
    emptyStackNote: (count) =>
      `Las ${count} tecnologías sin conexiones son reales: las uso,\n          pero todavía no escribí el logro que lo demuestre. Van huecas y chicas, agrupadas\n          en el núcleo. El mapa muestra el hueco en vez de taparlo.`,
    projectsTitle: "Proyectos",
    cvTitle: "Currículum",
    projectStatusInProgress: "En curso",
    projectStatusPrototype: "Prototipo",
    mapKindRole: "Rol",
    mapKindProject: "Proyecto",
    mapKindAchievement: "Logro",
    mapKindSkill: "Tecnología",
    mapConnectionSingular: "conexión",
    mapConnectionPlural: "conexiones",
    mapAchievementSingular: "Logro",
    mapAchievementPlural: "Logros",
    mapMoreTemplate: "+{n} más",
    footerPrivacyIntro:
      "\nUso Microsoft Clarity para ver qué partes de esta página se leen: mide\n      clicks y scroll, y graba sesiones anónimas. Usa cookies.  ",
    footerPrivacyLinkText: "Su política de privacidad",
    footerPrivacyOutro:
      ". También uso Cloudflare\n      Web Analytics para el tráfico y la velocidad de carga: no usa cookies ni\n      identifica visitantes.\n",
    ogImageAltSuffix: "Retrato y marca.",
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
    navSectionsLabel: "Sections",
    navMap: "Map",
    navProjects: "Projects",
    mapTitle: "Knowledge map",
    mapLede:
      "Achievements don't live inside a single job: they float loose and cross over technology, role and project. This is that crossing, drawn out.",
    statsNodes: "Nodes",
    statsConnections: "Connections",
    statsAffinity: "By affinity",
    mapAriaLabel:
      "Knowledge map. Drag to rotate, click a node to see what backs it up. The arrow keys rotate it too.",
    svgMapAriaLabel: (nodes, edges) =>
      `Knowledge map: ${nodes} nodes and ${edges} connections across roles, projects, achievements and skills.`,
    mapHint: "Drag to rotate · click a node",
    stackEvidenceNote: (withEvidence, total) => `${withEvidence} of ${total} with evidence`,
    emptyStackNote: (count) =>
      `The ${count} technologies with no connections are real: I use them, but haven't ` +
      `written the achievement that proves it yet. They render hollow and small, grouped at ` +
      `the core. The map shows the gap instead of covering it up.`,
    projectsTitle: "Projects",
    cvTitle: "CV",
    projectStatusInProgress: "In progress",
    projectStatusPrototype: "Prototype",
    mapKindRole: "Role",
    mapKindProject: "Project",
    mapKindAchievement: "Achievement",
    mapKindSkill: "Technology",
    mapConnectionSingular: "connection",
    mapConnectionPlural: "connections",
    mapAchievementSingular: "Achievement",
    mapAchievementPlural: "Achievements",
    mapMoreTemplate: "+{n} more",
    footerPrivacyIntro:
      "I use Microsoft Clarity to see which parts of this page get read: it measures " +
      "clicks and scroll, and records anonymous sessions. It uses cookies. ",
    footerPrivacyLinkText: "Its privacy policy",
    footerPrivacyOutro:
      ". I also use Cloudflare Web Analytics for traffic and load speed: it uses no cookies " +
      "and identifies no visitors.",
    ogImageAltSuffix: "Portrait and branding.",
  },
};
