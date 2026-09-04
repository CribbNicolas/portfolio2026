/**
 * THE canonical written form of `content.es.json`.
 *
 * Key order comes from the descriptor tree, which comes from the zod schema:
 * one source, so the file's order and the schema's order cannot drift. What
 * prints inline comes from two explicit tables and NOT from a line-width
 * heuristic — a `skills` element is ~190 columns and belongs inline, a `Prose`
 * object is ~170 and belongs expanded. They overlap, so no threshold separates
 * them. A table is a decision; a threshold would be a coin flip that reformats
 * rows nobody touched.
 *
 * The one place a width IS used is arrays of scalars, where the two groups do
 * separate cleanly: 110 columns for `identity.titleAliases` against 76 for the
 * next widest.
 */

import type { ContentDataset } from "../content/schema/content-schema";
import type { Descriptor } from "./descriptors";
import { datasetDescriptor } from "./schema-adapter";

const INDENT = "  ";
/** `schemaVersion`, `locale`, `updatedAt`: the header block, no blank lines inside it. */
const HEADER_KEYS = 3;
/** Rule 4. Counts the indent and the `"key": ` prefix. */
const INLINE_ARRAY_LIMIT = 100;
/** Rule 5, first table: object-valued keys that print inline anywhere. */
const INLINE_OBJECT_KEYS = new Set(["visibility"]);
/** Rule 5, second table: arrays whose elements print inline, one per line. */
const INLINE_ELEMENT_ARRAYS = new Set([
  "skills",
  "languages",
  "certifications",
  "links",
  "media",
  // Currently unreachable: `periods` only exists on `Skill`, and every skill
  // is already an element of the inline `skills` array, so `inline()` prints
  // the whole skill without consulting this table. Kept so a future `periods`
  // outside `Skill` still prints one span per line.
  "periods",
]);

const isScalar = (value: unknown): boolean =>
  value === null || typeof value !== "object";

/** Compact form, with the spacing the file already uses: `{ "a": 1 }` and `["a", "b"]`. */
function inline(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(", ")} }`;
}

/** The descriptor of an object's field, or undefined for a key the schema does not declare. */
function fieldDescriptor(descriptor: Descriptor | undefined, key: string): Descriptor | undefined {
  if (!descriptor || descriptor.kind !== "object") return undefined;
  return descriptor.fields.find((f) => f.key === key)?.descriptor;
}

/**
 * `value` at `depth`, knowing the key it hangs from (`key` decides the tables)
 * and the column its first character sits at (rule 4 measures from there).
 */
function render(value: unknown, key: string, depth: number, column: number): string {
  if (isScalar(value)) return JSON.stringify(value);

  const pad = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";

    if (value.every(isScalar)) {
      const compact = inline(value);
      if (column + compact.length <= INLINE_ARRAY_LIMIT) return compact;
      const items = value.map((item) => `${inner}${JSON.stringify(item)}`);
      return `[\n${items.join(",\n")}\n${pad}]`;
    }

    const items = value.map((item) =>
      INLINE_ELEMENT_ARRAYS.has(key)
        ? `${inner}${inline(item)}`
        : `${inner}${render(item, key, depth + 1, inner.length)}`,
    );
    return `[\n${items.join(",\n")}\n${pad}]`;
  }

  if (INLINE_OBJECT_KEYS.has(key)) return inline(value);

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([childKey, childValue]) => {
    const prefix = `${JSON.stringify(childKey)}: `;
    return `${inner}${prefix}${render(childValue, childKey, depth + 1, inner.length + prefix.length)}`;
  });
  return `{\n${lines.join(",\n")}\n${pad}}`;
}

/**
 * Reorders an object's keys to the schema's order. Keys the schema does not
 * declare are impossible here — `.strict()` rejects them before this runs — but
 * they are appended rather than dropped: losing data silently is the one thing
 * a formatter must never do.
 */
function ordered(value: unknown, descriptor: Descriptor | undefined): unknown {
  if (Array.isArray(value)) {
    const element = descriptor?.kind === "array" ? descriptor.element : undefined;
    return value.map((item) => ordered(item, element));
  }
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const declared = descriptor?.kind === "object" ? descriptor.fields.map((f) => f.key) : [];
  const keys = [
    ...declared.filter((k) => k in source),
    ...Object.keys(source).filter((k) => !declared.includes(k)),
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = ordered(source[key], fieldDescriptor(descriptor, key));
  return out;
}

/** The dataset as the repo writes it. Always ends in a single `\n`. */
export function serializeDataset(data: ContentDataset): string {
  const root = ordered(data, datasetDescriptor) as Record<string, unknown>;
  const entries = Object.entries(root);

  const body = entries.map(([key, value], index) => {
    const prefix = `${JSON.stringify(key)}: `;
    const rendered = render(value, key, 1, INDENT.length + prefix.length);
    const line = `${INDENT}${prefix}${rendered}`;
    const comma = index < entries.length - 1 ? "," : "";
    const blank = index >= HEADER_KEYS ? "\n" : "";
    return `${blank}${line}${comma}`;
  });

  return `{\n${body.join("\n")}\n}\n`;
}
