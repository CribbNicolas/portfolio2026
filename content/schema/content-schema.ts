/**
 * ============================================================================
 *  CONTENT SCHEMA — Single source of truth for CV, portfolio and profiles
 * ============================================================================
 *
 *  Guiding principle: the backend stores ATOMIC FACTS, not documents.
 *  The CV, the portfolio and the LinkedIn blocks are derived VIEWS.
 *
 *  Compatible in spirit with JSON Resume (jsonresume.org), extended with what
 *  that standard does not cover: surfaces, case studies with technical
 *  decisions, and skill traceability.
 *
 *  Locale: one dataset per language (content.es.json / content.en.json).
 *  The locale lives at the root, NOT per field. It simplifies everything.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Date in YYYY-MM format. Never free strings, never hand-written durations. */
export type YearMonth = `${number}-${number}`;

export type Locale = "es" | "en";

/**
 * Where an item is shown. A fact can live in the portfolio and not in the CV.
 * This is the field that settles "the portfolio holds more than the CV".
 */
export type Surface =
  | "cv"          // full CV (2 pages, designed)
  | "cv-short"    // 1 page CV, strongest items only
  | "cv-ats"      // single column version for forms
  | "portfolio"   // personal site, no space limit
  | "linkedin"    // blocks to copy and paste
  | "public-api"; // /cv.json and llms.txt

/** Default: visible on every surface. Overrides are the exception. */
export interface Visibility {
  /** When set, it appears ONLY on these surfaces. */
  only?: Surface[];
  /** Never appears on these. Applied after `only`. */
  except?: Surface[];
  /**
   * 1 = essential, always included.
   * 5 = filler, included only if space is left over.
   * The cv-short generators cut here.
   */
  priority: 1 | 2 | 3 | 4 | 5;
}

/**
 * Text at two lengths. The CV uses `short`, the portfolio uses `long`.
 * Writing the same fact twice is intentional: they are not the same sentence
 * trimmed, they are two different registers.
 */
export interface Prose {
  /** One line. Max ~180 characters. Starts with a past tense verb. */
  short: string;
  /** Markdown. No limit. Only when the portfolio adds something real. */
  long?: string;
}

export interface Link {
  label: string;
  url: string;
  /** For the JSON-LD `sameAs` and for the contact block. */
  kind: "github" | "linkedin" | "website" | "demo" | "repo" | "article" | "other";
}

export interface Media {
  kind: "image" | "gif" | "video";
  url: string;
  /** Mandatory: descriptive alt. It is accessibility, and it is signal for agents. */
  alt: string;
  caption?: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface Identity {
  fullName: string;
  /** What you are called day to day. For the portfolio, not for the CV. */
  preferredName: string;

  /** Brand identity. Lives in the portfolio and in the About. */
  brandTitle: string;      // "Product Engineer"
  /** Search identity. Goes first in the CV and in the LinkedIn headline. */
  searchTitle: string;     // "Desarrollador Full Stack"
  /** Other titles you want to match on in boolean searches. */
  titleAliases: string[];  // ["Full Stack Developer", "Desarrollador React"]

  location: {
    city: string;
    region: string;
    country: string;
    /** For remote job posts: "UTC-3". */
    timezone: string;
    /** The street never goes in a public output. If you do not need it, do not store it. */
    streetAddress?: string;
  };

  contact: {
    email: string;
    phone?: string;
    /** Which channels get published on each surface. */
    publishPhoneOn: Surface[];
  };

  links: Link[];

  /**
   * Month your countable professional experience starts.
   * EVERY mention of seniority is DERIVED from here. "5 years" is never written
   * by hand anywhere. This is what removes the inconsistencies.
   */
  careerStart: YearMonth;

  /** One memorable sentence. The identity, not the stack. */
  tagline: Prose;

  /** The About / summary. `short` for the CV, `long` for LinkedIn and portfolio. */
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

/** One stretch of use of a skill. No `end` means you still use it. */
export interface SkillPeriod {
  start: YearMonth;
  end?: YearMonth;
}

export interface Skill {
  id: string;              // "react", "mapbox-gl"
  /** Canonical name, exactly as the industry writes it. */
  name: string;            // "React", "Mapbox GL JS"
  category: SkillCategory;
  /**
   * Variants that show up in job posts. The per-post CV generator emits the
   * EXACT variant the offer uses. Old parsers match literally.
   */
  aliases: string[];       // ["ReactJS", "React.js"]
  /**
   * Declared level. Three values only: more granularity is noise and cannot be
   * defended. `core` = you can discuss it in depth in a technical interview.
   */
  level: "core" | "working" | "familiar";
  /**
   * When you used it in production. Feeds "X years with React".
   *
   * A LIST, because a technology gets dropped and picked back up, and the
   * years are the sum of the merged periods (`monthsFromPeriods`): a three
   * year gap is not experience. It is UNIONed with what the roles and projects
   * citing the skill already imply — declaring here adds what no achievement
   * records, it never overrides real evidence.
   */
  periods?: SkillPeriod[];
  /** When false it appears in no output. For technologies you left behind. */
  active: boolean;
  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Achievements — the atomic unit of the system
// ---------------------------------------------------------------------------

export interface Metric {
  /** What moved. "tiempo de build", "horas semanales del equipo de ops" */
  label: string;
  before?: string;
  after?: string;
  /** Or a direct delta when there is no before/after. "-40%", "~4 h/semana" */
  delta?: string;
  /**
   * HARD RULE: when "estimated", the generated text uses "~" or "aprox.".
   * An estimate is never presented as a measurement. This is what saves you in
   * the interview when they ask how you measured it.
   */
  confidence: "measured" | "estimated";
  /** How you know. Not published — it is your note for the interview. */
  source?: string;
}

export interface Achievement {
  id: string;
  /** Which role it belongs to. */
  roleId: string;
  /** If it came out of a concrete project, it links to it. */
  projectId?: string;

  text: Prose;
  metric?: Metric;
  /** Skills used. References to Skill.id. Enables "everything I did with Mapbox". */
  skillIds: string[];

  /**
   * What this achievement demonstrates. Lets you build a CV covering the 4
   * dimensions instead of four bullets about the same thing.
   */
  dimension: "delivery" | "architecture" | "performance" | "ownership" | "collaboration" | "business";

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  company: string;
  companyUrl?: string;
  /** When under NDA: "cliente global del sector tecnológico (Fortune 500)". */
  clientDescription?: string;

  /** Your REAL title, the one on the contract. Do not inflate it. */
  title: string;
  /**
   * The title you present it under, when it differs. It has to be defensible:
   * it describes the work you did, not an imaginary promotion.
   */
  displayTitle?: string;

  employmentType: "full-time" | "part-time" | "contract" | "freelance" | "internship";
  /** Set true when it overlaps another role. The generator adds the note. */
  concurrent?: boolean;

  workMode: "remote" | "hybrid" | "onsite";
  location?: string;

  start: YearMonth;
  /** null = current. The duration is ALWAYS computed, never written. */
  end: YearMonth | null;

  /** One line of context: what the company did, size of the team. */
  context: Prose;
  /** Achievements reference this via Achievement.roleId; they are not nested here. */

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Projects and case studies
// ---------------------------------------------------------------------------

/** This is what almost no portfolio has. It is your differentiator. */
export interface TechnicalDecision {
  /** "Migrar el build de Webpack a Vite" */
  decision: string;
  /** What problem forced the decision. */
  context: string;
  /** What you gained. */
  rationale: string;
  /** What you gave up. With no trade-off it was not a decision. */
  tradeoff: string;
  /** Options discarded, and why. */
  alternatives?: string[];
}

export interface Project {
  id: string;
  name: string;
  /** Client, or "project propio". */
  client?: string;
  /** The role you held when you did it, when applicable. */
  roleId?: string;

  /** Status, so half-done things are not shown as finished. */
  status: "shipped" | "in-progress" | "archived" | "prototype";
  start: YearMonth;
  end: YearMonth | null;

  /** The BUSINESS problem. Two sentences. No technology here. */
  problem: Prose;
  /** What you built. */
  solution: Prose;
  /** The outcome. There may be no number; then a qualitative before/after goes in. */
  outcome: Prose;
  metrics?: Metric[];

  /** Portfolio only. These do not fit in the CV. */
  decisions?: TechnicalDecision[];

  skillIds: string[];
  links: Link[];
  media: Media[];

  /** A case study gets its own page and a slug. */
  featured: boolean;
  slug?: string;

  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Education and the rest
// ---------------------------------------------------------------------------

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  start?: YearMonth;
  end?: YearMonth | null;
  /** Be explicit. "Partial" is honest and costs nothing; hiding it does. */
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
  /** Use the European framework: verifiable, and every recruiter understands it. */
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "native";
  /** An honest note when your written and spoken levels differ. */
  note?: string;
}

/** For the freelance side of the portfolio. Does not go in the CV. */
export interface Service {
  id: string;
  name: string;
  description: Prose;
  /** Who it is for. Filters bad leads before they write to you. */
  idealFor: string;
  deliverables: string[];
  /** A range or "a convenir". Publishing it filters; not publishing draws more enquiries. */
  priceRange?: string;
  visibility: Visibility;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  authorRole: string;
  company?: string;
  /** Without explicit permission, it is not published. */
  approved: boolean;
  projectId?: string;
  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface ContentDataset {
  /** Schema version, for migrations. */
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
// THE CONTRACT — the only thing the frontend knows
// ---------------------------------------------------------------------------

/**
 * Everything behind it (JSON in the repo, Sanity, your own backend)
 * implements this interface. Changing backend = writing another
 * implementation. The frontend never notices.
 */
export interface ContentSource {
  getDataset(locale: Locale): Promise<ContentDataset>;
  /** Already filtered and ordered per surface. All the visibility logic lives here. */
  getView(surface: Surface, locale: Locale): Promise<ContentView>;
  getProject(slug: string, locale: Locale): Promise<Project | null>;
}

/**
 * An entity as it LEAVES `resolveView`.
 *
 * `visibility` is an authoring decision — which surfaces an item is for, and
 * how highly you rank it. `resolveView` has already spent it by the time a view
 * exists, and `/cv.json` publishes whatever the view holds. Removing it from
 * the type makes invariant 1 a compile error instead of a convention: a
 * component cannot filter by a field that is not there.
 */
export type Viewed<T> = Omit<T, "visibility">;

/** A metric as it leaves the view: `source` is the author's note, not output. */
export type ViewedMetric = Omit<Metric, "source">;

/** An achievement in a view: no `visibility`, and its metric carries no `source`. */
export type ViewedAchievement = Viewed<Achievement> & { metric?: ViewedMetric };

/**
 * A project in a view: no `visibility`, and none of its `metrics` carry
 * `source` — a project holds a LIST of metrics, not one, so `Viewed<Project>`
 * alone would still leak the field one level down.
 */
export type ViewedProject = Viewed<Project> & { metrics?: ViewedMetric[] };

/** Identity in a view: rule 8 already decided the phone; the policy does not ship. */
export type ViewedIdentity = Omit<Identity, "contact"> & {
  contact: Omit<Identity["contact"], "publishPhoneOn">;
};

/** A dataset already resolved for one concrete surface. */
export interface ContentView {
  surface: Surface;
  identity: ViewedIdentity;
  /** Roles with their achievements already nested, filtered and ordered. */
  experience: Array<
    Viewed<Role> & { achievements: ViewedAchievement[]; durationMonths: number }
  >;
  projects: ViewedProject[];
  skills: Record<SkillCategory, Viewed<Skill>[]>;
  education: Viewed<Education>[];
  certifications: Viewed<Certification>[];
  languages: LanguageSkill[];
  services: Viewed<Service>[];
  testimonials: Viewed<Testimonial>[];
  /** Derived from identity.careerStart. Never written by hand. */
  yearsOfExperience: number;
}
