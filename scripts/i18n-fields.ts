/**
 * Every translatable string of a dataset, keyed by a stable path.
 *
 * `achievements.dinkum-mapbox.text.short`, never `achievements.4.text.short`:
 * an index changes when something is reordered, and the whole lock would go
 * stale for a change that touched no text.
 *
 * The set of translatable leaves is a DENYLIST of key names rather than "every
 * string": `id`, `slug`, `start` and the entries of `skillIds` are strings too,
 * and treating them as translatable would ask for an English version of an id.
 * A denylist is the safe direction — a new prose field is tracked the day it is
 * added, and the failure mode of forgetting one is a field nobody translates,
 * not a lock full of ids.
 */

import type { ContentDataset } from "../content/schema/content-schema";

/** Structural or numeric. Never translated, never hashed. */
const NOT_TEXT = new Set([
  "id", "slug", "locale", "schemaVersion", "updatedAt",
  "start", "end", "careerStart", "date",
  "roleId", "projectId", "skillId", "skillIds", "category", "level",
  "employmentType", "workMode", "status", "confidence", "dimension",
  "priority", "only", "except", "visibility", "publishPhoneOn",
  // `before`/`after` are numbers with a unit baked in: "500 ms" is "500 ms"
  // in both languages, so the value is copied, not translated. `delta` is
  // deliberately NOT in this set — see the comment above `translatableFields`
  // for why it moved out.
  "before", "after",
  "url", "email", "phone", "featured", "active", "approved",
  "company", "client", "institution", "name",  // proper nouns
  // `LanguageSkill.code` is the identifier (`es` / `en`), not prose. It is
  // what `arrayKey` uses when there is no `id`.
  "code",
  // `Link.kind` is a closed union of identifiers ("github" | "linkedin" | …),
  // not prose: there is no English version of a tag, only a fixed set of
  // values the code branches on.
  "kind",
  // `Metric.source` is the author's private interview note: no resolved view
  // ever emits it, so asking for an English version would translate text
  // nobody can read.
  "source",
]);

/**
 * An identified array item keys by its id, so reordering the array does not
 * move a single path. Anything else falls back to the index. Shared by every
 * walk in this file so a path built by one means the same thing to another.
 */
function arrayKey(item: unknown, index: number): string {
  const rec = item as { id?: unknown; code?: unknown };
  if (typeof rec?.id === "string") return rec.id;
  if (typeof rec?.code === "string") return rec.code;
  return String(index);
}

/**
 * `delta` looked like `before`/`after` — a number with a unit — and was
 * denylisted alongside them. It is not: `before`/`after` never move (a
 * measurement is a measurement), but `delta` renders as PROSE with a locale
 * convention baked in — "13.000" (thousands separator `.`) in Spanish,
 * "13,000" in English. `formatMetric` prints it verbatim on both CVs and
 * both landings. Denylisting it meant an English `delta` could go stale — or
 * simply wrong — with every gate green.
 *
 * `aliases` looked like `name` — mostly proper nouns ("TypeScript", "React.js")
 * with no English form — and was denylisted for the same reason. But a few
 * entries are genuine words ("containerización" → "containerization"), not
 * product names, and those need the same drift protection as any other prose.
 * Tracking every alias costs nothing: the proper-noun ones are short and
 * identical in both datasets, which passes the "untranslated" check exactly
 * the way `Mapbox GL JS` does for `name`-as-proper-noun. No per-entry override
 * needed — unlike `name`, there is no reading of `aliases` where the
 * proper-noun case must be EXCLUDED, only entries where translation happens to
 * be a no-op.
 */
export function translatableFields(dataset: ContentDataset): Map<string, string> {
  const out = new Map<string, string>();

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (node.trim().length > 0) out.set(path, node);
      return;
    }
    if (Array.isArray(node)) {
      for (const [i, item] of node.entries()) {
        walk(item, `${path}.${arrayKey(item, i)}`);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        // `name` is a proper noun everywhere EXCEPT `Project.name` (a title)
        // and `LanguageSkill.name` (the language's display name — "Español",
        // "Inglés" — which is a word in the language it names, not an
        // identifier for it, so it IS translated). Both verified against both
        // committed datasets. Handled by path, not by key, so `Skill.name`
        // (a proper noun) stays excluded. `languages` items have no `id`;
        // `arrayKey` uses `code`, so the path is `languages.es.name`.
        const isProjectName = key === "name" && /^projects\.[^.]+$/.test(path);
        const isLanguageName = key === "name" && /^languages\.[^.]+$/.test(path);
        // `Service.name` is a title ("Custom dashboard"), not a proper noun
        // like `Skill.name`. Without this override it falls into NOT_TEXT and
        // `test:i18n` never asks for a translation — silent missing English.
        const isServiceName = key === "name" && /^services\.[^.]+$/.test(path);
        // `skills.ai-assisted.name` is "Desarrollo asistido por IA" /
        // "AI-assisted development" — a descriptive phrase, not a product
        // name. Every other `Skill.name` ("TypeScript", "Docker") has no
        // English form to write; this one id is the sole exception, verified
        // against both committed datasets, same shape as the language
        // exception above.
        const isSkillDisplayName = key === "name" && path === "skills.ai-assisted";
        // `roles.freelance.company` is "Independiente" / "Independent" — a
        // description of the arrangement (no employer), not a business name.
        // Every other `Role.company` ("Hogarth") is a proper noun.
        const isFreelanceCompany = key === "company" && path === "roles.freelance";
        if (
          NOT_TEXT.has(key) &&
          !isProjectName && !isLanguageName && !isServiceName && !isSkillDisplayName && !isFreelanceCompany
        ) continue;
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(dataset, "");
  return out;
}

/**
 * The full dataset, with every TRACKED leaf (what `translatableFields`
 * returns) replaced by `null`. What is left over is exactly the structure:
 * ids, dates, `skillIds`, `visibility.priority`, `Metric.confidence` — every
 * field this module does not consider prose — plus any `NOT_TEXT` field whose
 * value happens to be a string too (`company`, `url`, `kind`…), untouched.
 *
 * Deep-comparing two datasets' skeletons is the real structural-parity check.
 * `translatableFields()` alone cannot do this job: it is blind to anything
 * `NOT_TEXT` excludes, because it never walks INTO that subtree, so a drifted
 * `roles.dinkum.start` or `achievements.dinkum-mapbox.visibility.priority`
 * never produces a path either dataset's tracked set can disagree over — both
 * sets simply omit it. This function walks EVERYTHING (nothing is skipped by
 * `NOT_TEXT`) and blanks only what `translatableFields` would have tracked, so
 * a comparison of two skeletons catches drift in anything left over.
 */
export function structuralSkeleton(dataset: ContentDataset): unknown {
  const tracked = translatableFields(dataset);

  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === "string") return tracked.has(path) ? null : node;
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, `${path}.${arrayKey(item, i)}`));
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node)) {
        out[key] = walk(value, path ? `${path}.${key}` : key);
      }
      return out;
    }
    return node;
  };

  return walk(dataset, "");
}

/**
 * FNV-1a, hex. Dependency-free and enough to notice a text changed — this is a
 * change detector, not a security primitive.
 */
export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
