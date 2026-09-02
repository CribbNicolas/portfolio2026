/**
 * Dataset validation.
 *
 * Two layers:
 *  1. Zod  → the shape. That fields exist and hold the right type.
 *  2. Hard rules → the coherence. What a type cannot express.
 *
 * Run `validateDataset()` in CI. If it fails, nothing deploys.
 */

import { z } from "zod";
import type { ContentDataset, Prose } from "./content-schema";
import { toMonths } from "./dates";

// ---------------------------------------------------------------------------
// 1. Shape (Zod)
// ---------------------------------------------------------------------------
//
// Every object carries `.strict()`: a key present in the JSON but absent from
// the Zod schema throws instead of being dropped silently. Without it,
// forgetting to mirror a new interface field in Zod goes unnoticed — exactly
// the failure mode this project fights. If you add a field to an interface, add
// it here in the same commit.

const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected format: YYYY-MM");

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
  short: z.string().min(1).max(180, "The short text cannot exceed 180 characters"),
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

const skillPeriod = z.object({
  start: yearMonth,
  end: yearMonth.optional(),
}).strict();

const media = z.object({
  kind: z.enum(["image", "gif", "video"]),
  url: z.string(),
  alt: z.string().min(1, "Rule 5: every media needs an alt"),
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
  periods: z.array(skillPeriod).optional(),
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
  tradeoff: z.string().min(1, "With no trade-off it was not a decision"),
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
// 2. Hard rules (the ones in CONTRACT.md)
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

/** Every `Prose` field in the dataset as `[path, text]`. short always, long when present. */
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

  // Rule 2: no two overlapping full-time roles without `concurrent`
  const fullTime = data.roles.filter((r) => r.employmentType === "full-time");
  for (let i = 0; i < fullTime.length; i++) {
    for (let j = i + 1; j < fullTime.length; j++) {
      const a = fullTime[i];
      const b = fullTime[j];
      if (overlaps(a, b, now) && !a.concurrent && !b.concurrent) {
        violations.push({
          rule: 2,
          message: `"${a.company}" y "${b.company}" overlap as full-time. Mark one with concurrent: true or fix the employment type.`,
        });
      }
    }
  }

  // Rule 3: every "core" skill needs evidence
  const usedSkillIds = new Set<string>([
    ...data.achievements.flatMap((a) => a.skillIds),
    ...data.projects.flatMap((p) => p.skillIds),
  ]);
  for (const s of data.skills) {
    if (s.level === "core" && s.active && !usedSkillIds.has(s.id)) {
      violations.push({
        rule: 3,
        message: `"${s.name}" is declared core but no achievement or project references it. Either drop it to working, or write down where you used it.`,
      });
    }
  }

  // `Skill.periods` coherence. Not a numbered contract rule: it is shape
  // coherence, the same kind as the referential integrity below. Zod checks a
  // period has `start` and `end` in YYYY-MM; that `end` comes AFTER, and that
  // two declared periods do not overlap, is not something a type can express.
  // `monthsFromPeriods` merges the overlapping ones, so without this rule a
  // duplicated period would be absorbed silently.
  for (const s of data.skills) {
    const periods = s.periods ?? [];
    for (const p of periods) {
      if (p.end && toMonths(p.end) <= toMonths(p.start)) {
        violations.push({
          rule: 0,
          message: `Skill "${s.id}": the period ${p.start} → ${p.end} ends before it starts, or lasts zero months.`,
        });
      }
    }
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = { start: periods[i].start, end: periods[i].end ?? null };
        const b = { start: periods[j].start, end: periods[j].end ?? null };
        if (overlaps(a, b, now)) {
          violations.push({
            rule: 0,
            message: `Skill "${s.id}": the periods ${a.start}→${a.end ?? "today"} and ${b.start}→${b.end ?? "today"} overlap. Merge them into one.`,
          });
        }
      }
    }
  }

  // Referential integrity
  const roleIds = new Set(data.roles.map((r) => r.id));
  const projectIds = new Set(data.projects.map((p) => p.id));
  const skillIds = new Set(data.skills.map((s) => s.id));
  for (const a of data.achievements) {
    if (!roleIds.has(a.roleId)) {
      violations.push({ rule: 0, message: `Achievement "${a.id}" points at a roleId that does not exist: ${a.roleId}` });
    }
    if (a.projectId && !projectIds.has(a.projectId)) {
      violations.push({ rule: 0, message: `Achievement "${a.id}" points at a projectId that does not exist: ${a.projectId}` });
    }
    for (const sid of a.skillIds) {
      if (!skillIds.has(sid)) {
        violations.push({ rule: 0, message: `Achievement "${a.id}" references a skill that does not exist: ${sid}` });
      }
    }
  }

  // Rule 1: no hand-written duration.
  // EVERY Prose field in the dataset is walked (short and long), not a
  // hand-kept list: that way no hole is left by a new field someone forgets to
  // add. The pattern keeps the Spanish words because the prose it scans is the
  // CV content, which is written in Spanish.
  const durationPattern = /\b\d+\s*(años?|meses|years?|months?)\b/i;
  for (const [field, value] of collectProse(data)) {
    if (durationPattern.test(value)) {
      violations.push({
        rule: 1,
        message: `${field} has a hand-written duration. It is derived from careerStart / start / end.`,
      });
    }
  }

  // Rule 6: unapproved testimonials are not published
  for (const t of data.testimonials) {
    if (!t.approved && !t.visibility.except?.length) {
      violations.push({
        rule: 6,
        message: `Testimonio "${t.id}" is not approved and has no exclusions. Do not publish it until you have the OK.`,
      });
    }
  }

  return violations;
}

/** The single entry point. Call this from a test or a CI script. */
export function validateDataset(input: unknown): ContentDataset {
  const parsed = datasetSchema.parse(input) as ContentDataset;
  const violations = checkRules(parsed);
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `  [rule ${v.rule}] ${v.message}`)
      .join("\n");
    throw new Error(`The dataset violates ${violations.length} rule(s):\n${detail}`);
  }
  return parsed;
}
