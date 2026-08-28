/**
 * The page: load, navigate, edit, validate, save.
 *
 * Three rules this file exists to honour, all of them from the design:
 *
 *  - It never decides whether the dataset is valid. Every verdict comes from
 *    `POST /api/validate`, which runs the same `checkRules` CI runs.
 *  - Save is blocked while anything is wrong, and validation runs while you
 *    type, so the block is never a surprise at the moment you press the button.
 *  - The whole dataset is saved in one PUT, carrying the etag it was read with.
 *    A 409 means the file moved underneath the editor and the answer is to
 *    reload, not to overwrite.
 */

import { blankFor, createState } from "./state.js";
import { renderObject } from "./render.js";

const statusEl = document.getElementById("status");
const saveEl = document.getElementById("save");
const navEl = document.getElementById("nav");
const detailEl = document.getElementById("detail");
const problemsEl = document.getElementById("problems");

let schema;
let hints;
let state;
let etag;
let selection = { collection: "identity", index: null };
let validateTimer;

const say = (text) => { statusEl.textContent = text; };

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function load() {
  const [schemaRes, datasetRes] = await Promise.all([
    fetch("/api/schema"),
    fetch("/api/dataset"),
  ]);

  if (!datasetRes.ok) {
    // The dataset on disk is already invalid — the store refuses to open it.
    // Say so plainly; `pnpm run validate` gives the detail.
    const body = await datasetRes.json().catch(() => ({}));
    say(body.message ?? "the dataset could not be read");
    return;
  }

  ({ schema, hints } = await schemaRes.json());
  const snapshot = await datasetRes.json();
  etag = snapshot.etag;
  state = createState(snapshot.data);

  renderNav();
  renderDetail();
  say("loaded");
  validate();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** A short, recognisable label for a row in the sidebar. */
function labelFor(item, index) {
  return item?.id ?? item?.code ?? item?.name ?? String(index);
}

function renderNav() {
  navEl.replaceChildren();

  for (const field of schema.fields) {
    if (field.descriptor.kind === "object") {
      navEl.append(navButton(field.key, null, field.key));
      continue;
    }
    if (field.descriptor.kind !== "array") continue;

    const items = state.collection(field.key);
    const group = document.createElement("div");
    group.className = "nav__group";
    group.append(navButton(`${field.key}`, null, field.key, items.length));
    items.forEach((item, index) => {
      group.append(navButton(labelFor(item, index), index, field.key));
    });
    navEl.append(group);
  }
}

function navButton(label, index, collection, count) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = index === null ? "nav__title" : "nav__item";
  button.textContent = label;
  if (count !== undefined) {
    const badge = document.createElement("span");
    badge.textContent = String(count);
    button.append(badge);
  }
  const current = selection.collection === collection && selection.index === index;
  if (current) button.setAttribute("aria-current", "true");
  button.addEventListener("click", () => {
    selection = { collection, index };
    renderNav();
    renderDetail();
  });
  return button;
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

const context = () => ({
  hints,
  state,
  onChange(path, value) {
    state.set(path, value);
    scheduleValidate();
  },
  onAdd(path, value) {
    state.addTo(path, value);
    renderNav();
    renderDetail();
    scheduleValidate();
  },
  onRemove(path, index) {
    state.removeAt(path, index);
    renderNav();
    renderDetail();
    scheduleValidate();
  },
});

function renderDetail() {
  const field = schema.fields.find((f) => f.key === selection.collection);
  if (!field) return;

  detailEl.replaceChildren();

  if (field.descriptor.kind === "object") {
    detailEl.append(header(selection.collection));
    detailEl.append(renderObject(field.descriptor, selection.collection, state.get(selection.collection), context()));
    return;
  }

  const items = state.collection(selection.collection);

  if (selection.index === null) {
    detailEl.append(header(`${selection.collection} (${items.length})`));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "button";
    add.textContent = `add ${selection.collection}`;
    add.addEventListener("click", () => {
      state.addTo(selection.collection, blankFor(field.descriptor.element));
      selection = { collection: selection.collection, index: items.length };
      renderNav();
      renderDetail();
      scheduleValidate();
    });
    detailEl.append(add);
    return;
  }

  const item = items[selection.index];
  detailEl.append(header(`${selection.collection}: ${labelFor(item, selection.index)}`));
  detailEl.append(
    renderObject(
      field.descriptor.element,
      `${selection.collection}.${selection.index}`,
      item,
      context(),
    ),
  );
}

function header(text) {
  const node = document.createElement("h1");
  node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// Validation. The server decides; this only draws the answer.
// ---------------------------------------------------------------------------

function scheduleValidate() {
  clearTimeout(validateTimer);
  validateTimer = setTimeout(validate, 300);
}

async function validate() {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state.all()),
  });
  showReport(await res.json());
}

function showReport(report) {
  for (const node of detailEl.querySelectorAll(".field--bad")) {
    node.classList.remove("field--bad");
    node.querySelector(".field__error").textContent = "";
  }

  for (const issue of report.zodIssues) {
    const node = detailEl.querySelector(`.field[data-path="${CSS.escape(issue.path)}"]`);
    if (!node) continue;
    node.classList.add("field--bad");
    node.querySelector(".field__error").textContent = issue.message;
  }

  // Violations are cross-entity by nature — rule 2 spans roles, rule 3 spans
  // skills and achievements — so they belong in a panel, not on a field.
  problemsEl.replaceChildren();
  const problems = [
    ...report.violations.map((v) => `rule ${v.rule}: ${v.message}`),
    ...report.zodIssues
      .filter((issue) => !detailEl.querySelector(`.field[data-path="${CSS.escape(issue.path)}"]`))
      .map((issue) => `${issue.path}: ${issue.message}`),
  ];

  problemsEl.hidden = problems.length === 0;
  if (problems.length > 0) {
    problemsEl.append(document.createTextNode(`${problems.length} problem(s)`));
    const list = document.createElement("ul");
    for (const text of problems) {
      const row = document.createElement("li");
      row.textContent = text;
      list.append(row);
    }
    problemsEl.append(list);
  }

  saveEl.disabled = !report.ok;
  say(report.ok ? "ready to save" : "cannot save while there are problems");
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

saveEl.addEventListener("click", async () => {
  saveEl.disabled = true;
  say("saving…");

  const res = await fetch("/api/dataset", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: state.all(), etag }),
  });
  const body = await res.json();

  if (res.ok) {
    etag = body.etag;
    say("saved");
    return;
  }

  if (res.status === 409) {
    say("the file changed on disk — reload before saving");
    return;
  }

  showReport({ ok: false, zodIssues: body.zodIssues ?? [], violations: body.violations ?? [] });
  say(body.message ?? "the server refused the save");
});

load();
