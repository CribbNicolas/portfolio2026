/**
 * Descriptor + value → DOM.
 *
 * Everything here is driven by the descriptor tree the server sends, so a field
 * added to the zod schema appears in this form with no change to this file.
 * The hints table is consulted only where the type is not enough on its own —
 * a picker instead of a text box for `roleId`, room to write for a `long`.
 *
 * The renderer never validates. It reports every edit through `onChange` and
 * lets the server say what is wrong, because a rule reimplemented in the
 * browser is a rule that will drift from the one CI runs.
 */

import { blankFor, pathToDescriptorPath } from "./state.js";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function labelled(path, key, descriptor, control) {
  const wrapper = el("div", "field");
  wrapper.dataset.path = path;

  const label = el("label", "field__label", key);
  if (descriptor.optional) label.append(el("span", "field__optional", "optional"));
  if (descriptor.maxLength) label.append(el("span", "field__hint", `≤ ${descriptor.maxLength}`));

  wrapper.append(label, control, el("p", "field__error"));
  return wrapper;
}

function referenceOptions(context, source) {
  return context.state.collection(source).map((item) => item.id ?? "");
}

function renderReference(path, value, descriptor, hint, context) {
  const select = el("select", "control");
  if (descriptor.optional) select.append(new Option("—", ""));
  for (const id of referenceOptions(context, hint.source)) {
    select.append(new Option(id, id, false, id === value));
  }
  select.value = value ?? "";
  select.addEventListener("change", () => {
    context.onChange(path, select.value === "" ? undefined : select.value);
  });
  return select;
}

function renderReferenceList(path, value, hint, context) {
  const box = el("div", "control control--list");
  const chosen = new Set(value ?? []);

  for (const id of referenceOptions(context, hint.source)) {
    const item = el("label", "chip");
    const check = el("input");
    check.type = "checkbox";
    check.checked = chosen.has(id);
    check.addEventListener("change", () => {
      if (check.checked) chosen.add(id);
      else chosen.delete(id);
      // Rebuilt in the collection's own order, so the saved array does not
      // depend on the order the boxes happened to be clicked in.
      context.onChange(path, referenceOptions(context, hint.source).filter((x) => chosen.has(x)));
    });
    item.append(check, el("span", undefined, id));
    box.append(item);
  }
  return box;
}

function renderScalar(path, descriptor, value, hint, context) {
  if (descriptor.kind === "enum") {
    const select = el("select", "control");
    if (descriptor.optional) select.append(new Option("—", ""));
    for (const option of descriptor.values) {
      select.append(new Option(String(option), String(option), false, option === value));
    }
    select.addEventListener("change", () => {
      const raw = select.value;
      if (raw === "") return context.onChange(path, undefined);
      const match = descriptor.values.find((v) => String(v) === raw);
      context.onChange(path, match);
    });
    return select;
  }

  if (descriptor.kind === "boolean") {
    const check = el("input", "control");
    check.type = "checkbox";
    check.checked = value === true;
    check.addEventListener("change", () => context.onChange(path, check.checked));
    return check;
  }

  const control = hint?.widget === "textarea" ? el("textarea", "control control--prose") : el("input", "control");
  if (control.tagName === "INPUT") {
    control.type = descriptor.kind === "number" ? "number" : "text";
    if (descriptor.pattern) control.placeholder = descriptor.pattern;
    if (descriptor.maxLength) control.maxLength = descriptor.maxLength;
  }
  control.value = value ?? "";
  control.addEventListener("input", () => {
    const raw = control.value;
    if (raw === "" && descriptor.optional) return context.onChange(path, undefined);
    if (raw === "" && descriptor.nullable) return context.onChange(path, null);
    context.onChange(path, descriptor.kind === "number" ? Number(raw) : raw);
  });
  return control;
}

export function renderField(descriptor, path, value, context) {
  const hint = context.hints[pathToDescriptorPath(path)];
  const key = path.split(".").pop();

  if (descriptor.kind === "array") {
    if (hint?.widget === "reference-list") {
      return labelled(path, key, descriptor, renderReferenceList(path, value, hint, context));
    }
    return renderArray(descriptor, path, value ?? [], context);
  }

  if (descriptor.kind === "object") {
    const group = el("fieldset", "group");
    group.append(el("legend", "group__legend", key));
    group.append(renderObject(descriptor, path, value ?? {}, context));
    return group;
  }

  if (hint?.widget === "reference") {
    return labelled(path, key, descriptor, renderReference(path, value, descriptor, hint, context));
  }

  return labelled(path, key, descriptor, renderScalar(path, descriptor, value, hint, context));
}

function renderArray(descriptor, path, value, context) {
  const group = el("fieldset", "group");
  group.append(el("legend", "group__legend", `${path.split(".").pop()} (${value.length})`));

  value.forEach((item, index) => {
    const row = el("div", "group__row");
    const remove = el("button", "button button--quiet", "remove");
    remove.type = "button";
    remove.addEventListener("click", () => context.onRemove(path, index));
    row.append(renderField(descriptor.element, `${path}.${index}`, item, context), remove);
    group.append(row);
  });

  const add = el("button", "button", "add");
  add.type = "button";
  add.addEventListener("click", () => context.onAdd(path, blankFor(descriptor.element)));
  group.append(add);
  return group;
}

export function renderObject(descriptor, path, value, context) {
  const container = el("div", "object");
  for (const field of descriptor.fields) {
    const childPath = path ? `${path}.${field.key}` : field.key;
    container.append(renderField(field.descriptor, childPath, value?.[field.key], context));
  }
  return container;
}
