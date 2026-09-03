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
  "before", "after", "delta",       // numbers with units: "500 ms" is "500 ms"
  "url", "email", "phone", "aliases", "featured", "active", "approved",
  "company", "client", "institution", "name",  // proper nouns
  // `Link.kind` is a closed union of identifiers ("github" | "linkedin" | …),
  // not prose: there is no English version of a tag, only a fixed set of
  // values the code branches on.
  "kind",
  // `Metric.source` is the author's private interview note: no resolved view
  // ever emits it, so asking for an English version would translate text
  // nobody can read.
  "source",
]);

export function translatableFields(dataset: ContentDataset): Map<string, string> {
  const out = new Map<string, string>();

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (node.trim().length > 0) out.set(path, node);
      return;
    }
    if (Array.isArray(node)) {
      for (const [i, item] of node.entries()) {
        // An identified item keys by its id, so reordering the array does not
        // move a single path. Anything else falls back to the index.
        const key = typeof (item as { id?: unknown })?.id === "string"
          ? (item as { id: string }).id
          : String(i);
        walk(item, `${path}.${key}`);
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
        // (a proper noun) stays excluded. `languages` items carry no `id`, so
        // the walker keys them by array index: the path is `languages.<n>`.
        const isProjectName = key === "name" && /^projects\.[^.]+$/.test(path);
        const isLanguageName = key === "name" && /^languages\.[^.]+$/.test(path);
        if (NOT_TEXT.has(key) && !isProjectName && !isLanguageName) continue;
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(dataset, "");
  return out;
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
