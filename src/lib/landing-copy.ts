/**
 * The landing's own copy, per locale: every sentence of `/` and `/en/` that
 * is not a fact from the dataset and not generic chrome (`messages.ts`).
 *
 * Same contract as `content/schema/messages.ts`: `Record<Locale, LandingCopy>`
 * makes a missing translation a COMPILE error. Spanish is written first and
 * keeps the dataset's rioplatense voice; English is direct, short and literal,
 * with the same facts (DeltaDictum: landing-v2/copy).
 *
 * What does NOT belong here: a number (it comes from the dataset through
 * `formatMetric`/`formatMetricEnds`, invariant 3), a role, an achievement or a
 * project's own text (the dataset), and the terminal lines inside the
 * DeltaDictum race, which stay in English in both locales because they ARE
 * Claude Code sessions.
 *
 * Relative import of `Locale`, not `@content`: `src/scripts/**` must never
 * pull the content source into the browser, and this table is read by the
 * page at build time only.
 */
import type { Locale } from "../../content/schema/content-schema";

export interface Beat {
  kicker: string;
  title: string;
  body: string;
}

export interface LandingCopy {
  /** The dock: its label and the other locale's short name. */
  dockLabel: string;
  otherLocaleShort: string;
  /** The dock's language link, spelled out for a screen reader, in the
   *  OTHER language (the link carries lang={other}). */
  otherLocaleName: string;
  /** The brief view's <title> suffix: it must not read as the landing's. */
  briefTitle: string;
  /** The hero. The hook is the one place AI leads (author, 2026-10-29). */
  hook: string;
  heroAria: string;
  writeMe: string;
  guidedCue: string;
  or: string;
  briefLink: string;
  /** Without JavaScript, the bar that sends the reader to the brief view. */
  noJs: string;
  /** The brief view's way back to the guided landing. */
  guidedLink: string;
  /** "Quién soy". */
  aboutKicker: string;
  manifesto: (name: string, years: string) => string;
  plates: { front: [string, string]; back: [string, string]; ship: [string, string] };
  /** The DD interception between Seats and DD. */
  ddHookScope: string;
  ddHook: string;
  keepScrolling: string;
  /** The download dialog. */
  cvModalPick: string;
  /** Chapter 3: the RPPL map. Titles left empty come from the dataset. */
  peakAria: string;
  peakKickers: [string, string, string, string, string];
  peakTitles: { brief: string; broke: string; decision: string };
  peakBodies: { scale: string; result: string };
  barsBefore: string;
  barsAfter: string;
  peakNote: string;
  /** Chapter 4: the seat map. */
  seatsAria: string;
  seatBeats: [Beat, Beat, Beat, Beat];
  stage: string;
  cart: string;
  row: string;
  surfaces: [string, string, string];
  syncMap: string;
  syncCart: string;
  laneConcurrent: string;
  laneSerial: string;
  seatsNote: string;
  /** Chapter 5: DeltaDictum. */
  ddAria: string;
  ownProject: string;
  ddClaim: [string, string];
  ddLede: string;
  ddRaceAsk: string;
  ddRaceIllustrative: string;
  ddCaptionOff: string;
  ddCaptionOn: string;
  ddHung: string;
  ddDone: string;
  ddHowAria: string;
  ddNotes: [Beat, Beat, Beat];
  ddCtaLine: string;
  ddHarnesses: string;
  ddChecks: [string, string, string];
  ddGithub: string;
  ddDocs: string;
  ddFacts: { npm: string; harnesses: string; dates: [string, string]; license: string };
  /** Chapter 6: the journey. */
  journeyKicker: string;
  journeyTitle: (years: string, stages: number) => string;
  toolboxIn: string;
  toolboxTools: string;
  /** Chapter 7: how I work. */
  workKicker: string;
  workTitle: string;
  principles: [Beat, Beat, Beat];
  limitsKicker: string;
  limitsBody: (city: string, timezone: string) => string;
  pipelineAria: string;
  pipelineTitle: string;
  pipelineDeploy: string;
  /** One line per CI step, keyed by the step's command. A step the workflow
   *  runs and this table does not describe fails the build. */
  gates: Record<string, string>;
  /** Chapter 8: the CV, as plain HTML. */
  cvKicker: string;
  cvLede: string;
  /** Chapter 9: the close. */
  closeAria: string;
  closePick: string;
  cvHalfLabel: Record<Locale, string>;
  forAgents: string;
}

export const LANDING: Record<Locale, LandingCopy> = {
  es: {
    dockLabel: "Accesos",
    otherLocaleShort: "EN",
    otherLocaleName: "English version",
    briefTitle: "Vista breve",
    hook: "Trabajo con agentes de código todos los días, y construí DeltaDictum para darles lo que el código no dice.",
    heroAria: "Apertura y quién soy",
    writeMe: "Escribime",
    guidedCue: "Bajá para ver el recorrido guiado",
    or: "o",
    briefLink: "Ver la vista breve",
    noJs: "El recorrido guiado necesita JavaScript.",
    guidedLink: "Ver el recorrido guiado",
    aboutKicker: "Quién soy",
    manifesto: (name, years) =>
      `Soy ${name}. Desarrollador full stack con el foco puesto en el frontend: ${years} construyendo productos web completos, de la interfaz al deploy.`,
    plates: {
      front: ["Interfaz", "Donde más profundo voy"],
      back: ["Servidor y CMS", "Lo que el problema pida"],
      ship: ["Entrega", "Del repo a producción"],
    },
    ddHookScope: "este portfolio",
    ddHook:
      "[DECISION] Lo que sigue no es un encargo: es un producto mío. Lo construí trabajando con agentes de código, para darles lo que el código no dice, justo antes de cada acción.",
    keepScrolling: "Seguí bajando",
    cvModalPick: "elegí el idioma",
    peakAria: "Primera prueba: el mapa de RPPL",
    peakKickers: ["El encargo", "La escala", "Lo que se rompía", "La decisión", "El resultado"],
    peakTitles: {
      brief: "El mapa del informe de RPPL.",
      broke: "Pintura sucia y un hover que no llegaba.",
      decision: "Un índice, fuera del hilo de la interfaz.",
    },
    peakBodies: {
      scale: "Cada polígono es un distrito escolar con sus indicadores.",
      result: "La interfaz no se bloquea mientras indexa un JSON de 7 MB.",
    },
    barsBefore: "antes",
    barsAfter: "después",
    peakNote: "Geometría ilustrativa · los números son reales",
    seatsAria: "Segunda prueba: el mapa de asientos",
    seatBeats: [
      { kicker: "El encargo", title: "Un mapa de asientos dentro de WooCommerce.", body: "" },
      {
        kicker: "Lo que se rompía",
        title: "Dos clicks, dos verdades.",
        body: "Dos clicks seguidos disparaban mutaciones concurrentes al Store API: el nonce rotaba y el mapa se desfasaba del carrito.",
      },
      { kicker: "La decisión", title: "AsyncPile: una operación a la vez.", body: "" },
      {
        kicker: "El resultado",
        title: "Los mismos asientos en todas partes.",
        body: "Pasé de cart_key a session_owner para que recarga, minicart y checkout vean los mismos asientos.",
      },
    ],
    stage: "ESCENARIO",
    cart: "Carrito",
    row: "Fila",
    surfaces: ["Recarga", "Minicart", "Checkout"],
    syncMap: "mapa",
    syncCart: "carrito",
    laneConcurrent: "4 pedidos a la vez",
    laneSerial: "uno por vez",
    seatsNote: "Sala ilustrativa · el problema y la solución son reales",
    ddAria: "Proyecto propio: DeltaDictum",
    ownProject: "Proyecto propio",
    ddClaim: ["Lo que tu código no dice,", "dicho en el momento justo."],
    ddLede:
      "Guarda las decisiones, las trampas y los pasos no escritos de un proyecto como memorias en git, y le entrega cada una al agente de código justo antes de la acción a la que aplica.",
    ddRaceAsk: "El mismo pedido, el mismo agente",
    ddRaceIllustrative: "ilustrativo",
    ddCaptionOff: "Sin DD: el agente no conoce la trampa",
    ddCaptionOn: "Con DD: la memoria llega antes de editar",
    ddHung: "Colgado",
    ddDone: "Terminó",
    ddHowAria: "Cómo funciona",
    ddNotes: [
      {
        kicker: "1",
        title: "Guardada con evidencia",
        body: "Se la pedís al agente, o DD la propone después de un arreglo. DD calcula el hash del archivo que la memoria cita: con evidencia verificada se activa al instante; si no, espera una revisión humana.",
      },
      {
        kicker: "2",
        title: "Reglas, no búsqueda",
        body: "Antes de cada lectura, edición o comando, un hook compara la acción con los disparadores de las memorias. Una regla aplica o no aplica. Local: sin cuenta, sin llamadas a modelos, sin dependencias.",
      },
      {
        kicker: "3",
        title: "A tiempo, y compartida",
        body: "Llega con la acción a la que aplica, una vez por sesión. Las memorias son archivos JSON en el repo: quien hace pull recibe las mismas, y las nuevas se revisan como código.",
      },
    ],
    ddCtaLine: "Un producto mío, hecho para la forma en que trabajo con agentes de código.",
    ddHarnesses: "Claude Code, Codex y OpenCode · Cursor y Grok Build en preview",
    ddChecks: ["Sin cuenta, sin llamadas a modelos", "Las memorias son archivos en tu repo", "En silencio cuando nada aplica"],
    ddGithub: "Ver en GitHub",
    ddDocs: "Documentación",
    ddFacts: {
      npm: "publicado en npm",
      harnesses: "harnesses soportados y en preview",
      dates: ["10/09 → 22/10", "del primer commit al 1.0, en 2026"],
      license: "código disponible, uso libre",
    },
    journeyKicker: "Recorrido",
    journeyTitle: (years, stages) => `${years}, ${stages} etapas.`,
    toolboxIn: "Stack en",
    toolboxTools: "herramientas",
    workKicker: "Cómo trabajo",
    workTitle: "La IA escribe rápido. Lo que entra al repo lo decido yo.",
    principles: [
      {
        kicker: "01",
        title: "IA todos los días, con la revisión de mi lado.",
        body: "Claude y Cursor son parte del flujo. Qué entra al repo no se delega: lo deciden la revisión y los checks.",
      },
      {
        kicker: "02",
        title: "Ningún número inventado.",
        body: "Las métricas distinguen medido de estimado — el “~” no se escribe a mano, lo pone el código. Lo que no sé queda como TODO, no como un número lindo.",
      },
      {
        kicker: "03",
        title: "El CV que lee un ATS, intacto.",
        body: "La página que se imprime como PDF es una columna y no carga JavaScript. Un check lo vigila en cada push, porque es lo que llega a quien contrata.",
      },
    ],
    limitsKicker: "Límites, dichos de entrada",
    limitsBody: (city, timezone) =>
      `El inglés está en A2: lo digo acá para que no lo descubras en una entrevista. Trabajo remoto desde ${city}, ${timezone}.`,
    pipelineAria: "Los checks que corre cada push de este sitio",
    pipelineTitle: "Cada push de este sitio pasa por",
    pipelineDeploy: "listo para publicar",
    gates: {
      "test:workflows": "el CI se valida a sí mismo",
      typecheck: "tipos de todo el repo",
      validate: "el dataset cumple el contrato",
      test: "visibilidad, estimados con “~”, invariantes",
      "test:format": "datos en forma canónica",
      "test:i18n": "el inglés al día con el español",
      "test:editor": "el editor de contenido, en Chromium",
      build: "el sitio estático",
      "pdf:local": "imprime el CV",
      "test:pdf": "el PDF que se imprime",
      "test:js": "/cv sin JavaScript",
      "test:bundle": "presupuesto de bytes",
      "test:landing": "/cv aislado y sin indexar",
      "test:endpoints": "/cv.json y /llms.txt completos",
      "test:og": "la imagen para compartir, al día",
      "audit:todos": "los TODO que llegan al sitio, a la vista",
    },
    cvKicker: "CV",
    cvLede: "Todo lo anterior, sin animación: cada rol, cada logro, los proyectos y la formación.",
    closeAria: "Cierre: descargar el CV y contacto",
    closePick: "español o inglés",
    cvHalfLabel: { es: "Descargar el CV en español (PDF)", en: "Descargar el CV en inglés (PDF)" },
    forAgents: "Para agentes:",
  },
  en: {
    dockLabel: "Shortcuts",
    otherLocaleShort: "ES",
    otherLocaleName: "Versión en español",
    briefTitle: "Brief view",
    hook: "I work with coding agents every day, and I built DeltaDictum to give them what the code does not say.",
    heroAria: "Opening and about me",
    writeMe: "Email me",
    guidedCue: "Scroll for the guided tour",
    or: "or",
    briefLink: "See the brief view",
    noJs: "The guided tour needs JavaScript.",
    guidedLink: "See the guided tour",
    aboutKicker: "About me",
    manifesto: (name, years) =>
      `I'm ${name}. A full stack developer focused on the front end: ${years} building complete web products, from the interface to the deploy.`,
    plates: {
      front: ["Interface", "Where I go deepest"],
      back: ["Server and CMS", "Whatever the problem needs"],
      ship: ["Delivery", "From the repo to production"],
    },
    ddHookScope: "this portfolio",
    ddHook:
      "[DECISION] What comes next is not client work: it is my own product. I built it while working with coding agents, to give them what the code does not say, right before each action.",
    keepScrolling: "Keep scrolling",
    cvModalPick: "pick the language",
    peakAria: "First proof: the RPPL map",
    peakKickers: ["The brief", "The scale", "What broke", "The decision", "The result"],
    peakTitles: {
      brief: "The map in the RPPL report.",
      broke: "Dirty paint and a hover that never arrived.",
      decision: "An index, off the interface thread.",
    },
    peakBodies: {
      scale: "Each polygon is a school district with its indicators.",
      result: "The interface does not freeze while it indexes a 7 MB JSON.",
    },
    barsBefore: "before",
    barsAfter: "after",
    peakNote: "Illustrative geometry · the numbers are real",
    seatsAria: "Second proof: the seat map",
    seatBeats: [
      { kicker: "The brief", title: "A seat map inside WooCommerce.", body: "" },
      {
        kicker: "What broke",
        title: "Two clicks, two truths.",
        body: "Two clicks in a row fired concurrent mutations at the Store API: the nonce rotated and the map fell out of step with the cart.",
      },
      { kicker: "The decision", title: "AsyncPile: one operation at a time.", body: "" },
      {
        kicker: "The result",
        title: "The same seats everywhere.",
        body: "I moved from cart_key to session_owner so reload, minicart and checkout all see the same seats.",
      },
    ],
    stage: "STAGE",
    cart: "Cart",
    row: "Row",
    surfaces: ["Reload", "Minicart", "Checkout"],
    syncMap: "map",
    syncCart: "cart",
    laneConcurrent: "4 requests at once",
    laneSerial: "one at a time",
    seatsNote: "Illustrative hall · the problem and the fix are real",
    ddAria: "Own project: DeltaDictum",
    ownProject: "Own project",
    ddClaim: ["What your code does not say,", "said at the right moment."],
    ddLede:
      "It keeps a project's decisions, traps and unwritten steps as memories in git, and hands each one to the coding agent right before the action it applies to.",
    ddRaceAsk: "Same request, same agent",
    ddRaceIllustrative: "illustrative",
    ddCaptionOff: "Without DD: the agent does not know the trap",
    ddCaptionOn: "With DD: the memory arrives before the edit",
    ddHung: "Hung",
    ddDone: "Done",
    ddHowAria: "How it works",
    ddNotes: [
      {
        kicker: "1",
        title: "Saved with evidence",
        body: "You ask the agent for it, or DD proposes it after a fix. DD hashes the file the memory cites: with verified evidence it is active at once; otherwise it waits for a human review.",
      },
      {
        kicker: "2",
        title: "Rules, not search",
        body: "Before every read, edit or command, a hook matches the action against the memories' triggers. A rule applies or it does not. Local: no account, no model calls, no dependencies.",
      },
      {
        kicker: "3",
        title: "On time, and shared",
        body: "It arrives with the action it applies to, once per session. Memories are JSON files in the repo: whoever pulls gets the same ones, and new ones are reviewed like code.",
      },
    ],
    ddCtaLine: "My own product, made for the way I work with coding agents.",
    ddHarnesses: "Claude Code, Codex and OpenCode · Cursor and Grok Build in preview",
    ddChecks: ["No account, no model calls", "Memories are files in your repo", "Silent when nothing applies"],
    ddGithub: "See it on GitHub",
    ddDocs: "Documentation",
    ddFacts: {
      npm: "published on npm",
      harnesses: "harnesses supported and in preview",
      dates: ["09/10 → 10/22", "from first commit to 1.0, in 2026"],
      license: "source available, free to use",
    },
    journeyKicker: "Journey",
    journeyTitle: (years, stages) => `${years}, ${stages} stages.`,
    toolboxIn: "Stack in",
    toolboxTools: "tools",
    workKicker: "How I work",
    workTitle: "AI writes fast. I decide what goes into the repo.",
    principles: [
      {
        kicker: "01",
        title: "AI every day, with review on my side.",
        body: "Claude and Cursor are part of the flow. What goes into the repo is not delegated: review and the checks decide it.",
      },
      {
        kicker: "02",
        title: "No invented numbers.",
        body: "Metrics tell measured from estimated apart — the “~” is not typed by hand, the code adds it. What I do not know stays a TODO, not a nice number.",
      },
      {
        kicker: "03",
        title: "The CV an ATS reads, untouched.",
        body: "The page printed to PDF is one column and loads no JavaScript. A check guards it on every push, because it is what reaches whoever hires.",
      },
    ],
    limitsKicker: "Limits, stated up front",
    limitsBody: (city, timezone) =>
      `My English is A2: I say it here so you do not find out in an interview. I work remotely from ${city}, ${timezone}.`,
    pipelineAria: "The checks every push to this site runs",
    pipelineTitle: "Every push to this site goes through",
    pipelineDeploy: "ready to publish",
    gates: {
      "test:workflows": "CI validates itself",
      typecheck: "types across the repo",
      validate: "the dataset meets the contract",
      test: "visibility, estimates with “~”, invariants",
      "test:format": "data in canonical form",
      "test:i18n": "English up to date with Spanish",
      "test:editor": "the content editor, in Chromium",
      build: "the static site",
      "pdf:local": "prints the CV",
      "test:pdf": "the printed PDF",
      "test:js": "/cv with no JavaScript",
      "test:bundle": "byte budget",
      "test:landing": "/cv isolated and unindexed",
      "test:endpoints": "/cv.json and /llms.txt complete",
      "test:og": "the share image, up to date",
      "audit:todos": "TODOs that reach the site, in plain sight",
    },
    cvKicker: "CV",
    cvLede: "Everything above, without the motion: every role, every achievement, the projects and the education.",
    closeAria: "Close: download the CV and contact",
    closePick: "Spanish or English",
    cvHalfLabel: { es: "Download the CV in Spanish (PDF)", en: "Download the CV in English (PDF)" },
    forAgents: "For agents:",
  },
};
