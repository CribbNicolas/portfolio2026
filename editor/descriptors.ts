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
