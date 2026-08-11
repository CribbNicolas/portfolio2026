/**
 * Validación del dataset.
 *
 * Dos capas:
 *  1. Zod  → la forma. Que los campos existan y tengan el tipo correcto.
 *  2. Reglas duras → la coherencia. Lo que el tipo no puede expresar.
 *
 * Correr `validateDataset()` en CI. Si falla, no deployea.
 */

import { z } from "zod";
import type { ContentDataset, Prose } from "./content-schema";
import { toMonths } from "./dates";

// ---------------------------------------------------------------------------
// 1. Forma (Zod)
// ---------------------------------------------------------------------------
//
// Todos los objetos llevan `.strict()`: una clave presente en el JSON pero
// ausente del schema Zod tira error, en vez de descartarse en silencio. Sin esto,
// olvidarse de reflejar en Zod un campo nuevo de la interface pasa desapercibido
// —justo el modo de falla que este proyecto combate—. Si agregás un campo a una
// interface, agregalo también acá en el mismo commit.

const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado: YYYY-MM");

const surface = z.enum([
  "cv",
  "cv-short",
  "cv-ats",
  "portfolio",
  "linkedin",
  "public-api",
]);

const visibility = z.object({
  only: z.array(surface).optional(),
  except: z.array(surface).optional(),
  priority: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
}).strict();

const prose = z.object({
  short: z.string().min(1).max(180, "El texto corto no puede pasar 180 caracteres"),
  long: z.string().optional(),
}).strict();

const link = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.enum([
    "github",
    "linkedin",
    "website",
    "demo",
    "repo",
    "article",
    "other",
  ]),
}).strict();

const media = z.object({
  kind: z.enum(["image", "gif", "video"]),
  url: z.string(),
  alt: z.string().min(1, "Regla 5: todo media necesita alt"),
  caption: z.string().optional(),
}).strict();

const metric = z.object({
  label: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  delta: z.string().optional(),
  confidence: z.enum(["measured", "estimated"]),
  source: z.string().optional(),
}).strict();

const identity = z.object({
  fullName: z.string(),
  preferredName: z.string(),
  brandTitle: z.string(),
  searchTitle: z.string(),
  titleAliases: z.array(z.string()),
  location: z.object({
    city: z.string(),
    region: z.string(),
    country: z.string(),
    timezone: z.string(),
    streetAddress: z.string().optional(),
  }).strict(),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    publishPhoneOn: z.array(surface),
  }).strict(),
  links: z.array(link),
  careerStart: yearMonth,
  tagline: prose,
  summary: prose,
}).strict();

const skill = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    "language",
    "frontend",
    "backend",
    "data",
    "testing",
    "infra",
    "cms",
    "tooling",
    "practice",
  ]),
  aliases: z.array(z.string()),
  level: z.enum(["core", "working", "familiar"]),
  since: yearMonth.optional(),
  active: z.boolean(),
  visibility,
}).strict();

const achievement = z.object({
  id: z.string(),
  roleId: z.string(),
  projectId: z.string().optional(),
  text: prose,
  metric: metric.optional(),
  skillIds: z.array(z.string()),
  dimension: z.enum([
    "delivery",
    "architecture",
    "performance",
    "ownership",
    "collaboration",
    "business",
  ]),
  visibility,
}).strict();

const role = z.object({
  id: z.string(),
  company: z.string(),
  companyUrl: z.string().url().optional(),
  clientDescription: z.string().optional(),
  title: z.string(),
  displayTitle: z.string().optional(),
  employmentType: z.enum([
    "full-time",
    "part-time",
    "contract",
    "freelance",
    "internship",
  ]),
  concurrent: z.boolean().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  location: z.string().optional(),
  start: yearMonth,
  end: yearMonth.nullable(),
  context: prose,
  visibility,
}).strict();

const technicalDecision = z.object({
  decision: z.string(),
  context: z.string(),
  rationale: z.string(),
  tradeoff: z.string().min(1, "Si no hay trade-off, no era una decisión"),
  alternatives: z.array(z.string()).optional(),
}).strict();

const project = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string().optional(),
  roleId: z.string().optional(),
  status: z.enum(["shipped", "in-progress", "archived", "prototype"]),
  start: yearMonth,
  end: yearMonth.nullable(),
  problem: prose,
  solution: prose,
  outcome: prose,
  metrics: z.array(metric).optional(),
  decisions: z.array(technicalDecision).optional(),
  skillIds: z.array(z.string()),
  links: z.array(link),
  media: z.array(media),
  featured: z.boolean(),
  slug: z.string().optional(),
  visibility,
}).strict();

const education = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  start: yearMonth.optional(),
  end: yearMonth.nullable().optional(),
  status: z.enum(["completed", "partial", "in-progress"]),
  visibility,
}).strict();

const certification = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  issued: yearMonth,
  expires: yearMonth.optional(),
  credentialUrl: z.string().url().optional(),
  visibility,
}).strict();

const languageSkill = z.object({
  code: z.string(),
  name: z.string(),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]),
  note: z.string().optional(),
}).strict();

const service = z.object({
  id: z.string(),
  name: z.string(),
  description: prose,
  idealFor: z.string(),
  deliverables: z.array(z.string()),
  priceRange: z.string().optional(),
  visibility,
}).strict();

const testimonial = z.object({
  id: z.string(),
  quote: z.string(),
  author: z.string(),
  authorRole: z.string(),
  company: z.string().optional(),
  approved: z.boolean(),
  projectId: z.string().optional(),
  visibility,
}).strict();

export const datasetSchema = z.object({
  schemaVersion: z.string(),
  locale: z.enum(["es", "en"]),
  updatedAt: z.string(),
  identity,
  skills: z.array(skill),
  roles: z.array(role),
  achievements: z.array(achievement),
  projects: z.array(project),
  education: z.array(education),
  certifications: z.array(certification),
  languages: z.array(languageSkill),
  services: z.array(service),
  testimonials: z.array(testimonial),
}).strict();

// ---------------------------------------------------------------------------
// 2. Reglas duras (las del CONTRATO.md)
// ---------------------------------------------------------------------------

export interface RuleViolation {
  rule: number;
  message: string;
}

const overlaps = (
  a: { start: string; end: string | null },
  b: { start: string; end: string | null },
  now: number,
): boolean => {
  const aStart = toMonths(a.start);
  const aEnd = a.end ? toMonths(a.end) : now;
  const bStart = toMonths(b.start);
  const bEnd = b.end ? toMonths(b.end) : now;
  return aStart < bEnd && bStart < aEnd;
};

/** Todo campo `Prose` del dataset como `[ruta, texto]`. short siempre, long si existe. */
function collectProse(data: ContentDataset): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (path: string, p?: Prose): void => {
    if (!p) return;
    out.push([`${path}.short`, p.short]);
    if (p.long) out.push([`${path}.long`, p.long]);
  };
  add("identity.tagline", data.identity.tagline);
  add("identity.summary", data.identity.summary);
  for (const r of data.roles) add(`role:${r.id}.context`, r.context);
  for (const a of data.achievements) add(`achievement:${a.id}.text`, a.text);
  for (const p of data.projects) {
    add(`project:${p.id}.problem`, p.problem);
    add(`project:${p.id}.solution`, p.solution);
    add(`project:${p.id}.outcome`, p.outcome);
  }
  for (const s of data.services) add(`service:${s.id}.description`, s.description);
  return out;
}

export function checkRules(data: ContentDataset): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const now = toMonths(new Date().toISOString().slice(0, 7));

  // Regla 2: no dos full-time superpuestos sin `concurrent`
  const fullTime = data.roles.filter((r) => r.employmentType === "full-time");
  for (let i = 0; i < fullTime.length; i++) {
    for (let j = i + 1; j < fullTime.length; j++) {
      const a = fullTime[i];
      const b = fullTime[j];
      if (overlaps(a, b, now) && !a.concurrent && !b.concurrent) {
        violations.push({
          rule: 2,
          message: `"${a.company}" y "${b.company}" se superponen como full-time. Marcá uno con concurrent: true o corregí el tipo de contrato.`,
        });
      }
    }
  }

  // Regla 3: toda skill "core" necesita evidencia
  const usedSkillIds = new Set<string>([
    ...data.achievements.flatMap((a) => a.skillIds),
    ...data.projects.flatMap((p) => p.skillIds),
  ]);
  for (const s of data.skills) {
    if (s.level === "core" && s.active && !usedSkillIds.has(s.id)) {
      violations.push({
        rule: 3,
        message: `"${s.name}" está declarada como core pero ningún logro ni proyecto la referencia. O la bajás a working, o escribís dónde la usaste.`,
      });
    }
  }

  // Integridad referencial
  const roleIds = new Set(data.roles.map((r) => r.id));
  const projectIds = new Set(data.projects.map((p) => p.id));
  const skillIds = new Set(data.skills.map((s) => s.id));
  for (const a of data.achievements) {
    if (!roleIds.has(a.roleId)) {
      violations.push({ rule: 0, message: `Achievement "${a.id}" apunta a un roleId inexistente: ${a.roleId}` });
    }
    if (a.projectId && !projectIds.has(a.projectId)) {
      violations.push({ rule: 0, message: `Achievement "${a.id}" apunta a un projectId inexistente: ${a.projectId}` });
    }
    for (const sid of a.skillIds) {
      if (!skillIds.has(sid)) {
        violations.push({ rule: 0, message: `Achievement "${a.id}" referencia una skill inexistente: ${sid}` });
      }
    }
  }

  // Regla 1: ninguna duración escrita a mano.
  // Se recorre TODO campo Prose del dataset (short y long), no una lista a mano:
  // así no quedan agujeros por campos nuevos que alguien olvide agregar.
  const durationPattern = /\b\d+\s*(años?|meses|years?|months?)\b/i;
  for (const [field, value] of collectProse(data)) {
    if (durationPattern.test(value)) {
      violations.push({
        rule: 1,
        message: `${field} tiene una duración escrita a mano. Se deriva de careerStart / start / end.`,
      });
    }
  }

  // Regla 6: testimonios sin aprobar no se publican
  for (const t of data.testimonials) {
    if (!t.approved && !t.visibility.except?.length) {
      violations.push({
        rule: 6,
        message: `Testimonio "${t.id}" no está aprobado y no tiene exclusiones. No lo publiques hasta tener el OK.`,
      });
    }
  }

  return violations;
}

/** Punto de entrada único. Tirá esto en un test o en un script de CI. */
export function validateDataset(input: unknown): ContentDataset {
  const parsed = datasetSchema.parse(input) as ContentDataset;
  const violations = checkRules(parsed);
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `  [regla ${v.rule}] ${v.message}`)
      .join("\n");
    throw new Error(`El dataset viola ${violations.length} regla(s):\n${detail}`);
  }
  return parsed;
}
