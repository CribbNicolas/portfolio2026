/**
 * The dataset, in memory, addressed by path.
 *
 * The whole dataset is held here and saved in one PUT. That is what makes a
 * multi-entity edit — adding a skill and the achievement that references it —
 * one save rather than two, which matters because the server refuses anything
 * that breaks referential integrity: saved separately, the first half would be
 * rejected on its own.
 *
 * Two path shapes travel through the editor and they are not the same thing.
 * A VALUE path indexes the data: `achievements.3.skillIds`. A SCHEMA path
 * indexes the descriptor tree and the hints table: `achievements[].skillIds`.
 * `pathToDescriptorPath` converts one to the other, and mixing them up is the
 * mistake this comment exists to prevent.
 */

/** `achievements.3.text.long` → `achievements[].text.long`. */
export function pathToDescriptorPath(path) {
  return path
    .split(".")
    .map((step, index, steps) => {
      const next = steps[index + 1];
      return next !== undefined && /^\d+$/.test(next) ? `${step}[]` : step;
    })
    .filter((step) => !/^\d+$/.test(step))
    .join(".");
}

export function createState(dataset) {
  let data = dataset;

  const parentOf = (path) => {
    const steps = path.split(".");
    const last = steps.pop();
    let node = data;
    for (const step of steps) node = node[step];
    return { node, last };
  };

  return {
    all: () => data,

    get(path) {
      const { node, last } = parentOf(path);
      return node?.[last];
    },

    set(path, value) {
      const { node, last } = parentOf(path);
      // `undefined` deletes rather than storing a hole: the schema is strict,
      // and a key present with an undefined value is not the same as absent.
      if (value === undefined) delete node[last];
      else node[last] = value;
    },

    collection(name) {
      return Array.isArray(data[name]) ? data[name] : [];
    },

    addTo(path, value) {
      const list = this.get(path);
      list.push(value);
    },

    removeAt(path, index) {
      const list = this.get(path);
      list.splice(index, 1);
    },
  };
}

/**
 * A blank value for a descriptor, used when adding an array item.
 *
 * Optional fields are left out entirely rather than filled with empty strings:
 * an empty string is a value the schema will reject on save, while an absent
 * optional field is simply absent. Required fields do get a blank, because the
 * form has to show the reader what they owe.
 */
export function blankFor(descriptor) {
  switch (descriptor.kind) {
    case "string":
      // A nullable field's empty state is `null`, not `""`: `Role.end` is
      // nullable because an open role HAS no end, and `""` would fail the
      // YYYY-MM pattern the moment the row is created.
      return descriptor.nullable ? null : "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return descriptor.values[0];
    case "array":
      return [];
    case "object": {
      const out = {};
      for (const field of descriptor.fields) {
        if (field.descriptor.optional) continue;
        out[field.key] = blankFor(field.descriptor);
      }
      return out;
    }
    default:
      return null;
  }
}
