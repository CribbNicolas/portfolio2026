/**
 * ============================================================================
 *  CONTENT SCHEMA — Fuente única de verdad para CV, portfolio y perfiles
 * ============================================================================
 *
 *  Principio rector: el backend guarda HECHOS ATÓMICOS, no documentos.
 *  El CV, el portfolio y los bloques de LinkedIn son VISTAS derivadas.
 *
 *  Compatible en espíritu con JSON Resume (jsonresume.org), extendido con
 *  lo que ese estándar no cubre: superficies, casos de estudio con decisiones
 *  técnicas, y trazabilidad de skills.
 *
 *  Locale: un dataset por idioma (content.es.json / content.en.json).
 *  El locale vive en la raíz, NO por campo. Simplifica todo.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Fecha en formato YYYY-MM. Nunca strings libres, nunca duraciones escritas a mano. */
export type YearMonth = `${number}-${number}`;

export type Locale = "es" | "en";

/**
 * Dónde se muestra un item. Un hecho puede vivir en el portfolio y no en el CV.
 * Este es el campo que resuelve "el portfolio tiene más info que el CV".
 */
export type Surface =
  | "cv"          // CV completo (2 páginas, diseñado)
  | "cv-short"    // CV de 1 página, solo lo más fuerte
  | "cv-ats"      // versión una columna para formularios
  | "portfolio"   // sitio personal, sin límite de espacio
  | "linkedin"    // bloques para copiar y pegar
  | "public-api"; // /cv.json y llms.txt

/** Por defecto: visible en todas las superficies. Los overrides son la excepción. */
export interface Visibility {
  /** Si está definido, SOLO aparece en estas superficies. */
  only?: Surface[];
  /** Nunca aparece en estas. Se aplica después de `only`. */
  except?: Surface[];
  /**
   * 1 = imprescindible, siempre entra.
   * 5 = relleno, entra solo si sobra espacio.
   * Los generadores de cv-short cortan por acá.
   */
  priority: 1 | 2 | 3 | 4 | 5;
}

/**
 * Texto en dos longitudes. El CV usa `short`, el portfolio usa `long`.
 * Escribir el mismo hecho dos veces es intencional: no son la misma frase
 * recortada, son dos registros distintos.
 */
export interface Prose {
  /** Una línea. Máx ~180 caracteres. Empieza con verbo en pasado. */
  short: string;
  /** Markdown. Sin límite. Solo si el portfolio agrega algo real. */
  long?: string;
}

export interface Link {
  label: string;
  url: string;
  /** Para el JSON-LD `sameAs` y para el bloque de contacto. */
  kind: "github" | "linkedin" | "website" | "demo" | "repo" | "article" | "other";
}

export interface Media {
  kind: "image" | "gif" | "video";
  url: string;
  /** Obligatorio: alt descriptivo. Es accesibilidad y es señal para agentes. */
  alt: string;
  caption?: string;
}

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

export interface Identity {
  fullName: string;
  /** Cómo te llamás en el trato diario. Para el portfolio, no para el CV. */
  preferredName: string;

  /** Identidad de marca. Vive en el portfolio y en el About. */
  brandTitle: string;      // "Product Engineer"
  /** Identidad de búsqueda. Va primero en el CV y en el titular de LinkedIn. */
  searchTitle: string;     // "Desarrollador Full Stack"
  /** Otros títulos por los que querés matchear en búsquedas booleanas. */
  titleAliases: string[];  // ["Full Stack Developer", "Desarrollador React"]

  location: {
    city: string;
    region: string;
    country: string;
    /** Para avisos remotos: "UTC-3". */
    timezone: string;
    /** La calle no va en ningún output público. Si no la necesitás, no la guardes. */
    streetAddress?: string;
  };

  contact: {
    email: string;
    phone?: string;
    /** Qué canales se publican en cada superficie. */
    publishPhoneOn: Surface[];
  };

  links: Link[];

  /**
   * Mes en que arranca tu experiencia profesional contable.
   * TODA mención de antigüedad se DERIVA de acá. Nunca se escribe "5 años"
   * a mano en ningún lado. Esto es lo que elimina las inconsistencias.
   */
  careerStart: YearMonth;

  /** Una frase memorable. La identidad, no el stack. */
  tagline: Prose;

  /** El About / extracto. `short` para el CV, `long` para LinkedIn y portfolio. */
  summary: Prose;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type SkillCategory =
  | "language"
  | "frontend"
  | "backend"
  | "data"
  | "testing"
  | "infra"
  | "cms"
  | "tooling"
  | "practice"; // TDD, code review, mentoring, RFCs

export interface Skill {
  id: string;              // "react", "mapbox-gl"
  /** Nombre canónico, exactamente como lo escribe la industria. */
  name: string;            // "React", "Mapbox GL JS"
  category: SkillCategory;
  /**
   * Variantes que aparecen en los avisos. El generador de CV-por-aviso
   * emite la variante EXACTA que usa la oferta. Los parsers viejos matchean literal.
   */
  aliases: string[];       // ["ReactJS", "React.js"]
  /**
   * Nivel declarado. Solo tres valores: más granularidad es ruido y no se puede defender.
   * `core` = lo podés discutir en profundidad en una entrevista técnica.
   */
  level: "core" | "working" | "familiar";
  /** Desde cuándo la usás en producción. Sirve para derivar "X años con React". */
  since?: YearMonth;
  /** Si es false, no aparece en ningún output. Para tecnologías que dejaste atrás. */
  active: boolean;
  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Logros — la unidad atómica del sistema
// ---------------------------------------------------------------------------

export interface Metric {
  /** Qué se movió. "tiempo de build", "horas semanales del equipo de ops" */
  label: string;
  before?: string;
  after?: string;
  /** O un delta directo si no hay antes/después. "-40%", "~4 h/semana" */
  delta?: string;
  /**
   * REGLA DURA: si es "estimated", el texto generado usa "~" o "aprox.".
   * Nunca se presenta una estimación como medición. Esto es lo que te
   * salva en la entrevista cuando pregunten cómo lo mediste.
   */
  confidence: "measured" | "estimated";
  /** Cómo lo sabés. No se publica, es tu nota para la entrevista. */
  source?: string;
}

export interface Achievement {
  id: string;
  /** A qué rol pertenece. */
  roleId: string;
  /** Si salió de un proyecto concreto, se enlaza. */
  projectId?: string;

  text: Prose;
  metric?: Metric;
  /** Skills usadas. Referencias a Skill.id. Habilita "todo lo que hice con Mapbox". */
  skillIds: string[];

  /**
   * Qué demuestra este logro. Permite armar un CV que cubra
   * las 4 dimensiones en vez de cuatro bullets de lo mismo.
   */
  dimension: "delivery" | "architecture" | "performance" | "ownership" | "collaboration" | "business";

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Experiencia
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  company: string;
  companyUrl?: string;
  /** Si hay NDA: "cliente global del sector tecnológico (Fortune 500)". */
  clientDescription?: string;

  /** Tu título REAL, el que figura en el contrato. No lo infles. */
  title: string;
  /**
   * Título con el que lo presentás, si difiere. Debe ser defendible:
   * describe el trabajo que hiciste, no un ascenso imaginario.
   */
  displayTitle?: string;

  employmentType: "full-time" | "part-time" | "contract" | "freelance" | "internship";
  /** Marcá true si se superpone con otro rol. El generador agrega la aclaración. */
  concurrent?: boolean;

  workMode: "remote" | "hybrid" | "onsite";
  location?: string;

  start: YearMonth;
  /** null = actual. La duración SIEMPRE se calcula, nunca se escribe. */
  end: YearMonth | null;

  /** Contexto de una línea: qué hacía la empresa, tamaño del equipo. */
  context: Prose;
  /** Los logros se referencian desde Achievement.roleId, no se anidan acá. */

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Proyectos y casos de estudio
// ---------------------------------------------------------------------------

/** Esto es lo que casi ningún portfolio tiene. Es tu diferencial. */
export interface TechnicalDecision {
  /** "Migrar el build de Webpack a Vite" */
  decision: string;
  /** Qué problema forzó la decisión. */
  context: string;
  /** Qué ganaste. */
  rationale: string;
  /** Qué resignaste. Si no hay trade-off, no era una decisión. */
  tradeoff: string;
  /** Opciones descartadas y por qué. */
  alternatives?: string[];
}

export interface Project {
  id: string;
  name: string;
  /** Cliente o "proyecto propio". */
  client?: string;
  /** Rol que ocupabas cuando lo hiciste, si aplica. */
  roleId?: string;

  /** Estado, para no mostrar cosas a medias como terminadas. */
  status: "shipped" | "in-progress" | "archived" | "prototype";
  start: YearMonth;
  end: YearMonth | null;

  /** El problema DE NEGOCIO. Dos frases. Nada de tecnología acá. */
  problem: Prose;
  /** Qué construiste. */
  solution: Prose;
  /** El resultado. Puede no haber número; entonces va un antes/después cualitativo. */
  outcome: Prose;
  metrics?: Metric[];

  /** Solo en el portfolio. En el CV no entran. */
  decisions?: TechnicalDecision[];

  skillIds: string[];
  links: Link[];
  media: Media[];

  /** Si es case study, tiene página propia con slug. */
  featured: boolean;
  slug?: string;

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Formación y otros
// ---------------------------------------------------------------------------

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  start?: YearMonth;
  end?: YearMonth | null;
  /** Sé explícito. "Parcial" es honesto y no penaliza; ocultarlo sí. */
  status: "completed" | "partial" | "in-progress";
  visibility: Visibility;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issued: YearMonth;
  expires?: YearMonth;
  credentialUrl?: string;
  visibility: Visibility;
}

export interface LanguageSkill {
  code: string;               // "es", "en"
  name: string;               // "Español", "Inglés"
  /** Usá el marco europeo: es verificable y lo entiende cualquier reclutador. */
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "native";
  /** Aclaración honesta si tu nivel escrito y hablado difieren. */
  note?: string;
}

/** Para el lado freelance del portfolio. No va al CV. */
export interface Service {
  id: string;
  name: string;
  description: Prose;
  /** Para quién es. Filtra los leads malos antes de que te escriban. */
  idealFor: string;
  deliverables: string[];
  /** Rango o "a convenir". Publicarlo filtra; no publicarlo genera más consultas. */
  priceRange?: string;
  visibility: Visibility;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  authorRole: string;
  company?: string;
  /** Sin permiso explícito, no se publica. */
  approved: boolean;
  projectId?: string;
  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Raíz
// ---------------------------------------------------------------------------

export interface ContentDataset {
  /** Versión del schema, para migraciones. */
  schemaVersion: string;
  locale: Locale;
  updatedAt: string; // ISO 8601

  identity: Identity;
  skills: Skill[];
  roles: Role[];
  achievements: Achievement[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  languages: LanguageSkill[];
  services: Service[];
  testimonials: Testimonial[];
}

// ---------------------------------------------------------------------------
// EL CONTRATO — lo único que el frontend conoce
// ---------------------------------------------------------------------------

/**
 * Todo lo que hay detrás (JSON en el repo, Sanity, backend propio)
 * implementa esta interfaz. Cambiar de backend = escribir otra implementación.
 * El frontend no se entera.
 */
export interface ContentSource {
  getDataset(locale: Locale): Promise<ContentDataset>;
  /** Ya filtrado y ordenado por superficie. Toda la lógica de visibility vive acá. */
  getView(surface: Surface, locale: Locale): Promise<ContentView>;
  getProject(slug: string, locale: Locale): Promise<Project | null>;
}

/** Un dataset ya resuelto para una superficie concreta. */
export interface ContentView {
  surface: Surface;
  identity: Identity;
  /** Roles con sus achievements ya anidados, filtrados y ordenados. */
  experience: Array<Role & { achievements: Achievement[]; durationMonths: number }>;
  projects: Project[];
  skills: Record<SkillCategory, Skill[]>;
  education: Education[];
  certifications: Certification[];
  languages: LanguageSkill[];
  services: Service[];
  testimonials: Testimonial[];
  /** Derivado de identity.careerStart. Nunca escrito a mano. */
  yearsOfExperience: number;
}
