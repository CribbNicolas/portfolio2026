/**
 * Per-path widget overrides. The schema decides what exists; this decides how
 * to edit it, and only where the type is not enough on its own.
 *
 * Keyed by full path — `achievements[].skillIds`, not `skillIds` — on purpose.
 * A table keyed by field name is a convention, and a convention silently
 * changes a widget when someone renames a field. A full path either exists in
 * the schema or it does not, and `hints.test.ts` fails when it stops existing.
 *
 * A field with no entry here still renders, from its descriptor. That is what
 * keeps "add a field to the schema and it appears" true.
 */

/** What to draw when the descriptor's own type is not enough. */
export type Widget = "textarea" | "reference" | "reference-list";

export interface Hint {
  widget: Widget;
  /** Which top-level collection a reference picks from. */
  source?: "skills" | "roles" | "projects";
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------
//
// Two kinds of entry, and nothing else:
//
//  - References. `roleId` is a string in the schema, and typing it by hand
//    against four roles — or `skillIds` against twenty-two skills — is exactly
//    the friction this editor exists to remove. Getting one wrong surfaces only
//    at referential integrity, three commands later.
//  - Prose that is read rather than scanned. `Prose.long` has no length cap and
//    is written in paragraphs; a single-line input is the wrong shape for it.

export const HINTS: Record<string, Hint> = {
  "achievements[].roleId": { widget: "reference", source: "roles" },
  "achievements[].projectId": { widget: "reference", source: "projects" },
  "achievements[].skillIds": { widget: "reference-list", source: "skills" },
  "projects[].roleId": { widget: "reference", source: "roles" },
  "projects[].skillIds": { widget: "reference-list", source: "skills" },
  "skills[].relatedIds": { widget: "reference-list", source: "skills" },
  "testimonials[].projectId": { widget: "reference", source: "projects" },

  "identity.tagline.long": { widget: "textarea" },
  "identity.summary.long": { widget: "textarea" },
  "roles[].context.long": { widget: "textarea" },
  "achievements[].text.long": { widget: "textarea" },
  "projects[].problem.long": { widget: "textarea" },
  "projects[].solution.long": { widget: "textarea" },
  "projects[].outcome.long": { widget: "textarea" },
  "services[].description.long": { widget: "textarea" },

  // A technical decision is three paragraphs of argument, not three labels.
  "projects[].decisions[].context": { widget: "textarea" },
  "projects[].decisions[].rationale": { widget: "textarea" },
  "projects[].decisions[].tradeoff": { widget: "textarea" },
};

export function hintFor(path: string): Hint | undefined {
  return HINTS[path];
}
