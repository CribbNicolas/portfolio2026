/**
 * The widget table, and the guard that keeps it honest.
 *
 * The schema decides which fields exist and of what type. It cannot decide that
 * `skillIds` is a picker over the skills the dataset already has, or that a
 * `long` prose field wants room to breathe — those are editing decisions, and
 * they live here as an explicit table rather than as a naming convention,
 * because a convention silently changes a widget when someone renames a field
 * and nothing notices.
 *
 * What this test does is make the table's honesty structural: every path it
 * names must still exist in the descriptor tree. A field that moves or
 * disappears fails here instead of producing a form control wired to nothing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { HINTS, hintFor } from "./hints";
import { datasetDescriptor } from "./schema-adapter";
import type { Descriptor, ObjectField } from "./descriptors";

/** Walk a dotted path with `[]` array steps. Returns undefined if it does not exist. */
function descriptorAt(path: string): Descriptor | undefined {
  let current: Descriptor = datasetDescriptor;
  for (const step of path.split(".")) {
    const key = step.endsWith("[]") ? step.slice(0, -2) : step;
    if (current.kind !== "object") return undefined;
    // Annotated explicitly: without it, TS's control-flow analysis of `current`
    // being reassigned across loop iterations of a self-referencing type
    // (`Descriptor` refers to itself via `ArrayDescriptor.element` and
    // `ObjectField.descriptor`) resolves `field` to an implicit `any` (TS7022)
    // once `current`'s initializer comes from another module. Behaviour is
    // identical either way; this only satisfies the compiler.
    const field: ObjectField | undefined = current.fields.find((f) => f.key === key);
    if (!field) return undefined;
    current = field.descriptor;
    if (step.endsWith("[]")) {
      if (current.kind !== "array") return undefined;
      current = current.element;
    }
  }
  return current;
}

test("the walker itself works, or every assertion below is vacuous", () => {
  assert.equal(descriptorAt("identity.fullName")?.kind, "string");
  assert.equal(descriptorAt("skills[].level")?.kind, "enum");
  assert.equal(descriptorAt("achievements[].skillIds")?.kind, "array");
  assert.equal(descriptorAt("identity.nope"), undefined);
});

test("every hint points at a path the schema still has", () => {
  for (const path of Object.keys(HINTS)) {
    assert.ok(
      descriptorAt(path),
      `HINTS names "${path}", which the schema no longer has. Fix the table or the schema.`,
    );
  }
});

test("a reference hint names a collection the dataset actually has", () => {
  for (const [path, hint] of Object.entries(HINTS)) {
    if (hint.widget !== "reference" && hint.widget !== "reference-list") continue;
    assert.ok(hint.source, `${path} is a reference with no source`);
    const collection = datasetDescriptor.fields.find((f) => f.key === hint.source);
    assert.ok(collection, `${path} points at collection "${hint.source}", which does not exist`);
    assert.equal(collection.descriptor.kind, "array");
  }
});

test("a textarea hint only ever sits on a string", () => {
  for (const [path, hint] of Object.entries(HINTS)) {
    if (hint.widget !== "textarea") continue;
    assert.equal(descriptorAt(path)?.kind, "string", `${path} is not a string`);
  }
});

test("a reference-list hint only ever sits on an array of strings", () => {
  for (const [path, hint] of Object.entries(HINTS)) {
    if (hint.widget !== "reference-list") continue;
    const descriptor = descriptorAt(path);
    assert.equal(descriptor?.kind, "array", `${path} is not an array`);
    assert.equal((descriptor as { element: Descriptor }).element.kind, "string");
  }
});

test("hintFor finds a table entry and returns undefined for anything else", () => {
  assert.deepEqual(hintFor("achievements[].skillIds"), { widget: "reference-list", source: "skills" });
  assert.equal(hintFor("identity.fullName"), undefined);
});

test("the pickers the dataset most needs are all in the table", () => {
  // Not a tautology over Object.keys: these five are named because typing them
  // by hand against 22 skills and 4 roles is the friction the editor exists to
  // remove, and a table that quietly lost one would still pass every test above.
  assert.ok(hintFor("achievements[].roleId"));
  assert.ok(hintFor("achievements[].projectId"));
  assert.ok(hintFor("achievements[].skillIds"));
  assert.ok(hintFor("projects[].skillIds"));
  assert.ok(hintFor("achievements[].text.long"));
});
