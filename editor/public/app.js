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
import { renderField, renderObject } from "./render.js";

const statusEl = document.getElementById("status");
const saveEl = document.getElementById("save");
const navEl = document.getElementById("nav");
const detailEl = document.getElementById("detail");
const problemsEl = document.getElementById("problems");

let schema;
let hints;
let state;
let etag;
/** Last successfully loaded or saved dataset, used to stamp `updatedAt`. */
let loaded;
let selection = { collection: "identity", index: null };
let validateTimer;
// Bumped at the start of every `validate()` call. A response only gets to
// draw itself if it is still the most recent request when it lands — without
// this, a slow earlier response can overwrite a faster later one, including
// `saveEl.disabled`, and the button would reflect stale text.
let validateSeq = 0;
/**
 * A 409 means the file moved underneath us. Nothing but a reload (which
 * re-runs `load()`) may re-enable Save: the next keystroke's validate
 * report does not know the etag is stale, and pressing Save would buy
 * another guaranteed 409.
 */
let stale = false;

const HEADER = "header";

const say = (text) => { statusEl.textContent = text; };

const allowSave = (enabled) => {
  saveEl.disabled = stale || !enabled;
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function load() {
  let schemaRes;
  let datasetRes;
  try {
    [schemaRes, datasetRes] = await Promise.all([
      fetch("/api/schema"),
      fetch("/api/dataset"),
    ]);
  } catch (err) {
    say(`could not load the editor: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!schemaRes.ok) {
    say("the schema could not be read");
    return;
  }

  try {
    ({ schema, hints } = await schemaRes.json());
  } catch {
    say("the schema could not be read");
    return;
  }

  if (!datasetRes.ok) {
    const body = await datasetRes.json().catch(() => ({}));
    // 422 carries the same report PUT already returns. Draw it so a bad
    // merge is diagnosable from the page, not only from `pnpm run validate`.
    if (Array.isArray(body.zodIssues) || Array.isArray(body.violations)) {
      showReport({
        ok: false,
        zodIssues: body.zodIssues ?? [],
        violations: body.violations ?? [],
      });
    }
    say(body.message ?? "the dataset could not be read");
    return;
  }

  const snapshot = await datasetRes.json();
  stale = false;
  etag = snapshot.etag;
  state = createState(snapshot.data);
  loaded = structuredClone(snapshot.data);

  renderNav();
  renderDetail();
  say("loaded");
  validate();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * A short, recognisable label for a row in the sidebar.
 *
 * `||`, not `??`: a freshly added row gets `id: ""` from `blankFor` (a
 * required string's blank is `""`, not absent), and a blank id is the normal
 * state of a row the author has not named yet. `??` only skips `null`/
 * `undefined`, so it would render that row's label as empty and leave it
 * unfindable in the list; falling through on any falsy id/code/name keeps
 * the index visible until there is something better to show.
 */
function labelFor(item, index) {
  return item?.id || item?.code || item?.name || String(index);
}

function scalarFields() {
  return schema.fields.filter(
    (field) => field.descriptor.kind !== "object" && field.descriptor.kind !== "array",
  );
}

function renderNav() {
  navEl.replaceChildren();

  if (scalarFields().length > 0) {
    const group = document.createElement("div");
    group.className = "nav__group";
    group.append(navButton("header", null, HEADER));
    navEl.append(group);
  }

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
  detailEl.replaceChildren();

  if (selection.collection === HEADER) {
    detailEl.append(header("header"));
    for (const field of scalarFields()) {
      detailEl.append(renderField(field.descriptor, field.key, state.get(field.key), context()));
    }
    return;
  }

  const field = schema.fields.find((f) => f.key === selection.collection);
  if (!field) return;

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
      // Captured before the push: `items` is a live reference to the same
      // array `state.addTo` mutates, so reading `.length` after the push
      // would already be the post-push length — one past the new item — and
      // the detail pane would render `items[undefined]` with nothing bound.
      const index = items.length;
      state.addTo(selection.collection, blankFor(field.descriptor.element));
      selection = { collection: selection.collection, index };
      renderNav();
      renderDetail();
      scheduleValidate();
    });
    detailEl.append(add);
    return;
  }

  const item = items[selection.index];
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button button--quiet";
  remove.textContent = "remove this item";
  remove.addEventListener("click", removeSelected);
  detailEl.append(header(`${selection.collection}: ${labelFor(item, selection.index)}`, remove));
  detailEl.append(
    renderObject(
      field.descriptor.element,
      `${selection.collection}.${selection.index}`,
      item,
      context(),
    ),
  );
}

function header(text, extra) {
  const bar = document.createElement("div");
  bar.className = "detail__header";
  const node = document.createElement("h1");
  node.textContent = text;
  bar.append(node);
  if (extra) bar.append(extra);
  return bar;
}

/**
 * Paths in the dataset that point at `id` via a reference hint whose source
 * is `collection`. Used to refuse a top-level delete that would only fail
 * later as a 422 from referential integrity.
 */
function incomingRefs(collection, id) {
  if (!id) return [];
  const hits = [];
  for (const [schemaPath, hint] of Object.entries(hints)) {
    if (hint.source !== collection) continue;
    walkHint(state.all(), schemaPath.split("."), "", (valuePath, value) => {
      if (hint.widget === "reference-list" && Array.isArray(value) && value.includes(id)) {
        hits.push(valuePath);
      } else if (hint.widget === "reference" && value === id) {
        hits.push(valuePath);
      }
    });
  }
  return hits;
}

function walkHint(data, parts, prefix, visit) {
  if (parts.length === 0) {
    visit(prefix, data);
    return;
  }
  const [head, ...tail] = parts;
  if (head.endsWith("[]")) {
    const key = head.slice(0, -2);
    const list = data?.[key];
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      const next = prefix ? `${prefix}.${key}.${index}` : `${key}.${index}`;
      walkHint(item, tail, next, visit);
    });
    return;
  }
  const next = prefix ? `${prefix}.${head}` : head;
  walkHint(data?.[head], tail, next, visit);
}

function removeSelected() {
  const item = state.collection(selection.collection)[selection.index];
  const id = item?.id;
  const refs = incomingRefs(selection.collection, id);
  if (refs.length > 0) {
    problemsEl.hidden = false;
    problemsEl.replaceChildren();
    problemsEl.append(
      document.createTextNode(`cannot remove "${id}": ${refs.length} reference(s)`),
    );
    const list = document.createElement("ul");
    for (const path of refs) {
      const row = document.createElement("li");
      row.textContent = path;
      list.append(row);
    }
    problemsEl.append(list);
    say(`cannot remove "${id}" while something still points at it`);
    return;
  }
  if (!confirm(`Remove ${selection.collection}: ${labelFor(item, selection.index)}?`)) return;
  state.removeAt(selection.collection, selection.index);
  selection = { collection: selection.collection, index: null };
  renderNav();
  renderDetail();
  scheduleValidate();
}

// ---------------------------------------------------------------------------
// Validation. The server decides; this only draws the answer.
// ---------------------------------------------------------------------------

function scheduleValidate() {
  clearTimeout(validateTimer);
  validateTimer = setTimeout(validate, 300);
}

async function validate() {
  const seq = ++validateSeq;
  let report;
  try {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.all()),
    });
    report = await res.json();
  } catch {
    // The request never made it there and back, or what came back was not
    // JSON: no verdict either way. This runs on every keystroke, so an
    // unhandled rejection here is one per keystroke while the status bar still
    // reads "ready to save".
    if (seq !== validateSeq) return;
    // Save stays available on purpose. The server validates every PUT and
    // refuses what is wrong with the full report, so it — not this — is the
    // authority; disabling here would leave no way to find out either.
    if (stale) return;
    allowSave(true);
    say("could not check the dataset — Save will get the verdict from the server");
    return;
  }
  // Drop a response that is no longer the latest request: the button's state
  // has to reflect the text as it is now, not as it was two keystrokes ago.
  if (seq !== validateSeq) return;
  showReport(report);
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

  allowSave(report.ok);
  if (stale) {
    say("the file changed on disk — reload before saving");
    return;
  }
  say(report.ok ? "ready to save" : "cannot save while there are problems");
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

function sameExceptUpdatedAt(a, b) {
  const strip = ({ updatedAt: _drop, ...rest }) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

saveEl.addEventListener("click", async () => {
  saveEl.disabled = true;
  say("saving…");

  if (!loaded || !sameExceptUpdatedAt(state.all(), loaded)) {
    state.set("updatedAt", new Date().toISOString());
    if (selection.collection === HEADER) renderDetail();
  }

  let res;
  let body;
  try {
    res = await fetch("/api/dataset", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: state.all(), etag }),
    });
    body = await res.json();
  } catch {
    // The request never made it there and back — a dropped connection or the
    // editor process going away, not a verdict on the data. The last
    // validation said the data was fine, so re-enable Save instead of
    // leaving the button stuck on a request that will never resolve.
    allowSave(true);
    say("could not reach the editor — check it is still running, then try again");
    return;
  }

  if (res.ok) {
    etag = body.etag;
    loaded = structuredClone(state.all());
    say("saved");
    return;
  }

  if (res.status === 409) {
    stale = true;
    saveEl.disabled = true;
    say("the file changed on disk — reload before saving");
    return;
  }

  showReport({ ok: false, zodIssues: body.zodIssues ?? [], violations: body.violations ?? [] });
  say(body.message ?? "the server refused the save");
});

// A rejection here (server unreachable at page load) must not leave the page
// stuck on "loading…" forever with both panes empty and no explanation.
load().catch((err) => {
  say(`could not load the editor: ${err instanceof Error ? err.message : String(err)}`);
});
