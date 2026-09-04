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

import { datasetDescriptor, describe, describeObject, UnsupportedSchemaError } from "./schema-adapter";
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

// ---------------------------------------------------------------------------
// The real schema. Task 1 proved the branches; this proves they cover the
// dataset we actually have.
// ---------------------------------------------------------------------------

const fieldOf = (object: ObjectDescriptor, key: string): Descriptor => {
  const found = object.fields.find((f) => f.key === key);
  assert.ok(found, `the descriptor has no field "${key}"`);
  return found.descriptor;
};

test("describeObject refuses a non-object schema instead of casting", () => {
  assert.throws(
    () => describeObject(z.string()),
    (err: unknown) => {
      assert.ok(err instanceof UnsupportedSchemaError);
      assert.match((err as Error).message, /string/);
      return true;
    },
  );
});

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
