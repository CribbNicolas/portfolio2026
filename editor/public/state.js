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

  /**
   * Walk to the parent of `path`.
   *
   * `create` brings the missing links into being on the way. It exists because
   * the renderer deliberately draws an ABSENT optional as an editable control —
   * `render.js` renders it from `value ?? {}` / `value ?? []`, so every field
   * exists and every "add" button works — which means a write is the first
   * moment the container has to be real. Without this the listener threw before
   * `scheduleValidate()` ever ran: the typed text stayed on screen, Save kept
   * the `disabled = false` the last good validation left it, and pressing it
   * saved a dataset that had never received the edit and reported "saved".
   *
   * Object or array is not a guess: the next step decides. A numeric step can
   * only be an index, so whatever holds it is an array.
   *
   * Reads never create. `get` on a path that does not exist answers `undefined`
   * — asking a question must not change the answer — and only a write brings a
   * container into being.
   */
  const parentOf = (path, { create = false } = {}) => {
    const steps = path.split(".");
    const last = steps.pop();
    let node = data;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (create && (node[step] === undefined || node[step] === null)) {
        node[step] = /^\d+$/.test(steps[i + 1] ?? last) ? [] : {};
      }
      node = node?.[step];
    }
    return { node, last };
  };

  /**
   * After a write, walk up and drop any nested object that is now hollow.
   * Hollow means `{}` or only empty strings: `metric.label` is required on
   * Metric, so the input writes `""` rather than `undefined` when the author
   * deletes the text, and `{ label: "" }` is as unsavable as `{}`.
   *
   * Stops at the top level — an emptied `identity` stays put rather than
   * disappearing — and at array elements, so a hole is never punched in a
   * list by `delete array[i]`. Empty arrays stay: they are a value, not a
   * missing optional object.
   */
  const isHollow = (value) => {
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value) || typeof value !== "object") return false;
    const keys = Object.keys(value);
    return keys.length === 0 || keys.every((key) => isHollow(value[key]));
  };

  const pruneEmptyAncestors = (path) => {
    const ancestor = path.split(".");
    ancestor.pop();
    while (ancestor.length > 1) {
      const lastStep = ancestor[ancestor.length - 1];
      if (/^\d+$/.test(lastStep)) break;
      const ancestorPath = ancestor.join(".");
      const { node, last } = parentOf(ancestorPath);
      const value = node?.[last];
      if (value === undefined || value === null || Array.isArray(value)) break;
      if (typeof value !== "object" || !isHollow(value)) break;
      delete node[last];
      ancestor.pop();
    }
  };

  return {
    all: () => data,

    get(path) {
      const { node, last } = parentOf(path);
      return node?.[last];
    },

    set(path, value) {
      // `undefined` deletes rather than storing a hole: the schema is strict,
      // and a key present with an undefined value is not the same as absent.
      // A delete never creates: there is nothing to remove from a container
      // that is not there, and vivifying one would leave behind an empty
      // object the schema then refuses to save.
      if (value === undefined) {
        const { node, last } = parentOf(path);
        if (node !== undefined && node !== null) delete node[last];
        pruneEmptyAncestors(path);
        return;
      }
      const { node, last } = parentOf(path, { create: true });
      node[last] = value;
      pruneEmptyAncestors(path);
    },

    collection(name) {
      return Array.isArray(data[name]) ? data[name] : [];
    },

    addTo(path, value) {
      const { node, last } = parentOf(path, { create: true });
      // The array being added to can itself be the absent optional — today
      // `skills[].periods` is absent on every skill in the dataset, and its
      // "add" button is drawn anyway — so the last step gets the same
      // treatment as the links above it.
      if (!Array.isArray(node[last])) node[last] = [];
      node[last].push(value);
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
