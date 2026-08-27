# Editor PR 1 — Schema Adapter and Canonical Format — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Zod dataset schema into a plain descriptor tree behind one
module, and make `content/data/content.es.json` have a canonical written form
that a CI gate holds in place.

**Architecture:** `editor/schema-adapter.ts` is the only file in the repo that
reads zod's internal `_def`; it emits the zod-free tree declared in
`editor/descriptors.ts`. `editor/serialize.ts` consumes that tree — its field
order *is* the schema's declaration order — and prints the dataset with the
five canonical rules. `scripts/format-data.ts` applies it to the real file and
`scripts/data-format.check.ts` fails CI if the committed file has drifted.

**Tech Stack:** TypeScript (ESM, `"type": "module"`), zod 3.25.76 (range
`^3.23.8`), `tsx --test` over `node:test` + `node:assert/strict`, pnpm 11.

**Spec:** [`docs/superpowers/specs/2026-08-27-editor-design.md`](../specs/2026-08-27-editor-design.md)

## Global Constraints

- **Package manager is pnpm.** Never `npm`. Scripts run as `pnpm run <name>`.
- **Language:** identifiers, comments and docs in English. Only user-visible
  site content is Spanish — none of this PR touches that. Commit messages in
  English.
- **Comments explain the WHY, not the what.** Section banners `// ---`, JSDoc
  `/** */` on exported types and functions. Match the tone of
  `content/schema/validation.ts` and `scripts/endpoints.check.ts`.
- **Typing:** `interface` for data shapes, `type` for unions and aliases.
  Imports without extensions. `import type` for types.
- **Tests are `*.test.ts`** and get picked up by bare `pnpm test`. A file that
  needs a build or reads a committed artifact is named `*.check.ts` instead and
  gets its own script — that is why the gate here is `data-format.check.ts`.
- **`editor/` never reaches `dist/`.** Nothing in this PR may be imported from
  `src/`, and nothing in it may import from `src/`.
- **Zod stays on the `^3.23.8` range.** Do not pin, do not upgrade.
- **Line endings:** the serializer emits `\n`. Every comparison against a file
  read from disk normalizes `\r\n` → `\n` first — `core.autocrlf` is `true`
  here and the CI checkout is LF, so a byte comparison would disagree between
  Windows and the runner.
- **Nothing in `content/schema/` gets modified by this PR.** The adapter reads
  the schema; it does not change it.

---

### Task 1: The descriptor tree and the zod adapter

**Files:**
- Create: `editor/descriptors.ts`
- Create: `editor/schema-adapter.ts`
- Create: `editor/schema-adapter.test.ts`
- Modify: `tsconfig.json` (the `include` array — `editor/**/*` is not covered
  today, so without this the editor is invisible to `pnpm run typecheck`)

**Interfaces:**
- Consumes: `zod` (types only, plus `_def` at runtime).
- Produces:
  - `type Descriptor` and the members `StringDescriptor`, `NumberDescriptor`,
    `BooleanDescriptor`, `EnumDescriptor`, `ArrayDescriptor`,
    `ObjectDescriptor`, `ObjectField`, `DescriptorFlags` (all from
    `editor/descriptors.ts`).
  - `describe(schema: ZodTypeAny): Descriptor` and
    `class UnsupportedSchemaError extends Error` (from
    `editor/schema-adapter.ts`). Task 2 adds `datasetDescriptor` to the same
    file; Task 3 imports both `Descriptor` and `datasetDescriptor`.

**Reference — the `_def` shapes in zod 3.25.76.** These were probed against the
installed version; do not guess them:

| Schema | `_def.typeName` | Where the payload is |
|---|---|---|
| `z.object({...}).strict()` | `ZodObject` | `_def.shape()` returns the shape (a **function**, must be called); `_def.unknownKeys === "strict"` |
| `z.string().min(1).max(180)` | `ZodString` | `_def.checks` = `[{kind:"min",value:1},{kind:"max",value:180}]` |
| `z.string().url()` / `.email()` | `ZodString` | `_def.checks` = `[{kind:"url"}]` / `[{kind:"email"}]` |
| `z.string().regex(/^\d{4}$/)` | `ZodString` | `_def.checks` = `[{kind:"regex",regex:RegExp}]` |
| `z.number()` / `z.boolean()` | `ZodNumber` / `ZodBoolean` | — |
| `z.array(x)` | `ZodArray` | `_def.type` |
| `z.enum([...])` | `ZodEnum` | `_def.values` |
| `x.optional()` | `ZodOptional` | `_def.innerType` |
| `x.nullable()` | `ZodNullable` | `_def.innerType` |
| `z.union([...])` | `ZodUnion` | `_def.options` |
| `z.literal(1)` | `ZodLiteral` | `_def.value` |

- [ ] **Step 1: Write the failing test**

Create `editor/schema-adapter.test.ts`:

```ts
/**
 * The contract with zod's internals.
 *
 * `schema-adapter.ts` is the only file in the repo that reads `_def`, which is
 * internal API and not covered by semver: `package.json` declares `^3.23.8`
 * and what is installed is 3.25.76. These tests are the gate for that gap. If
 * a zod bump changes how a type stores its payload, it fails HERE, in one file,
 * with a message that says which shape moved — instead of failing diffusely
 * across the editor at runtime.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { describe, UnsupportedSchemaError } from "./schema-adapter";
import type {
  ArrayDescriptor,
  Descriptor,
  EnumDescriptor,
  ObjectDescriptor,
  StringDescriptor,
} from "./descriptors";

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

test("a plain string is a string descriptor with no flags", () => {
  assert.deepEqual(describe(z.string()), {
    kind: "string",
    optional: false,
    nullable: false,
  });
});

test("min and max become minLength and maxLength", () => {
  const d = describe(z.string().min(1).max(180)) as StringDescriptor;
  assert.equal(d.minLength, 1);
  assert.equal(d.maxLength, 180);
});

test("email and url become a format, not a pattern", () => {
  assert.equal((describe(z.string().email()) as StringDescriptor).format, "email");
  assert.equal((describe(z.string().url()) as StringDescriptor).format, "url");
});

test("a regex is carried as its source, so the client needs no RegExp", () => {
  const d = describe(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)) as StringDescriptor;
  assert.equal(d.pattern, "^\\d{4}-(0[1-9]|1[0-2])$");
});

test("booleans and numbers carry their kind", () => {
  assert.equal(describe(z.boolean()).kind, "boolean");
  assert.equal(describe(z.number()).kind, "number");
});

// ---------------------------------------------------------------------------
// Wrappers. The flags are flattened so no consumer has to unwrap.
// ---------------------------------------------------------------------------

test("optional sets the flag and keeps the inner kind", () => {
  const d = describe(z.string().optional());
  assert.equal(d.kind, "string");
  assert.equal(d.optional, true);
  assert.equal(d.nullable, false);
});

test("nullable sets the other flag", () => {
  const d = describe(z.string().nullable());
  assert.equal(d.kind, "string");
  assert.equal(d.nullable, true);
});

test("optional and nullable together flatten into one descriptor", () => {
  const d = describe(z.string().nullable().optional());
  assert.equal(d.kind, "string");
  assert.equal(d.optional, true);
  assert.equal(d.nullable, true);
});

// ---------------------------------------------------------------------------
// Enums, and the union of literals that looks like one
// ---------------------------------------------------------------------------

test("an enum carries its values in order", () => {
  const d = describe(z.enum(["measured", "estimated"])) as EnumDescriptor;
  assert.deepEqual(d.values, ["measured", "estimated"]);
});

test("a union of literals collapses to an enum: that is how visibility.priority is written", () => {
  const priority = z.union([z.literal(1), z.literal(2), z.literal(3)]);
  const d = describe(priority) as EnumDescriptor;
  assert.equal(d.kind, "enum");
  assert.deepEqual(d.values, [1, 2, 3]);
});

test("a lone literal is an enum of one", () => {
  const d = describe(z.literal("es")) as EnumDescriptor;
  assert.deepEqual(d.values, ["es"]);
});

test("a union that is NOT all literals is refused instead of guessed", () => {
  assert.throws(
    () => describe(z.union([z.string(), z.number()])),
    UnsupportedSchemaError,
  );
});

// ---------------------------------------------------------------------------
// Arrays and objects
// ---------------------------------------------------------------------------

test("an array carries its element descriptor", () => {
  const d = describe(z.array(z.string())) as ArrayDescriptor;
  assert.equal(d.kind, "array");
  assert.equal(d.element.kind, "string");
});

test("an object keeps the declaration order of its fields", () => {
  const schema = z.object({ id: z.string(), name: z.string(), active: z.boolean() }).strict();
  const d = describe(schema) as ObjectDescriptor;
  assert.deepEqual(d.fields.map((f) => f.key), ["id", "name", "active"]);
  assert.equal(d.fields[2].descriptor.kind, "boolean");
});

test("a non-strict object is refused: every object in this schema is .strict()", () => {
  assert.throws(() => describe(z.object({ a: z.string() })), UnsupportedSchemaError);
});

test("an unsupported type names itself and its path, so a zod bump is readable", () => {
  const schema = z.object({ when: z.date() }).strict();
  assert.throws(() => describe(schema), (err: unknown) => {
    assert.ok(err instanceof UnsupportedSchemaError);
    assert.match(err.message, /ZodDate/);
    assert.match(err.message, /when/);
    return true;
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

```bash
pnpm exec tsx --test editor/schema-adapter.test.ts
```

Expected: failure resolving `./schema-adapter` — the module does not exist yet.
Any other failure means the test file itself is wrong; fix that first.

- [ ] **Step 3: Write `editor/descriptors.ts`**

```ts
/**
 * The field tree the editor renders from.
 *
 * Deliberately free of zod: this is the seam. `schema-adapter.ts` builds it out
 * of `_def` (internal API) and everything downstream — the serializer's key
 * order, the form in the browser — consumes plain JSON. That is what keeps a
 * zod upgrade to one file.
 */

/** Flattened onto every descriptor, so a consumer never unwraps a wrapper type. */
export interface DescriptorFlags {
  optional: boolean;
  nullable: boolean;
}

export interface StringDescriptor extends DescriptorFlags {
  kind: "string";
  minLength?: number;
  maxLength?: number;
  /** `RegExp.source` of a `z.string().regex()`. A string, so the tree stays JSON. */
  pattern?: string;
  format?: "email" | "url";
}

export interface NumberDescriptor extends DescriptorFlags {
  kind: "number";
}

export interface BooleanDescriptor extends DescriptorFlags {
  kind: "boolean";
}

/** `z.enum`, a lone `z.literal` and a union of literals all land here. */
export interface EnumDescriptor extends DescriptorFlags {
  kind: "enum";
  values: Array<string | number | boolean>;
}

export interface ArrayDescriptor extends DescriptorFlags {
  kind: "array";
  element: Descriptor;
}

export interface ObjectField {
  key: string;
  descriptor: Descriptor;
}

export interface ObjectDescriptor extends DescriptorFlags {
  kind: "object";
  /**
   * The schema's declaration order. THE source of the serializer's key order:
   * keeping a second list somewhere would let the two drift.
   */
  fields: ObjectField[];
}

export type Descriptor =
  | StringDescriptor
  | NumberDescriptor
  | BooleanDescriptor
  | EnumDescriptor
  | ArrayDescriptor
  | ObjectDescriptor;
```

- [ ] **Step 4: Write `editor/schema-adapter.ts`**

```ts
/**
 * zod → `Descriptor`. THE ONLY file in the repo that reads `_def`.
 *
 * `_def` is internal API: it is not covered by semver, and the installed zod
 * (3.25.76) is already two minors past what `package.json` asks for (^3.23.8).
 * Isolating it here is the whole point — a bump breaks these tests, in one
 * file, with a message naming the shape that moved. Zod 4 reworked
 * introspection entirely; when that migration comes, this file is the extent
 * of it.
 *
 * Anything the schema uses and this file does not know about throws instead of
 * being approximated. A silently wrong descriptor would surface as a form field
 * that quietly edits the wrong thing.
 */

import type { ZodTypeAny } from "zod";

import type {
  Descriptor,
  DescriptorFlags,
  ObjectField,
  StringDescriptor,
} from "./descriptors";

/** Thrown when the schema uses something this adapter cannot describe. */
export class UnsupportedSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSchemaError";
  }
}

// ---------------------------------------------------------------------------
// The `_def` surface. Every access to it lives below this banner.
// ---------------------------------------------------------------------------

interface ZodDef {
  typeName: string;
  [key: string]: unknown;
}

const defOf = (schema: ZodTypeAny): ZodDef =>
  (schema as unknown as { _def: ZodDef })._def;

interface StringCheck {
  kind: string;
  value?: number;
  regex?: RegExp;
}

function readString(def: ZodDef, flags: DescriptorFlags): StringDescriptor {
  const checks = (def.checks as StringCheck[] | undefined) ?? [];
  // Typed as StringDescriptor, not Descriptor: the union has no `minLength`,
  // so assigning through it does not compile.
  const descriptor: StringDescriptor = { kind: "string", ...flags };
  for (const check of checks) {
    if (check.kind === "min") descriptor.minLength = check.value;
    else if (check.kind === "max") descriptor.maxLength = check.value;
    else if (check.kind === "regex" && check.regex) descriptor.pattern = check.regex.source;
    else if (check.kind === "email") descriptor.format = "email";
    else if (check.kind === "url") descriptor.format = "url";
    // Any other check only narrows validation, which Zod itself still enforces
    // on save. Dropping it costs a hint in the form, never correctness.
  }
  return descriptor;
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

function read(schema: ZodTypeAny, flags: DescriptorFlags, path: string): Descriptor {
  const def = defOf(schema);

  switch (def.typeName) {
    case "ZodOptional":
      return read(def.innerType as ZodTypeAny, { ...flags, optional: true }, path);
    case "ZodNullable":
      return read(def.innerType as ZodTypeAny, { ...flags, nullable: true }, path);

    case "ZodString":
      return readString(def, flags);
    case "ZodNumber":
      return { kind: "number", ...flags };
    case "ZodBoolean":
      return { kind: "boolean", ...flags };

    case "ZodEnum":
      return { kind: "enum", values: [...(def.values as string[])], ...flags };
    case "ZodLiteral":
      return { kind: "enum", values: [def.value as string | number | boolean], ...flags };

    case "ZodUnion": {
      // The dataset writes `visibility.priority` as a union of the literals
      // 1..5, not as an enum: without this branch the most edited field in the
      // whole schema has no descriptor.
      const options = def.options as ZodTypeAny[];
      const values = options.map((option) => {
        const optionDef = defOf(option);
        if (optionDef.typeName !== "ZodLiteral") {
          throw new UnsupportedSchemaError(
            `${path}: a union of non-literals (${optionDef.typeName}) has no single widget. Model it as an enum or teach the adapter.`,
          );
        }
        return optionDef.value as string | number | boolean;
      });
      return { kind: "enum", values, ...flags };
    }

    case "ZodArray":
      return {
        kind: "array",
        element: read(def.type as ZodTypeAny, { optional: false, nullable: false }, `${path}[]`),
        ...flags,
      };

    case "ZodObject": {
      if (def.unknownKeys !== "strict") {
        throw new UnsupportedSchemaError(
          `${path}: object is not .strict(). Every object in this schema is strict on purpose — an undeclared key must throw, not be dropped.`,
        );
      }
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const fields: ObjectField[] = Object.entries(shape).map(([key, value]) => ({
        key,
        descriptor: read(value, { optional: false, nullable: false }, path ? `${path}.${key}` : key),
      }));
      return { kind: "object", fields, ...flags };
    }

    default:
      throw new UnsupportedSchemaError(
        `${path}: ${def.typeName} is not described by the adapter. Add a branch for it, or check whether a zod upgrade renamed it.`,
      );
  }
}

/** zod schema → the descriptor tree. The only entry point. */
export function describe(schema: ZodTypeAny): Descriptor {
  return read(schema, { optional: false, nullable: false }, "$");
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm exec tsx --test editor/schema-adapter.test.ts
```

Expected: all pass.

- [ ] **Step 6: Put `editor/` under the typecheck**

In `tsconfig.json`, add `"editor/**/*"` to `include`, keeping alphabetical
order alongside the existing entries:

```json
"include": ["content/**/*", "editor/**/*", "functions/**/*", "scripts/**/*", "src/**/*", ".astro/types.d.ts"]
```

- [ ] **Step 7: Verify the typecheck and the whole unit suite**

```bash
pnpm run typecheck
pnpm test
```

Expected: `typecheck` clean, and `pnpm test` reports the previous 80 tests plus
the new ones — bare `tsx --test` discovers `editor/*.test.ts` with no extra
wiring, which is the reason the file is named `.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add editor/descriptors.ts editor/schema-adapter.ts editor/schema-adapter.test.ts tsconfig.json
git commit -m "feat(editor): one module for zod introspection, with tests as the bump gate"
```

---

### Task 2: `datasetDescriptor` — pin the real schema, not a toy one

Task 1 tested the adapter against schemas built inside the test. That proves the
branches work; it does not prove the adapter survives *this* dataset's schema,
which is where a zod bump would actually bite.

**Files:**
- Modify: `editor/schema-adapter.ts` (add the `datasetDescriptor` export at the end)
- Modify: `editor/schema-adapter.test.ts` (add the section below)

**Interfaces:**
- Consumes: `describe` from Task 1; `datasetSchema` from
  `content/schema/validation.ts` (already exported there).
- Produces: `datasetDescriptor: ObjectDescriptor` — Task 3's source of key
  order, and later the payload of `GET /api/schema`.

- [ ] **Step 1: Write the failing test**

Append to `editor/schema-adapter.test.ts`:

```ts
// ---------------------------------------------------------------------------
// The real schema. Task 1 proved the branches; this proves they cover the
// dataset we actually have.
// ---------------------------------------------------------------------------

// The import at the top of the file becomes:
//   import { datasetDescriptor, describe, UnsupportedSchemaError } from "./schema-adapter";
// The type import written in Step 1 already covers every type used below.

const fieldOf = (object: ObjectDescriptor, key: string): Descriptor => {
  const found = object.fields.find((f) => f.key === key);
  assert.ok(found, `the descriptor has no field "${key}"`);
  return found.descriptor;
};

test("the dataset describes as an object, and its top-level order is the schema's", () => {
  assert.equal(datasetDescriptor.kind, "object");
  assert.deepEqual(
    datasetDescriptor.fields.map((f) => f.key),
    [
      "schemaVersion",
      "locale",
      "updatedAt",
      "identity",
      "skills",
      "roles",
      "achievements",
      "projects",
      "education",
      "certifications",
      "languages",
      "services",
      "testimonials",
    ],
  );
});

test("Prose.short still carries its 180-character ceiling", () => {
  const achievements = fieldOf(datasetDescriptor, "achievements") as ArrayDescriptor;
  const text = fieldOf(achievements.element as ObjectDescriptor, "text") as ObjectDescriptor;
  const short = fieldOf(text, "short") as StringDescriptor;
  assert.equal(short.maxLength, 180);
  assert.equal(short.optional, false);

  const long = fieldOf(text, "long") as StringDescriptor;
  assert.equal(long.optional, true);
});

test("visibility.priority arrives as the five literals, not as an opaque union", () => {
  const roles = fieldOf(datasetDescriptor, "roles") as ArrayDescriptor;
  const visibility = fieldOf(roles.element as ObjectDescriptor, "visibility") as ObjectDescriptor;
  const priority = fieldOf(visibility, "priority") as EnumDescriptor;
  assert.deepEqual(priority.values, [1, 2, 3, 4, 5]);
});

test("Role.end is nullable and not optional: an open role is null, not missing", () => {
  const roles = fieldOf(datasetDescriptor, "roles") as ArrayDescriptor;
  const end = fieldOf(roles.element as ObjectDescriptor, "end") as StringDescriptor;
  assert.equal(end.nullable, true);
  assert.equal(end.optional, false);
  assert.equal(end.pattern, "^\\d{4}-(0[1-9]|1[0-2])$");
});

test("the contact email keeps its format, which is what makes it a typed widget", () => {
  const identity = fieldOf(datasetDescriptor, "identity") as ObjectDescriptor;
  const contact = fieldOf(identity, "contact") as ObjectDescriptor;
  assert.equal((fieldOf(contact, "email") as StringDescriptor).format, "email");
});

test("skillIds is an array of plain strings — the hints table is what turns it into a picker", () => {
  const achievements = fieldOf(datasetDescriptor, "achievements") as ArrayDescriptor;
  const skillIds = fieldOf(achievements.element as ObjectDescriptor, "skillIds") as ArrayDescriptor;
  assert.equal(skillIds.kind, "array");
  assert.equal(skillIds.element.kind, "string");
});
```

Nothing else moves: Step 1 of Task 1 already imports every type this section
uses.

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/schema-adapter.test.ts
```

Expected: `datasetDescriptor` is not exported.

- [ ] **Step 3: Add the export**

At the end of `editor/schema-adapter.ts`:

```ts
// ---------------------------------------------------------------------------
// The dataset's own tree
// ---------------------------------------------------------------------------

import { datasetSchema } from "../content/schema/validation";
import type { ObjectDescriptor } from "./descriptors";

/**
 * The dataset schema as a tree. Computed once at import: the schema is static,
 * and everything downstream (the serializer's key order, `GET /api/schema`)
 * reads the same instance.
 */
export const datasetDescriptor = describe(datasetSchema) as ObjectDescriptor;
```

Move both `import` statements up to the other imports at the top of the file;
they are shown here next to the export only to say where the code goes.

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/schema-adapter.test.ts
pnpm run typecheck
```

Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add editor/schema-adapter.ts editor/schema-adapter.test.ts
git commit -m "test(editor): hold the adapter against the real dataset schema"
```

---

### Task 3: The canonical serializer

**Files:**
- Create: `editor/serialize.ts`
- Create: `editor/serialize.test.ts`

**Interfaces:**
- Consumes: `datasetDescriptor` (Task 2), `Descriptor` / `ObjectDescriptor`
  (Task 1), `ContentDataset` from `content/schema/content-schema.ts`.
- Produces: `serializeDataset(data: ContentDataset): string` — used by
  `scripts/format-data.ts` (Task 4), `scripts/data-format.check.ts` (Task 5)
  and, in PR 2, by `editor/store.ts`.

**The five canonical rules** (spec §3.2), restated as the implementation has to
apply them:

1. Two-space indent, trailing newline, `\n` as the separator.
2. Key order is `datasetDescriptor`'s field order; a key absent from the data
   (an optional one) is skipped, never emitted as `null`.
3. A blank line before every top-level key except the first three
   (`schemaVersion`, `locale`, `updatedAt` are the header block).
4. An array of scalars prints inline when `column + inline.length <= 100`,
   where `column` is the indent plus `"key": `. Otherwise one element per line.
   Measured on today's data: `identity.titleAliases` is 110 and stays expanded;
   the next widest is 76 and stays inline.
5. Two tables decide the rest. `visibility` prints as an inline object wherever
   it appears. The arrays `skills`, `languages`, `certifications`, `links`,
   `media` and `periods` print one inline object per line. Everything else is
   expanded. No width rule can do this: a `skills` element is ~190 columns and
   must stay inline while a `Prose` object is ~170 and must stay expanded.

Inline spacing follows the file as it is today: objects `{ "a": 1, "b": 2 }`
(spaces just inside the braces), arrays `["a", "b"]` (no spaces inside the
brackets).

- [ ] **Step 1: Write the failing test**

Create `editor/serialize.test.ts`:

```ts
/**
 * The canonical written form of the dataset.
 *
 * `JSON.stringify(data, null, 2)` would rewrite all 344 lines on the first
 * save: it drops the blank lines between top-level sections and expands the
 * one-object-per-line style of `skills`. Every data commit would then mix the
 * real change with a reformat — and half the reason the data is still in git is
 * that its diffs are readable.
 *
 * Round trip and idempotence are the two properties that make this safe to
 * own: whatever the layout rules do, no datum is lost and running it twice
 * changes nothing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "./serialize";

const DATA_FILE = "content/data/content.es.json";

const dataset = JSON.parse(
  (await readFile(DATA_FILE, "utf8")).replace(/\r\n/g, "\n"),
) as ContentDataset;

// ---------------------------------------------------------------------------
// The properties that matter more than the layout
// ---------------------------------------------------------------------------

test("round trip: what comes back out parses back to the same data", () => {
  assert.deepEqual(JSON.parse(serializeDataset(dataset)), dataset);
});

test("idempotence: serializing what was already serialized changes nothing", () => {
  const once = serializeDataset(dataset);
  const twice = serializeDataset(JSON.parse(once) as ContentDataset);
  assert.equal(twice, once);
});

test("it ends in exactly one newline and never emits a carriage return", () => {
  const out = serializeDataset(dataset);
  assert.ok(out.endsWith("}\n"));
  assert.ok(!out.includes("\r"));
});

// ---------------------------------------------------------------------------
// The layout rules
// ---------------------------------------------------------------------------

const lines = serializeDataset(dataset).split("\n");
const lineWith = (needle: string): string => {
  const found = lines.find((l) => l.includes(needle));
  assert.ok(found, `no line contains ${needle}`);
  return found;
};

test("rule 3: a blank line before every top-level key but the first three", () => {
  const header = lines.slice(0, 4);
  assert.equal(header[1].trim().startsWith('"schemaVersion"'), true);
  assert.equal(header[3].trim().startsWith('"updatedAt"'), true);
  assert.equal(lines[4], "");

  for (const key of ["identity", "skills", "roles", "achievements", "projects",
                     "education", "certifications", "languages", "services", "testimonials"]) {
    const at = lines.findIndex((l) => l.startsWith(`  "${key}"`));
    assert.notEqual(at, -1, `no top-level line for ${key}`);
    assert.equal(lines[at - 1], "", `${key} has no blank line before it`);
  }
});

test("rule 4: a short array of scalars stays on one line", () => {
  assert.match(lineWith('"skillIds"'), /"skillIds": \[".+"\],?$/);
});

test("rule 4: titleAliases is 110 columns inline, so it expands", () => {
  const at = lines.findIndex((l) => l.includes('"titleAliases"'));
  assert.match(lines[at], /"titleAliases": \[$/);
});

test("rule 5: a skill is one inline object per line", () => {
  assert.match(lineWith('"id": "typescript"'), /^ {4}\{ "id": "typescript",.*\},?$/);
});

test("rule 5: links print inline too, even though they are not a top-level collection", () => {
  assert.match(lineWith('"label": "GitHub"'), /^ {6}\{ "label": "GitHub", .*\},?$/);
});

test("rule 5: visibility is inline wherever it appears", () => {
  assert.ok(lines.some((l) => l.trim() === '"visibility": { "priority": 1 }'));
});

test("rule 5: prose and decisions stay expanded — they are read, not scanned", () => {
  assert.match(lineWith('"problem"'), /"problem": \{$/);
  assert.match(lineWith('"decisions"'), /"decisions": \[$/);
});

test("rule 2: keys come out in the schema's order, not the object's", () => {
  // `locale` first in the input; the spread cannot move it back, because an
  // existing key keeps its position. The serializer has to reorder it anyway.
  const reordered = { locale: dataset.locale, ...dataset } as ContentDataset;
  const out = serializeDataset(reordered).split("\n");
  assert.match(out[1], /"schemaVersion"/);
  assert.match(out[2], /"locale"/);
});

test("an empty array is `[]`, not two lines", () => {
  assert.ok(lines.some((l) => l.trim() === '"certifications": [],'));
});

test("null survives: an open role has end: null, not a missing key", () => {
  assert.ok(lines.some((l) => l.trim() === '"end": null,'));
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/serialize.test.ts
```

Expected: failure resolving `./serialize`.

- [ ] **Step 3: Write `editor/serialize.ts`**

```ts
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
import type { Descriptor, ObjectDescriptor } from "./descriptors";
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
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/serialize.test.ts
```

Expected: all pass. If a layout test fails, fix the serializer — not the test —
unless the file itself disagrees with the rule, in which case stop and re-read
spec §3.2 before changing anything.

- [ ] **Step 5: Commit**

```bash
git add editor/serialize.ts editor/serialize.test.ts
git commit -m "feat(editor): canonical serializer for the dataset"
```

---

### Task 4: Normalize the dataset — its own commit, and nothing else in it

**Files:**
- Create: `scripts/format-data.ts`
- Modify: `package.json` (add the `format:data` script)
- Modify: `content/data/content.es.json` (**in a separate commit**)

**Interfaces:**
- Consumes: `serializeDataset` (Task 3).
- Produces: `pnpm run format:data` — the fix path `data-format.check.ts` (Task
  5) points at when it fails.

- [ ] **Step 1: Write `scripts/format-data.ts`**

```ts
/**
 * Writes `content.es.json` in canonical form.
 *
 * It exists so the gate has an answer: `data-format.check.ts` tells you the
 * file has drifted, and this is what puts it back. Deliberately not a
 * `*.test.ts` — it writes.
 *
 * It validates before writing. Formatting a dataset that does not pass the
 * rules would produce a tidy file that CI rejects anyway, and the error you
 * want is the rule one.
 */

import { readFile, writeFile } from "node:fs/promises";

import { validateDataset } from "../content/schema/validation";
import { serializeDataset } from "../editor/serialize";

const FILE = "content/data/content.es.json";

const raw = (await readFile(FILE, "utf8")).replace(/\r\n/g, "\n");
const data = validateDataset(JSON.parse(raw));
const out = serializeDataset(data);

if (out === raw) {
  console.log(`${FILE} is already canonical.`);
} else {
  await writeFile(FILE, out, "utf8");
  console.log(`${FILE} rewritten in canonical form.`);
}
```

- [ ] **Step 2: Add the script**

In `package.json`, next to the other `format`-less entries, after `"validate"`:

```json
"format:data": "tsx scripts/format-data.ts",
```

- [ ] **Step 3: Look at the diff before accepting it**

```bash
pnpm run format:data
git diff --stat content/data/content.es.json
git diff content/data/content.es.json
```

Expected: **one added blank line, before `"testimonials"`**. Key order was
verified to already match the schema across every object in the dataset, so
rule 2 should move nothing.

**If the diff is bigger, stop.** Do not commit it and do not adjust the file by
hand. Read what changed: it means a layout rule in Task 3 does not describe the
file as it is. Fix the rule, re-run, and only commit when the diff is the single
blank line. A normalization commit is allowed to normalize; it is not allowed
to smuggle in a reformat.

- [ ] **Step 4: Verify the dataset still passes everything**

```bash
pnpm run validate
pnpm test
```

Expected: `Dataset valid.` and the whole unit suite green.

- [ ] **Step 5: Commit the tool and the normalization separately**

```bash
git add scripts/format-data.ts package.json
git commit -m "feat(editor): pnpm run format:data, the fix path for the format gate"

git add content/data/content.es.json
git commit -m "chore(data): normalize content.es.json to the canonical form"
```

---

### Task 5: The gate

**Files:**
- Create: `scripts/data-format.check.ts`
- Modify: `package.json` (add `test:format`)
- Modify: `.github/workflows/content-validation.yml` (a step after `pnpm test`)
- Modify: `CLAUDE.md` (the file map and the command list)

**Interfaces:**
- Consumes: `serializeDataset` (Task 3).
- Produces: `pnpm run test:format`.

- [ ] **Step 1: Write the failing check**

Create `scripts/data-format.check.ts`:

```ts
/**
 * The committed dataset is in canonical form.
 *
 * Without this the format holds only while the editor is the only writer, and
 * it will not be: the file is still edited by hand, and a merge can resolve a
 * conflict into something the serializer would never emit. The next editor save
 * would then produce a diff full of reformatting that nobody asked for.
 *
 * The comparison normalizes line endings on purpose. `core.autocrlf` is true on
 * the development machine and the CI checkout is LF, so a byte comparison would
 * fail on Windows and pass on the runner — the worst shape a gate can have.
 *
 * Not a `*.test.ts`: it reads a committed artifact, like
 * `pdf-output.check.ts` and `og-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "../editor/serialize";

const FILE = "content/data/content.es.json";
const raw = (await readFile(FILE, "utf8")).replace(/\r\n/g, "\n");

test("the dataset parses", () => {
  assert.doesNotThrow(() => JSON.parse(raw), `${FILE} is not valid JSON`);
});

test("the dataset is written in canonical form", () => {
  const expected = serializeDataset(JSON.parse(raw) as ContentDataset);
  assert.equal(
    raw,
    expected,
    `${FILE} is not in canonical form. Run \`pnpm run format:data\` and commit the result.`,
  );
});
```

- [ ] **Step 2: Run it against a deliberately broken file**

```bash
echo "" >> content/data/content.es.json
pnpm exec tsx --test scripts/data-format.check.ts
```

One extra newline is enough: the canonical form ends in exactly one. No quoting
games, and `git checkout` undoes it cleanly.

Expected: FAIL, with the message telling you to run `pnpm run format:data`.
This step is the point — a gate nobody has seen fail is not known to work.

- [ ] **Step 3: Put the file back and confirm it passes**

```bash
git checkout content/data/content.es.json
pnpm exec tsx --test scripts/data-format.check.ts
```

Expected: PASS.

- [ ] **Step 4: Add the script**

In `package.json`, after `"test:endpoints"`:

```json
"test:format": "tsx --test scripts/data-format.check.ts",
```

- [ ] **Step 5: Wire it into CI**

In `.github/workflows/content-validation.yml`, right after the `pnpm test` step
and before the Playwright cache — it needs no build and no browser, so it
belongs with the cheap checks:

```yaml
      # The dataset's written form. It is committed, it is edited by hand, and
      # a merge can resolve a conflict into something the serializer would never
      # emit — after which the next editor save produces a diff full of
      # reformatting nobody asked for.
      - run: pnpm run test:format
```

- [ ] **Step 6: Verify the workflow still parses**

```bash
pnpm run test:workflows
```

Expected: PASS. This gate exists because an embedded CR left `smoke-deploy.yml`
invalid for three commits.

- [ ] **Step 7: Update `CLAUDE.md`**

Three edits, all of them factual:

1. In the file map, under `scripts/`, after the `endpoints.check.ts` line:

```
  format-data.ts      Writes content.es.json in canonical form. The fix path the gate points at. `format:data`.
  data-format.check.ts  THE canonical written form of the dataset is committed as such. Not a *.test.ts: it reads a committed artifact.
```

2. In the file map, a new top-level block after `docs/`:

```
editor/                 pnpm run editor. NOTHING here reaches dist/, which is why no check needs an exception.
  descriptors.ts      The zod-free field tree. The seam: the browser never sees zod.
  schema-adapter.ts   THE ONLY file that reads zod's `_def`. Its tests are the gate for a zod bump.
  serialize.ts        THE canonical written form of content.es.json. Key order comes from the schema; what prints
                      inline comes from two explicit tables, NOT from a line width.
```

3. In the commands block, after `test:endpoints`:

```
pnpm run test:format # the committed dataset is in canonical form (no build needed)
pnpm run format:data # rewrites content.es.json in canonical form. The fix for the above
```

and add `pnpm run test:format` to the full sequence line, after
`pnpm run validate`.

- [ ] **Step 8: Commit**

```bash
git add scripts/data-format.check.ts package.json .github/workflows/content-validation.yml CLAUDE.md
git commit -m "feat(gates): the dataset's written form is now checked in CI"
```

---

### Task 6: Bump the version and run the whole gate sequence

The PR into `develop` fails if `package.json.version` does not rise
(`version-gate.yml`, and locally `pnpm run test:version`). This PR adds
features, so the minor moves: `0.14.1` → `0.15.0`.

**Files:**
- Modify: `package.json` (`version`)

- [ ] **Step 1: Bump**

In `package.json`: `"version": "0.15.0"`.

- [ ] **Step 2: Verify the bump gate sees it**

```bash
git fetch origin develop
pnpm run test:version
```

Expected: PASS. The fetch is required — the check compares against
`origin/develop`.

- [ ] **Step 3: Run the full sequence**

```bash
pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm run test:format && pnpm test && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos
```

Expected: every step green. `audit:todos` reports 9 published TODOs and does not
block — those are missing data, not failures.

Two things to confirm by eye rather than assume:

- `test:js`, `test:bundle` and `test:landing` walk all of `dist/`. Nothing from
  `editor/` may appear in their output. If it does, something in `src/` imported
  from `editor/`, and that import is the bug.
- `test:pdf` and `test:og` must be unaffected: the normalization changed the
  file's layout, not one byte of its content.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: 0.15.0"
```

- [ ] **Step 5: Open the PR into `develop`**

```bash
git push -u origin feature/editor-handoff
gh pr create --base develop --title "feat(editor): schema adapter and canonical dataset format" --body "$(cat <<'BODY'
PR 1 of three for `pnpm run editor` — see `docs/superpowers/specs/2026-08-27-editor-design.md`.

No UI yet, and nothing here reaches `dist/`.

- `editor/schema-adapter.ts` is now the only file in the repo that reads zod's
  internal `_def`, with tests that assert the shapes it expects. That is the
  gate for a zod bump: `^3.23.8` is declared, 3.25.76 is installed, and `_def`
  is not covered by semver.
- `editor/serialize.ts` defines the canonical written form of the dataset. Key
  order comes from the schema; what prints inline comes from two explicit
  tables, because a `skills` element (~190 columns) and a `Prose` object (~170)
  overlap and no width rule separates them.
- `content.es.json` is normalized in its own commit: one added blank line.
- `pnpm run test:format` holds it in CI, comparing with line endings normalized
  so Windows and the runner reach the same verdict.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_016dMZ2Z2SCkBsjV12Ur8nBR
BODY
)"
```

---

## What this PR deliberately does not do

- No server, no API, no `pnpm run editor` script yet — that is PR 2.
- No `hints.ts`. It belongs with the form that consumes it, in PR 3.
- No change to `content/schema/`. The adapter reads the schema; it does not
  reshape it to be easier to read.
- No `.gitattributes`. Normalizing line endings repo-wide is a separate
  decision with its own diff; the check works without it.
