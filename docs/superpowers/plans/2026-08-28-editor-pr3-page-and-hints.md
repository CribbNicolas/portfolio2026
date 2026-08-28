# Editor PR 3 — The Page and the Hints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the editor a page — a master–detail form derived from the schema — so the dataset stops being edited by hand.

**Architecture:** Two testable modules land in `editor/`: `hints.ts`, an explicit table of per-path widget overrides with a test that every path still exists in the schema, and `static.ts`, the file serving the server has been deferring since PR 2. The page itself is plain ES modules under `editor/public/` with no build step: `state.js` holds the dataset and reads/writes it by path, `render.js` turns a descriptor plus a value into DOM, and `app.js` wires fetch, navigation, live validation and save. One end-to-end smoke drives the real page in a real browser.

**Tech Stack:** TypeScript for `editor/*.ts`, plain ES modules for `editor/public/*.js` (no bundler, no framework), `node:http` and `node:fs` from the standard library, `tsx --test` over `node:test`, Playwright (already a devDependency) for the one smoke, pnpm 11.

**Spec:** [`docs/superpowers/specs/2026-08-27-editor-design.md`](../specs/2026-08-27-editor-design.md)

## Global Constraints

- **Package manager is pnpm.** Never `npm`.
- **No new dependencies.** Playwright and `@types/node` are already in `devDependencies`; nothing else may be added.
- **Language:** identifiers, comments, docs and commit messages in English. The page's own visible labels come from the schema's field names, which are English too — this is a tool for the author, not site content.
- **Comments explain the WHY, not the what.** Section banners `// ---`, JSDoc on exported types and functions. Tone reference: `content/schema/validation.ts`, `editor/store.ts`.
- **Typing:** `interface` for data shapes, `type` for unions. Imports without extensions. `import type` for types (`verbatimModuleSyntax: true`).
- **Tests are `*.test.ts`**, discovered by bare `pnpm test`. Anything needing a browser or a built artifact is `*.check.ts` with its own script.
- **`editor/` never reaches `dist/`.** Nothing in `src/` imports from `editor/` and vice versa.
- **The editor can never write a dataset `validate` would reject** — the server already guarantees this; the page must not paper over the errors it returns.
- **Nothing may write to the real `content/data/content.es.json`** in any test. Copies in temp directories only.
- **Typecheck baseline is 0 errors, 0 warnings, 0 hints.**
- **Nothing in `content/schema/`, `editor/serialize.ts`, `editor/store.ts` or `editor/inspect.ts` gets modified.**

## What PR 2 already provides

On this branch (`feature/editor-page`, cut from `feature/editor-server`):

- `editor/store.ts` — `DatasetStore`, `DatasetSnapshot { data, etag }`, `InvalidDatasetError`, `StaleEtagError`, `DATASET_FILE`, `etagOf`.
- `editor/inspect.ts` — `inspectDataset(input): ValidationReport`, `ValidationReport { ok, zodIssues, violations }`, `ZodIssueReport { path, message }`.
- `editor/api.ts` — `handleApi(request, store)`, `ApiRequest`, `ApiResponse`. Routes: `GET /api/schema` → `{ schema }`, `GET /api/dataset` → `{ data, etag }`, `POST /api/validate` → the report, `PUT /api/dataset` → 200/400/409/422.
- `editor/server.ts` — `createEditorServer(store)`, `EDITOR_PORT = 4322`, `MAX_BODY_BYTES`. **Every non-API path currently answers 404 with "The editor page arrives in PR 3."** — that branch is what Task 2 replaces.
- `editor/descriptors.ts` — `Descriptor` and its members; `ObjectDescriptor.fields` is in schema declaration order.
- `scripts/editor.ts` — `pnpm run editor`, binds 127.0.0.1:4322.

## Three decisions this plan makes

1. **`editor/public/` is excluded from the typecheck.** It is browser code with no build step; type-checking it would mean JSDoc annotations over DOM plumbing to satisfy `allowJs`, and the `dist/`-walking checks never see it either. Task 5 adds the `tsconfig.json` exclude. The cost is real and named: the page's own logic is held by the smoke, not by the compiler.
2. **The hints table keys on full paths, not on field names.** The spec rejected name-based convention (`*Id` → picker) as implicit magic that a rename would silently change. Full paths with `[]` for array elements keep it a decision, and `hints.test.ts` fails when a path stops existing.
3. **One end-to-end smoke, and it is not a UI test suite.** The spec says the editor needs no UI tests, and this plan does not add per-component tests. It adds a single `editor-page.check.ts` that loads the real page in Chromium, edits a field, saves, and asserts the file on disk changed — because a page nobody has loaded is not known to work, and `editor/public/` is the one part of this PR the compiler never sees.

---

### Task 1: `hints.ts` — the widget overrides, and a test that they still point at something

**Files:**
- Create: `editor/hints.ts`
- Create: `editor/hints.test.ts`
- Modify: `editor/api.ts` (the `/api/schema` route body)
- Modify: `editor/api.test.ts` (one assertion)

**Interfaces:**
- Consumes: `Descriptor`, `ObjectDescriptor` from `editor/descriptors`; `datasetDescriptor` from `editor/schema-adapter`.
- Produces:
  - `type Widget = "textarea" | "reference" | "reference-list"`
  - `interface Hint { widget: Widget; source?: "skills" | "roles" | "projects" }`
  - `const HINTS: Record<string, Hint>` — keyed by full path, `[]` for array elements
  - `function hintFor(path: string): Hint | undefined`
  - `/api/schema` now answers `{ schema, hints }`

- [ ] **Step 1: Write the failing test**

Create `editor/hints.test.ts`:

```ts
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
import type { Descriptor } from "./descriptors";

/** Walk a dotted path with `[]` array steps. Returns undefined if it does not exist. */
function descriptorAt(path: string): Descriptor | undefined {
  let current: Descriptor = datasetDescriptor;
  for (const step of path.split(".")) {
    const key = step.endsWith("[]") ? step.slice(0, -2) : step;
    if (current.kind !== "object") return undefined;
    const field = current.fields.find((f) => f.key === key);
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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/hints.test.ts
```

Expected: failure resolving `./hints`.

- [ ] **Step 3: Write `editor/hints.ts`**

```ts
/**
 * Per-path widget overrides. The schema decides what exists; this decides how
 * to edit it, and only where the type is not enough on its own.
 *
 * Keyed by full path — `achievements[].skillIds`, not `skillIds` — on purpose.
 * A table keyed by field name is a convention, and a convention silently
 * changes a widget when someone renames a field. A full path either exists in
 * the schema or it does not, and `hints.test.ts` fails when it stops existing.
 *
 * A field with no entry here still renders, from its descriptor. That is what
 * keeps "add a field to the schema and it appears" true.
 */

/** What to draw when the descriptor's own type is not enough. */
export type Widget = "textarea" | "reference" | "reference-list";

export interface Hint {
  widget: Widget;
  /** Which top-level collection a reference picks from. */
  source?: "skills" | "roles" | "projects";
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------
//
// Two kinds of entry, and nothing else:
//
//  - References. `roleId` is a string in the schema, and typing it by hand
//    against four roles — or `skillIds` against twenty-two skills — is exactly
//    the friction this editor exists to remove. Getting one wrong surfaces only
//    at referential integrity, three commands later.
//  - Prose that is read rather than scanned. `Prose.long` has no length cap and
//    is written in paragraphs; a single-line input is the wrong shape for it.

export const HINTS: Record<string, Hint> = {
  "achievements[].roleId": { widget: "reference", source: "roles" },
  "achievements[].projectId": { widget: "reference", source: "projects" },
  "achievements[].skillIds": { widget: "reference-list", source: "skills" },
  "projects[].roleId": { widget: "reference", source: "roles" },
  "projects[].skillIds": { widget: "reference-list", source: "skills" },
  "testimonials[].projectId": { widget: "reference", source: "projects" },

  "identity.tagline.long": { widget: "textarea" },
  "identity.summary.long": { widget: "textarea" },
  "roles[].context.long": { widget: "textarea" },
  "achievements[].text.long": { widget: "textarea" },
  "projects[].problem.long": { widget: "textarea" },
  "projects[].solution.long": { widget: "textarea" },
  "projects[].outcome.long": { widget: "textarea" },
  "services[].description.long": { widget: "textarea" },

  // A technical decision is three paragraphs of argument, not three labels.
  "projects[].decisions[].context": { widget: "textarea" },
  "projects[].decisions[].rationale": { widget: "textarea" },
  "projects[].decisions[].tradeoff": { widget: "textarea" },
};

export function hintFor(path: string): Hint | undefined {
  return HINTS[path];
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/hints.test.ts
```

Expected: all pass. If "every hint points at a path the schema still has" fails, the table is wrong — fix the table, not the test.

- [ ] **Step 5: Serve the hints alongside the schema**

In `editor/api.ts`, add the import next to the others:

```ts
import { HINTS } from "./hints";
```

and change the `/api/schema` route body from `{ schema: datasetDescriptor }` to:

```ts
    return json(200, { schema: datasetDescriptor, hints: HINTS });
```

- [ ] **Step 6: Assert it in the API test**

In `editor/api.test.ts`, inside the existing `GET /api/schema` test, after the current assertions:

```ts
  const withHints = res.body as { hints: Record<string, { widget: string }> };
  assert.equal(withHints.hints["achievements[].skillIds"].widget, "reference-list");
```

- [ ] **Step 7: Verify**

```bash
pnpm exec tsx --test editor/hints.test.ts editor/api.test.ts
pnpm run typecheck
```

Expected: all pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add editor/hints.ts editor/hints.test.ts editor/api.ts editor/api.test.ts
git commit -m "feat(editor): the widget table, with a test that its paths still exist"
```

---

### Task 2: `static.ts` — serve the page, and refuse to leave its directory

**Files:**
- Create: `editor/static.ts`
- Create: `editor/static.test.ts`
- Modify: `editor/server.ts` (replace the "arrives in PR 3" branch)
- Modify: `editor/server.test.ts` (replace the test asserting that 404)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `const PUBLIC_DIR: string` — the absolute path of `editor/public`
  - `interface StaticHit { body: Buffer; contentType: string }`
  - `function resolveStatic(root: string, urlPath: string): Promise<StaticHit | null>` — `null` means "no such file", which the caller turns into a 404.

**The traversal guard is the point.** This process holds write access to the dataset; a server that can be talked into reading `../../content/data/content.es.json` — or anything else on the disk — because a URL contained `..` is the kind of thing that gets written up. The guard is: resolve the candidate, then check it is inside the resolved root.

- [ ] **Step 1: Write the failing test**

Create `editor/static.test.ts`:

```ts
/**
 * Serving the page's own files, and nothing else on the disk.
 *
 * The traversal guard carries this file. The editor process holds write access
 * to the project's single source of truth, so a URL that can walk out of
 * `editor/public/` is not a cosmetic bug — and `..` in a path is the oldest
 * trick there is.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveStatic } from "./static";

/** A throwaway public/ with one of each thing we serve, plus a secret outside it. */
async function fixture(): Promise<{ root: string; parent: string }> {
  const parent = await mkdtemp(join(tmpdir(), "editor-static-"));
  const root = join(parent, "public");
  await mkdir(root);
  await writeFile(join(root, "index.html"), "<!doctype html><title>editor</title>", "utf8");
  await writeFile(join(root, "editor.css"), "body { margin: 0 }", "utf8");
  await writeFile(join(root, "app.js"), "export const ready = true;", "utf8");
  await writeFile(join(parent, "secret.txt"), "not yours", "utf8");
  return { root, parent };
}

test("/ serves index.html as HTML", async () => {
  const { root } = await fixture();
  const hit = await resolveStatic(root, "/");
  assert.ok(hit);
  assert.match(hit.contentType, /text\/html/);
  assert.match(hit.body.toString("utf8"), /<title>editor<\/title>/);
});

test("a JavaScript module is served as JavaScript, or the browser refuses it", async () => {
  const { root } = await fixture();
  const hit = await resolveStatic(root, "/app.js");
  assert.ok(hit);
  // A module served as text/plain is blocked outright by the browser, and the
  // page fails with nothing in the network tab to explain why.
  assert.match(hit.contentType, /text\/javascript/);
});

test("CSS keeps its own type", async () => {
  const { root } = await fixture();
  assert.match((await resolveStatic(root, "/editor.css"))!.contentType, /text\/css/);
});

test("a missing file is null, not a throw", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/nope.js"), null);
});

test("a query string is not part of the filename", async () => {
  const { root } = await fixture();
  assert.ok(await resolveStatic(root, "/app.js?v=2"));
});

test("`..` cannot walk out of the root", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/../secret.txt"), null);
  assert.equal(await resolveStatic(root, "/../../secret.txt"), null);
  assert.equal(await resolveStatic(root, "/subdir/../../secret.txt"), null);
});

test("an encoded `..` cannot either: the decode happens before the guard", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/%2e%2e/secret.txt"), null);
});

test("a directory is not a file", async () => {
  const { root } = await fixture();
  assert.equal(await resolveStatic(root, "/subdir"), null);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/static.test.ts
```

Expected: failure resolving `./static`.

- [ ] **Step 3: Write `editor/static.ts`**

```ts
/**
 * The page's own files, and nothing else on the disk.
 *
 * `resolveStatic` returns `null` rather than throwing for anything it will not
 * serve — a missing file, a directory, a path that tried to leave the root —
 * so the caller has one branch for "no" and does not have to tell the reasons
 * apart. It should not: a 404 is the right answer to all of them, and a
 * distinct error for a traversal attempt would confirm the guess.
 *
 * The order matters: decode first, then resolve, then check containment.
 * Checking for `..` in the raw string instead would miss `%2e%2e`, and
 * checking after resolving is what makes the guard about where the path
 * actually lands rather than what it looks like.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `editor/public`, resolved from this file so the cwd does not matter. */
export const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "public");

export interface StaticHit {
  body: Buffer;
  contentType: string;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function resolveStatic(root: string, urlPath: string): Promise<StaticHit | null> {
  const withoutQuery = urlPath.split("?")[0];

  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // A malformed escape is not a file either.
    return null;
  }

  const rootDir = resolve(root);
  const candidate = resolve(rootDir, `.${decoded === "/" ? "/index.html" : decoded}`);

  // The guard: where it LANDS, not what it looked like. The separator check
  // stops `public-secrets/` from passing as a prefix match of `public/`.
  if (candidate !== rootDir && !candidate.startsWith(rootDir + "\\") && !candidate.startsWith(rootDir + "/")) {
    return null;
  }

  try {
    const info = await stat(candidate);
    if (!info.isFile()) return null;
  } catch {
    return null;
  }

  const dot = candidate.lastIndexOf(".");
  const extension = dot === -1 ? "" : candidate.slice(dot).toLowerCase();

  return {
    body: await readFile(candidate),
    contentType: TYPES[extension] ?? "application/octet-stream",
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/static.test.ts
```

Expected: all pass.

- [ ] **Step 5: Wire it into the server**

In `editor/server.ts`, add the import:

```ts
import { PUBLIC_DIR, resolveStatic } from "./static";
```

and replace the whole non-API branch — currently:

```ts
        if (!path.startsWith("/api/")) {
          send(404, {
            message: "The editor page arrives in PR 3. The API is under /api/.",
          });
          return;
        }
```

with:

```ts
        if (!path.startsWith("/api/")) {
          const hit = await resolveStatic(PUBLIC_DIR, req.url ?? "/");
          if (!hit) {
            send(404, { message: `No file for ${path}.` });
            return;
          }
          if (res.headersSent || res.writableEnded || res.destroyed) return;
          res.writeHead(200, { "content-type": hit.contentType });
          res.end(hit.body);
          return;
        }
```

Note it passes `req.url`, not `path`: `resolveStatic` strips the query itself, and handing it the already-split value would work but would put the same knowledge in two places.

- [ ] **Step 6: Update the server test that asserted the PR 3 404**

`editor/server.test.ts` has a test named "the page is not here yet, and the 404 says where it will be", which asserts the response body matches `/PR 3/`. That message is gone, so the test now fails — and `editor/public/` does not exist yet either, so `/` is still a 404, just a different one.

Replace that test with one that is true right now:

```ts
test("a path with no file behind it is a 404", async () => {
  const { base, close } = await serve();
  try {
    // `editor/public/` arrives in the next task; until then every path is a
    // miss, and a miss must be a clean 404 rather than a crash.
    assert.equal((await fetch(`${base}/nope.js`)).status, 404);
    assert.equal((await fetch(`${base}/`)).status, 404);
  } finally {
    await close();
  }
});
```

Task 4 replaces the `/` half of this once the page exists. Leaving the suite green at every commit is the point: a red test in a committed state is indistinguishable from a broken one.

- [ ] **Step 7: Verify**

```bash
pnpm exec tsx --test editor/static.test.ts editor/server.test.ts
pnpm run typecheck
```

Expected: both suites pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add editor/static.ts editor/static.test.ts editor/server.ts editor/server.test.ts
git commit -m "feat(editor): serve the page's files, and nothing else on the disk"
```

---

### Task 3: `state.js` and `render.js` — the dataset in memory, and descriptors as DOM

**Files:**
- Create: `editor/public/state.js`
- Create: `editor/public/render.js`

No tests: these are browser modules, and the spec's decision is that the editor gets no UI test suite. The end-to-end smoke in Task 5 is what holds them.

**Interfaces:**
- Produces, from `state.js`:
  - `createState(dataset)` → `{ get(path), set(path, value), all(), collection(name), addTo(path, value), removeAt(path, index) }`
  - `pathToDescriptorPath(path)` — turns a value path (`achievements.3.skillIds`) into a schema path (`achievements[].skillIds`)
- Produces, from `render.js`:
  - `renderField(descriptor, path, value, context)` → an `HTMLElement`
  - `renderObject(descriptor, path, value, context)` → an `HTMLElement`
  - where `context` is `{ hints, state, onChange }`

- [ ] **Step 1: Write `editor/public/state.js`**

```js
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
```

- [ ] **Step 2: Write `editor/public/render.js`**

```js
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
```

- [ ] **Step 3: Commit**

Nothing runs yet — `app.js` in Task 4 is what loads these. Commit them as the pieces they are.

```bash
git add editor/public/state.js editor/public/render.js
git commit -m "feat(editor): the dataset in memory, and descriptors as DOM"
```

---

### Task 4: the page itself

**Files:**
- Create: `editor/public/index.html`
- Create: `editor/public/editor.css`
- Create: `editor/public/app.js`

**Interfaces:**
- Consumes: `createState`, `blankFor` from `./state.js`; `renderObject` from `./render.js`; the API from PR 2.

- [ ] **Step 1: Write `editor/public/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>content editor</title>
    <link rel="stylesheet" href="/editor.css" />
  </head>
  <body>
    <header class="bar">
      <strong>content.es.json</strong>
      <span id="status" class="bar__status">loading…</span>
      <button id="save" class="button" type="button" disabled>Save</button>
    </header>

    <main class="layout">
      <nav id="nav" class="nav" aria-label="collections"></nav>
      <section id="detail" class="detail"></section>
    </main>

    <aside id="problems" class="problems" hidden></aside>

    <script type="module" src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `editor/public/editor.css`**

```css
/*
 * Deliberately plain. This is a tool the author uses alone on one machine, so
 * every minute spent on it is a minute not spent on the site it feeds.
 */

:root {
  --ink: #16181d;
  --muted: #6b7280;
  --line: #e5e7eb;
  --bad: #b91c1c;
  --accent: #2563eb;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

* { box-sizing: border-box; }
body { margin: 0; color: var(--ink); font-size: 13px; }

.bar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: #fff; z-index: 2;
}
.bar__status { color: var(--muted); margin-left: auto; }

.layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 42px); }
.nav { border-right: 1px solid var(--line); padding: 8px; overflow-y: auto; }
.nav__group { margin-bottom: 10px; }
.nav__title {
  display: flex; justify-content: space-between;
  width: 100%; padding: 4px 6px; border: 0; background: none;
  font: inherit; color: var(--ink); cursor: pointer; text-align: left;
}
.nav__item {
  display: block; width: 100%; padding: 3px 6px 3px 16px; border: 0;
  background: none; font: inherit; color: var(--muted);
  cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis;
}
.nav__item[aria-current="true"] { color: var(--accent); }

.detail { padding: 12px 16px; overflow-y: auto; }
.field { margin-bottom: 10px; }
.field__label { display: block; margin-bottom: 2px; }
.field__optional, .field__hint { color: var(--muted); margin-left: 6px; font-weight: normal; }
.field__error { color: var(--bad); margin: 2px 0 0; min-height: 0; }
.field--bad .control { border-color: var(--bad); }

.control { width: 100%; max-width: 640px; padding: 4px 6px; border: 1px solid var(--line); font: inherit; }
.control--prose { min-height: 90px; resize: vertical; }
.control--list { display: flex; flex-wrap: wrap; gap: 6px; border: 0; padding: 0; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border: 1px solid var(--line); }

.group { border: 1px solid var(--line); margin: 0 0 12px; padding: 8px 10px; }
.group__legend { color: var(--muted); padding: 0 4px; }
.group__row { display: flex; gap: 8px; align-items: flex-start; }
.group__row > :first-child { flex: 1; }

.button { padding: 4px 10px; border: 1px solid var(--line); background: #fff; font: inherit; cursor: pointer; }
.button:disabled { color: var(--muted); cursor: not-allowed; }
.button--quiet { color: var(--muted); }

.problems {
  position: sticky; bottom: 0; background: #fff;
  border-top: 1px solid var(--bad); padding: 8px 12px; color: var(--bad);
}
.problems ul { margin: 4px 0 0; padding-left: 18px; }
```

- [ ] **Step 3: Write `editor/public/app.js`**

```js
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
```

- [ ] **Step 4: Now that the page exists, assert the server serves it**

In `editor/server.test.ts`, the test added in the previous task asserts `/` is a 404 because there was no page. There is one now. Split it:

```ts
test("/ serves the page", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await res.text(), /<title>/);
  } finally {
    await close();
  }
});

test("a path with no file behind it is a 404", async () => {
  const { base, close } = await serve();
  try {
    assert.equal((await fetch(`${base}/nope.js`)).status, 404);
  } finally {
    await close();
  }
});
```

Then run it:

```bash
pnpm exec tsx --test editor/server.test.ts
```

Expected: all pass.

- [ ] **Step 5: Look at it**

```bash
pnpm run editor
```

Open `http://127.0.0.1:4322/` and check, by eye: the sidebar lists the collections with their counts; clicking an achievement shows its fields; `roleId` is a select and `skillIds` is a set of checkboxes; typing into `text.short` past 180 characters is refused by the input's own `maxlength`; and emptying a required field turns it red and disables Save.

**Then stop the server and confirm it is actually gone** — `netstat -ano | grep 4322` must show no LISTENING line — and confirm `git status` does not list `content/data/content.es.json`. If you saved from the page while looking, the dataset WILL have changed; check the diff is what you did and revert it with `git checkout content/data/content.es.json`.

- [ ] **Step 6: Commit**

```bash
git add editor/public/index.html editor/public/editor.css editor/public/app.js editor/server.test.ts
git commit -m "feat(editor): the page — master-detail, derived from the schema"
```

---

### Task 5: the smoke, the docs, and the bump

**Files:**
- Create: `scripts/editor-page.check.ts`
- Modify: `package.json` (`test:editor` script, `version`)
- Modify: `tsconfig.json` (exclude `editor/public`)
- Modify: `.github/workflows/content-validation.yml` (one step)
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-27-editor-design.md`

- [ ] **Step 1: Exclude the browser modules from the typecheck**

In `tsconfig.json`, add `"editor/public"` to `exclude`:

```json
"exclude": ["dist", "node_modules", "editor/public"]
```

Without this, `allowJs` pulls the page's modules into `tsc` and the DOM plumbing produces implicit-`any` errors that would have to be silenced with JSDoc noise. The cost is named in the spec update below: the page's logic is held by the smoke, not by the compiler.

- [ ] **Step 2: Write the smoke**

Create `scripts/editor-page.check.ts`:

```ts
/**
 * The page, in a real browser, against a real server.
 *
 * The spec says the editor needs no UI tests, and this is not one: there are no
 * per-component assertions here. It is the one end-to-end pass that proves the
 * page loads, renders from the schema, and can actually save — because
 * `editor/public/` is the only code in this repo the compiler never sees, and a
 * page nobody has loaded is not known to work.
 *
 * It runs against a COPY of the dataset in a temp directory. The committed file
 * is never touched.
 *
 * Not a `*.test.ts`: it needs Chromium, like `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";

import { DatasetStore } from "../editor/store";
import { createEditorServer } from "../editor/server";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

const dir = await mkdtemp(join(tmpdir(), "editor-page-"));
const file = join(dir, "content.es.json");
await writeFile(file, canonical, "utf8");

const server = createEditorServer(new DatasetStore(file));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const problems: string[] = [];
page.on("pageerror", (err) => problems.push(String(err)));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(message.text());
});

await page.goto(base);
await page.waitForSelector("#status:not(:empty)");

test("the page loads with no console errors", () => {
  // A module that fails to parse, a wrong content-type, a typo in a selector:
  // all of them land here and nowhere else, since none of this is typechecked.
  assert.deepEqual(problems, []);
});

test("the sidebar is built from the dataset, not hard-coded", async () => {
  const skills = await page.locator(".nav__group", { hasText: "skills" }).first();
  assert.match(await skills.innerText(), /typescript/);
});

test("a field renders from its descriptor, and a hint turns roleId into a picker", async () => {
  await page.getByRole("button", { name: "achievements" }).first().click();
  await page.locator(".nav__item").first().click();
  await page.waitForSelector('.field[data-path$="roleId"] select');

  const options = await page.locator('.field[data-path$="roleId"] select option').allInnerTexts();
  assert.ok(options.includes("dinkum"), `expected the roles as options, got ${options.join(", ")}`);
});

test("an edit reaches the file through save", async () => {
  const field = page.locator('.field[data-path$="text.short"] .control').first();
  await field.fill("Texto editado por el smoke.");
  await page.waitForFunction(() => !(document.getElementById("save") as HTMLButtonElement).disabled);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(() => document.getElementById("status")?.textContent === "saved");

  const onDisk = await readFile(file, "utf8");
  assert.match(onDisk, /Texto editado por el smoke\./);
});

test("the saved file is still canonical, so the format gate stays green", async () => {
  const { serializeDataset } = await import("../editor/serialize");
  const onDisk = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
  assert.equal(onDisk, serializeDataset(JSON.parse(onDisk)));
});

test.after(async () => {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
```

- [ ] **Step 3: Add the script**

In `package.json`, after `"test:format"`:

```json
"test:editor": "tsx --test scripts/editor-page.check.ts",
```

- [ ] **Step 4: Run it**

```bash
pnpm run test:editor
```

Expected: all pass. If the first test fails with a console error, that error is a real bug in the page — fix the page, not the smoke.

- [ ] **Step 5: Wire it into CI**

In `.github/workflows/content-validation.yml`, after the `pnpm exec playwright install chromium` step and before `pnpm run build` — it needs the browser but not a build:

```yaml
      # The editor's page. It is the only code in the repo the typecheck never
      # sees (`editor/public` is excluded: browser modules, no build step), so
      # this one end-to-end pass is what holds it. It edits a COPY of the
      # dataset in a temp directory.
      - run: pnpm run test:editor
```

Add `pnpm run test:editor` to the workflow's header comment listing the local equivalent, positioned to match the step order.

- [ ] **Step 6: Update `CLAUDE.md`**

In the `editor/` file-map block, after the `server.ts` line:

```
  hints.ts            Per-path widget overrides. Full paths, NOT field names: a convention would change a widget
                      silently on a rename. hints.test.ts fails when a path stops existing.
  static.ts           Serves editor/public. The traversal guard checks where a path LANDS, not what it looks like.
  public/             The page. Plain ES modules, no build step, and the ONLY code here the typecheck never sees —
                      which is why scripts/editor-page.check.ts exists.
```

In the `scripts/` block, after the `editor.ts` line:

```
  editor-page.check.ts  The page in a real browser: loads, renders from the schema, saves. Needs Chromium.
```

In the commands block, after `pnpm run test:format`:

```
pnpm run test:editor # the editor page end to end in Chromium (needs no build)
```

and add `pnpm run test:editor` to the full-sequence line, positioned to match the CI job's step order.

- [ ] **Step 7: Update the spec**

In `docs/superpowers/specs/2026-08-27-editor-design.md`, in the §4 file list, after the `server.test.ts` line:

```
  hints.ts              Per-path widget overrides, with a test that every path still exists.
  hints.test.ts
  static.ts             Serving editor/public, with the traversal guard.
  static.test.ts
  public/               index.html + editor.css + app.js + render.js + state.js. No bundler.
scripts/editor-page.check.ts   The page end to end in Chromium.
```

And in §2, under "Out of scope, deliberately", replace the `UI tests` line with:

```markdown
- A UI test suite. The layer that reads and writes gets tests; the rendering
  does not. **Refined in PR 3:** `editor/public/` is excluded from the
  typecheck — browser modules with no build step — so it is the one place in
  this repo neither the compiler nor a unit test looks. One end-to-end smoke
  (`scripts/editor-page.check.ts`) closes that hole: it loads the real page in
  Chromium, edits a field, saves, and checks the file. One pass, not a suite.
```

- [ ] **Step 8: Bump and run the whole sequence**

In `package.json`: `"version": "0.17.0"`.

```bash
git fetch origin develop
pnpm run test:version
pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run test:editor && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos
```

Expected: every step green. Confirm by eye that nothing from `editor/` appears in the output of `test:js`, `test:bundle` or `test:landing`, and that `git status` is clean — a smoke that wrote to the committed dataset would show up there.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json .github/workflows/content-validation.yml CLAUDE.md docs/superpowers/specs/2026-08-27-editor-design.md scripts/editor-page.check.ts
git commit -m "chore: 0.17.0"
```

---

## What this PR deliberately does not do

- **No draft mode.** A dataset that is already invalid on disk still cannot be opened for editing (`docs/07-technical-debt.md` §24 has the reasoning and the cost).
- **No per-component UI tests.** One end-to-end smoke, as above.
- **No keyboard shortcuts, no undo, no autosave.** The editor is a form and a Save button; anything more is scope this phase does not need.
- **None of `docs/07-technical-debt.md` §19–§28.** Those are their own PR.
