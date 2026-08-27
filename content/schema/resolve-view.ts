/**
 * View resolution. THE shared layer.
 *
 * All the `visibility` logic — priority cutoffs, maximum bullets per role,
 * filtering of sensitive contact data, grouping and ordering — lives here and
 * ONLY here.
 *
 * The `ContentSource` implementations (json-source, and sanity-source one day)
 * are reduced to the only thing that differs between them: fetching the
 * dataset. Then they call `resolveView`. That is what makes the migration seam
 * genuinely one line, and what keeps rules 7 and 8 from forking per backend.
 *
 * The frontend NEVER replicates any of this. It receives a resolved
 * `ContentView`.
 */

import type {
  Achievement,
  ContentDataset,
  ContentView,
  Project,
  Role,
  Skill,
  SkillCategory,
  Surface,
  Visibility,
} from "./content-schema";
import { monthsBetween, yearsOfExperience } from "./dates";

/** Rule 7: how many items each surface takes, by priority. */
const PRIORITY_CUTOFF: Record<Surface, number> = {
  cv: 3,
  "cv-short": 2,
  "cv-ats": 3,
  portfolio: 5,
  linkedin: 3,
  "public-api": 5,
};

/** Rule 7: maximum bullets per role. null = no limit. */
const MAX_ACHIEVEMENTS_PER_ROLE: Record<Surface, number | null> = {
  cv: 5,
  "cv-short": 3,
  "cv-ats": 5,
  portfolio: null,
  linkedin: 4,
  "public-api": null,
};

function isVisible(v: Visibility, surface: Surface): boolean {
  if (v.only && !v.only.includes(surface)) return false;
  if (v.except?.includes(surface)) return false;
  return v.priority <= PRIORITY_CUTOFF[surface];
}

function groupSkills(skills: Skill[]): Record<SkillCategory, Skill[]> {
  const empty: Record<SkillCategory, Skill[]> = {
    language: [],
    frontend: [],
    backend: [],
    data: [],
    testing: [],
    infra: [],
    cms: [],
    tooling: [],
    practice: [],
  };
  for (const s of skills) empty[s.category].push(s);
  return empty;
}

function byRecency<T extends { start: string; end: string | null }>(a: T, b: T) {
  if (a.end === null && b.end !== null) return -1;
  if (b.end === null && a.end !== null) return 1;
  return b.start.localeCompare(a.start);
}

/** A full dataset → a view resolved for one surface. Pure, no I/O. */
export function resolveView(data: ContentDataset, surface: Surface): ContentView {
  const achievementsByRole = new Map<string, Achievement[]>();
  for (const a of data.achievements) {
    if (!isVisible(a.visibility, surface)) continue;
    const list = achievementsByRole.get(a.roleId) ?? [];
    list.push(a);
    achievementsByRole.set(a.roleId, list);
  }

  const maxPerRole = MAX_ACHIEVEMENTS_PER_ROLE[surface];

  const experience = data.roles
    .filter((r: Role) => isVisible(r.visibility, surface))
    .sort(byRecency)
    .map((role) => {
      const all = (achievementsByRole.get(role.id) ?? []).sort(
        (a, b) => a.visibility.priority - b.visibility.priority,
      );
      return {
        ...role,
        achievements: maxPerRole === null ? all : all.slice(0, maxPerRole),
        durationMonths: monthsBetween(role.start, role.end),
      };
    });

  const projects = data.projects
    .filter((p: Project) => isVisible(p.visibility, surface))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || byRecency(a, b));

  // Rule 8: sensitive contact data only leaves where it was authorised.
  const identity = {
    ...data.identity,
    contact: {
      ...data.identity.contact,
      phone: data.identity.contact.publishPhoneOn.includes(surface)
        ? data.identity.contact.phone
        : undefined,
    },
    location: {
      ...data.identity.location,
      streetAddress: undefined, // never leaves in a public output
    },
  };

  return {
    surface,
    identity,
    experience,
    projects,
    skills: groupSkills(
      data.skills.filter((s) => s.active && isVisible(s.visibility, surface)),
    ),
    education: data.education.filter((e) => isVisible(e.visibility, surface)),
    certifications: data.certifications.filter((c) => isVisible(c.visibility, surface)),
    languages: data.languages,
    services: data.services.filter((s) => isVisible(s.visibility, surface)),
    testimonials: data.testimonials.filter(
      (t) => t.approved && isVisible(t.visibility, surface),
    ),
    yearsOfExperience: yearsOfExperience(data.identity.careerStart),
  };
}
