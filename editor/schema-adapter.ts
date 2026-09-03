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

import { datasetSchema } from "../content/schema/validation";
import type {
  Descriptor,
  DescriptorFlags,
  ObjectDescriptor,
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

/**
 * `describe`, narrowed to an object. The dataset schema is a `z.object()`,
 * but `describe` returns the whole `Descriptor` union, and a cast would let
 * a typo'd top-level kind compile. Throw instead.
 */
export function describeObject(schema: ZodTypeAny): ObjectDescriptor {
  const described = describe(schema);
  if (described.kind !== "object") {
    throw new UnsupportedSchemaError(
      `dataset schema is ${described.kind}, not object`,
    );
  }
  return described;
}

// ---------------------------------------------------------------------------
// The dataset's own tree
// ---------------------------------------------------------------------------

/**
 * The dataset schema as a tree. Computed once at import: the schema is static,
 * and everything downstream (the serializer's key order, `GET /api/schema`)
 * reads the same instance.
 */
export const datasetDescriptor = describeObject(datasetSchema);
