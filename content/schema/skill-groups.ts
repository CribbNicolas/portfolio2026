/**
 * How skills are grouped and in what order. ONE definition.
 *
 * Two outputs print this list — the CV (`SkillList.astro`) and `/llms.txt` —
 * and they used to disagree. The CV said `Lenguajes: ...` in editorial order;
 * `/llms.txt` said `- language: ...` in whatever order `Object.entries` handed
 * back. An agent comparing the two surfaces saw two taxonomies for the same
 * data (`07-technical-debt.md` §9).
 *
 * Same pattern as `formatMetric` (rule 4) and `pdf-options.ts`: when two outputs
 * have to say the same thing, the definition lives in one place.
 *
 * The labels stay in Spanish because they are printed: a parser maps
 * `Habilidades técnicas` and the categories under it exactly as they appear in
 * the CV.
 */

import type { Skill, SkillCategory } from "./content-schema";

/**
 * The order is editorial, not alphabetical and not the schema's: what is
 * searched for most in a job posting comes first. A recruiter scanning the
 * block reads the first two lines and stops.
 */
export const SKILL_GROUPS: ReadonlyArray<readonly [SkillCategory, string]> = [
  ["language", "Lenguajes"],
  ["frontend", "Frontend"],
  ["backend", "Backend"],
  ["data", "Datos"],
  ["cms", "CMS"],
  ["testing", "Testing"],
  ["infra", "Infraestructura"],
  ["tooling", "Herramientas"],
  ["practice", "Prácticas"],
];

/**
 * The grouped skills of a view, in order, with the empty categories dropped.
 *
 * Both consumers call this instead of walking `view.skills` themselves: that
 * walk is exactly what drifted.
 */
export function groupedSkills(
  skills: Record<SkillCategory, Skill[]>,
): Array<{ label: string; skills: Skill[] }> {
  return SKILL_GROUPS
    .map(([category, label]) => ({ label, skills: skills[category] ?? [] }))
    .filter((group) => group.skills.length > 0);
}
