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
 * The labels live in this table, each paired with its `SkillCategory`. They
 * could live in `messages.ts` with the rest of the chrome copy, but keeping
 * them here — one column away from the category they name — is what prevents
 * the label and the order from drifting apart. Keeping them together is the
 * deliberate design that fixed this problem (`07-technical-debt.md` §9).
 * The labels are printed exactly as they appear in the CV, and parsers map
 * `Habilidades técnicas` and the categories under it to these entries.
 */

import type { Locale, SkillCategory } from "./content-schema";

/**
 * The order is editorial, not alphabetical and not the schema's: what is
 * searched for most in a job posting comes first. A recruiter scanning the
 * block reads the first two lines and stops. The order is the same in both
 * locales — it does not change with the language, only the labels do.
 */
export const SKILL_GROUPS: Record<Locale, ReadonlyArray<readonly [SkillCategory, string]>> = {
  es: [
    ["language", "Lenguajes"],
    ["frontend", "Frontend"],
    ["backend", "Backend"],
    ["data", "Datos"],
    ["cms", "CMS"],
    ["testing", "Testing"],
    ["infra", "Infraestructura"],
    ["tooling", "Herramientas"],
    ["practice", "Prácticas"],
  ],
  en: [
    ["language", "Languages"],
    ["frontend", "Frontend"],
    ["backend", "Backend"],
    ["data", "Data"],
    ["cms", "CMS"],
    ["testing", "Testing"],
    ["infra", "Infrastructure"],
    ["tooling", "Tooling"],
    ["practice", "Practices"],
  ],
};

/**
 * The grouped skills of a view, in order, with the empty categories dropped.
 *
 * Both consumers call this instead of walking `view.skills` themselves: that
 * walk is exactly what drifted.
 *
 * Generic over the skill shape rather than fixed to `Skill`: the caller always
 * passes `ContentView["skills"]`, whose entries are `Viewed<Skill>` (no
 * `visibility`), and this function only groups — it never reads that field.
 */
export function groupedSkills<S>(
  skills: Record<SkillCategory, S[]>,
  locale: Locale,
): Array<{ label: string; skills: S[] }> {
  return SKILL_GROUPS[locale]
    .map(([category, label]) => ({ label, skills: skills[category] ?? [] }))
    .filter((group) => group.skills.length > 0);
}
