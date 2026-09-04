# Editor PR 2 — Store, API and Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dataset editable over a local HTTP API that can never write a
file `pnpm run validate` would reject, with the read/write layer under test.

**Architecture:** Four small modules, split by responsibility rather than by
layer. `inspect.ts` is pure and turns an unknown value into a structured
verdict by calling the schema's own `datasetSchema.safeParse` and `checkRules`.
`store.ts` owns all the I/O: read, etag, validate, serialize, round-trip check,
atomic write. `api.ts` is pure routing over a store — no `node:http` — so every
route is testable without opening a socket. `server.ts` builds the HTTP server
around it, and `scripts/editor.ts` is the entry point that binds the port.

**Tech Stack:** TypeScript (ESM, `"type": "module"`), zod 3.25.76 (range
`^3.23.8`), `node:http` and `node:crypto` from the standard library — no new
dependencies, `tsx --test` over `node:test` + `node:assert/strict`, pnpm 11.

**Spec:** [`docs/superpowers/specs/2026-08-27-editor-design.md`](../specs/2026-08-27-editor-design.md)

## Global Constraints

- **Package manager is pnpm.** Never `npm`. Scripts run as `pnpm run <name>`.
- **No new dependencies.** The server is standard library only. The precedent is
  `scripts/build-pdf.ts`: *"adding a dependency for this would be more
  maintenance surface than the problem it solves."*
- **Language:** identifiers, comments, docs and commit messages in English. Only
  user-visible site content is Spanish, and nothing in this PR touches it.
- **Comments explain the WHY, not the what.** Section banners `// ---`, JSDoc
  `/** */` on exported types and functions. Tone reference:
  `content/schema/validation.ts` and `editor/serialize.ts`.
- **Typing:** `interface` for data shapes, `type` for unions and aliases.
  Imports without extensions. `import type` for types
  (`verbatimModuleSyntax: true` is set, so this is enforced).
- **Tests are `*.test.ts`**, discovered by bare `pnpm test`. Style:
  `import { test } from "node:test"` + `import assert from "node:assert/strict"`.
- **No rule is ever reimplemented.** All validation comes from
  `content/schema/`. `inspect.ts` calls `datasetSchema.safeParse` and
  `checkRules` — the same two things `validateDataset` composes — and adds
  nothing of its own.
- **The editor can never write a dataset `validate` would reject**: neither a
  Zod failure nor a rule violation.
- **`editor/` never reaches `dist/`.** Nothing in `src/` may import from
  `editor/`, and nothing in `editor/` may import from `src/`.
- **Line endings:** anything comparing generated text against a file read from
  disk normalizes `\r\n` → `\n` first. `core.autocrlf` is true on the
  development machine and the CI checkout is LF.
- **Typecheck baseline is 0 errors, 0 warnings, 0 hints.**
- **Nothing in `content/schema/` or `editor/serialize.ts` gets modified.**

## What PR 1 already provides

Merged at `a2919b6` on `develop`:

- `editor/descriptors.ts` — `Descriptor`, `ObjectDescriptor`, `ArrayDescriptor`,
  `StringDescriptor`, `EnumDescriptor`, `NumberDescriptor`, `BooleanDescriptor`,
  `ObjectField`, `DescriptorFlags`.
- `editor/schema-adapter.ts` — `describe(schema)`, `UnsupportedSchemaError`, and
  `datasetDescriptor: ObjectDescriptor`.
- `editor/serialize.ts` — `serializeDataset(data: ContentDataset): string`,
  emitting `\n` and ending in exactly one newline.
- `scripts/format-data.ts` (`pnpm run format:data`) and
  `scripts/data-format.check.ts` (`pnpm run test:format`).

From `content/schema/validation.ts`, all already exported:
`datasetSchema`, `checkRules(data): RuleViolation[]`, `RuleViolation`,
`validateDataset(input): ContentDataset`.

## Two decisions this plan makes that the spec's file list did not

The spec §4 lists `store.ts` and `server.ts`. This plan splits them further, and
Task 6 updates the spec's file list to match.

1. **`api.ts` is separate from `server.ts`.** The routing is a pure function
   from a request to a response, so every route can be tested without binding a
   port. The spec's own testing rule is that the layer which reads and writes
   gets tests while the UI does not — routing is on the tested side of that
   line, and a socket in the way of those tests buys nothing.
2. **`scripts/editor.ts` is the entry point, not `server.ts`.** `server.ts`
   exports `createEditorServer(store)` and never calls `listen`. Binding a port
   and printing a URL is what an entry point does, and this repo already keeps
   its entry points in `scripts/` (`build-pdf.ts`, `format-data.ts`,
   `build-og.ts`). It also means the integration test can listen on port 0
   instead of fighting over 4322.

**Static file serving is deliberately NOT in this PR.** `editor/public/` does
not exist yet — it is PR 3. Serving a directory that is not there would be
untestable scaffolding, so every non-API path returns 404 with a message
naming PR 3. The static handler lands with the files it serves.

---

### Task 1: `inspect.ts` — one structured verdict, no reimplemented rules

`validateDataset` throws a single `Error` whose message concatenates every
violation. That is right for a CI script and wrong for a form: the editor needs
to know which field each Zod issue belongs to, and to tell shape errors apart
from rule violations.

**Files:**
- Create: `editor/inspect.ts`
- Create: `editor/inspect.test.ts`

**Interfaces:**
- Consumes: `datasetSchema`, `checkRules`, `RuleViolation` from
  `content/schema/validation`; `ContentDataset` from
  `content/schema/content-schema`.
- Produces:
  - `interface ZodIssueReport { path: string; message: string }`
  - `interface ValidationReport { ok: boolean; zodIssues: ZodIssueReport[]; violations: RuleViolation[] }`
  - `function inspectDataset(input: unknown): ValidationReport`

- [ ] **Step 1: Write the failing test**

Create `editor/inspect.test.ts`:

```ts
/**
 * The dataset's verdict, in a shape a form can render.
 *
 * `validateDataset` throws one Error with every violation concatenated into its
 * message. That is right for `pnpm run validate` and useless for a field: the
 * editor has to anchor each Zod issue to the path it came from, and to keep
 * shape errors apart from rule violations, which are cross-entity and belong in
 * a panel rather than on an input.
 *
 * What this must NOT do is decide anything itself. Every verdict below comes
 * from `content/schema/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { inspectDataset } from "./inspect";

const DATA_FILE = "content/data/content.es.json";
const dataset = JSON.parse(
  (await readFile(DATA_FILE, "utf8")).replace(/\r\n/g, "\n"),
) as Record<string, unknown>;

const clone = (): Record<string, unknown> => structuredClone(dataset);

test("the committed dataset is ok, with nothing to report", () => {
  const report = inspectDataset(dataset);
  assert.equal(report.ok, true);
  assert.deepEqual(report.zodIssues, []);
  assert.deepEqual(report.violations, []);
});

test("a shape error comes back as a Zod issue carrying its path", () => {
  const broken = clone();
  (broken.identity as Record<string, unknown>).fullName = 42;

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  const issue = report.zodIssues.find((i) => i.path === "identity.fullName");
  assert.ok(issue, `expected an issue at identity.fullName, got ${JSON.stringify(report.zodIssues)}`);
  assert.ok(issue.message.length > 0);
});

test("an array index appears in the path, so the form can find the row", () => {
  const broken = clone();
  (broken.skills as Array<Record<string, unknown>>)[0].name = null;

  const report = inspectDataset(broken);
  assert.ok(report.zodIssues.some((i) => i.path === "skills.0.name"));
});

test("an undeclared key is an issue, not a silent drop: the schema is strict", () => {
  const broken = clone();
  (broken.identity as Record<string, unknown>).nickname = "Nico";

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  assert.ok(report.zodIssues.length > 0);
});

test("a rule violation comes back as a violation, not as a Zod issue", () => {
  const broken = clone();
  // Referential integrity: rule 0. The shape is still perfectly valid.
  (broken.achievements as Array<Record<string, unknown>>)[0].roleId = "does-not-exist";

  const report = inspectDataset(broken);
  assert.equal(report.ok, false);
  assert.deepEqual(report.zodIssues, []);
  assert.ok(report.violations.some((v) => v.message.includes("does-not-exist")));
});

test("rules are not evaluated when the shape is wrong", () => {
  // checkRules indexes into a dataset it assumes is parsed. Running it over
  // garbage would throw where a report is expected, so a shape failure returns
  // early and the violations list stays empty by construction.
  const report = inspectDataset({ nonsense: true });
  assert.equal(report.ok, false);
  assert.ok(report.zodIssues.length > 0);
  assert.deepEqual(report.violations, []);
});

test("a value that is not an object at all is a report, never a throw", () => {
  assert.doesNotThrow(() => inspectDataset(null));
  assert.equal(inspectDataset(null).ok, false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/inspect.test.ts
```

Expected: failure resolving `./inspect`.

- [ ] **Step 3: Write `editor/inspect.ts`**

```ts
/**
 * `unknown` → a structured verdict.
 *
 * The editor needs the same answer `pnpm run validate` gives, in a shape a form
 * can render: each Zod issue anchored to its path, and rule violations kept
 * separate because they are cross-entity — rule 2 spans roles, rule 3 spans
 * skills and achievements — and belong in a panel, not on a field.
 *
 * It decides NOTHING itself. `datasetSchema` and `checkRules` are the same two
 * things `validateDataset` composes; a rule reimplemented here is a rule that
 * would drift from CI.
 */

import type { ContentDataset } from "../content/schema/content-schema";
import type { RuleViolation } from "../content/schema/validation";
import { checkRules, datasetSchema } from "../content/schema/validation";

/** One Zod failure, with the dotted path the form uses to find its input. */
export interface ZodIssueReport {
  path: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  zodIssues: ZodIssueReport[];
  violations: RuleViolation[];
}

export function inspectDataset(input: unknown): ValidationReport {
  const parsed = datasetSchema.safeParse(input);

  if (!parsed.success) {
    // Rules are not evaluated here on purpose: `checkRules` indexes into a
    // dataset it assumes is already parsed, so running it over a wrong shape
    // would throw where a report is expected.
    return {
      ok: false,
      zodIssues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      violations: [],
    };
  }

  const violations = checkRules(parsed.data as ContentDataset);
  return { ok: violations.length === 0, zodIssues: [], violations };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/inspect.test.ts
pnpm run typecheck
```

Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add editor/inspect.ts editor/inspect.test.ts
git commit -m "feat(editor): the dataset's verdict in a shape a form can render"
```

---

### Task 2: `store.ts` — the only thing that touches the file

This is the layer the spec says gets tests because it is where a datum gets
lost.

**Files:**
- Create: `editor/store.ts`
- Create: `editor/store.test.ts`

**Interfaces:**
- Consumes: `inspectDataset`, `ValidationReport` (Task 1);
  `serializeDataset` from `editor/serialize`; `ContentDataset` from
  `content/schema/content-schema`.
- Produces:
  - `const DATASET_FILE = "content/data/content.es.json"`
  - `function etagOf(text: string): string`
  - `interface DatasetSnapshot { data: ContentDataset; etag: string }`
  - `class InvalidDatasetError extends Error` with a `report: ValidationReport`
  - `class StaleEtagError extends Error` with a `currentEtag: string`
  - `class SerializationError extends Error`
  - `class DatasetStore` with `constructor(file?: string)`,
    `read(): Promise<DatasetSnapshot>` and
    `write(input: unknown, expectedEtag: string): Promise<DatasetSnapshot>`

**The write path, in this exact order** (spec §4.3):

```
validate (inspectDataset)  → not ok:        InvalidDatasetError, nothing written
serialize                  → round trip fails: SerializationError, nothing written
etag still matches?        → no:            StaleEtagError, nothing written
write tmp + rename         → atomic, same directory
```

The round-trip assertion before writing is what makes owning a serializer safe:
a formatting bug loses no data, it refuses to save.

- [ ] **Step 1: Write the failing test**

Create `editor/store.test.ts`:

```ts
/**
 * The layer that reads and writes. The spec singles it out for tests because it
 * is where a datum gets lost.
 *
 * Every test runs against a COPY of the real dataset in a temp directory. The
 * committed file is never touched — a test that writes to the project's single
 * source of truth would be a worse bug than anything it could catch.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentDataset } from "../content/schema/content-schema";
import {
  DatasetStore,
  InvalidDatasetError,
  StaleEtagError,
  etagOf,
} from "./store";

const REAL_FILE = "content/data/content.es.json";
const canonical = (await readFile(REAL_FILE, "utf8")).replace(/\r\n/g, "\n");

/** A store over a throwaway copy of the real dataset. */
async function freshStore(): Promise<{ store: DatasetStore; file: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "editor-store-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");
  return { store: new DatasetStore(file), file, dir };
}

const readRaw = (file: string): Promise<string> => readFile(file, "utf8");

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

test("read returns the dataset and an etag", async () => {
  const { store } = await freshStore();
  const snapshot = await store.read();
  assert.equal(snapshot.data.locale, "es");
  assert.equal(snapshot.etag, etagOf(canonical));
});

test("the etag changes when the file changes", async () => {
  const { store, file } = await freshStore();
  const before = (await store.read()).etag;
  await writeFile(file, canonical.replace('"locale": "es"', '"locale": "es" '), "utf8");
  assert.notEqual((await store.read()).etag, before);
});

test("a CRLF file reads to the same etag as an LF one: the machine cannot change the verdict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "editor-store-crlf-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical.replace(/\n/g, "\r\n"), "utf8");
  assert.equal((await new DatasetStore(file).read()).etag, etagOf(canonical));
});

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

test("write persists a change and returns the new etag", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const edited = structuredClone(data) as ContentDataset;
  edited.identity.preferredName = "Nicolás";

  const after = await store.write(edited, etag);
  assert.notEqual(after.etag, etag);

  const onDisk = await readRaw(file);
  assert.ok(onDisk.includes('"preferredName": "Nicolás"'));
  assert.equal(after.etag, etagOf(onDisk));
});

test("what write puts on disk is canonical, so the format gate stays green", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  await store.write(data, etag);
  assert.equal(await readRaw(file), canonical);
});

test("a rule violation is refused and the file is left byte-identical", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  await assert.rejects(
    () => store.write(broken, etag),
    (err: unknown) => {
      assert.ok(err instanceof InvalidDatasetError);
      assert.ok(err.report.violations.some((v) => v.message.includes("does-not-exist")));
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a shape error is refused too, with the Zod issues attached", async () => {
  const { store, file } = await freshStore();
  const { etag } = await store.read();

  await assert.rejects(
    () => store.write({ locale: "es" }, etag),
    (err: unknown) => {
      assert.ok(err instanceof InvalidDatasetError);
      assert.ok(err.report.zodIssues.length > 0);
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a stale etag is refused: the file changed underneath", async () => {
  const { store, file } = await freshStore();
  const { data } = await store.read();

  await assert.rejects(
    () => store.write(data, "not-the-current-etag"),
    (err: unknown) => {
      assert.ok(err instanceof StaleEtagError);
      assert.equal(err.currentEtag, etagOf(canonical));
      return true;
    },
  );
  assert.equal(await readRaw(file), canonical);
});

test("a refused write leaves no temporary file behind", async () => {
  const { store, dir } = await freshStore();
  const { data } = await store.read();
  await assert.rejects(() => store.write(data, "stale"));
  assert.deepEqual(await readdir(dir), ["content.es.json"]);
});

test("writing twice with the returned etag works: the snapshot is usable, not decorative", async () => {
  const { store } = await freshStore();
  const first = await store.read();

  const edited = structuredClone(first.data) as ContentDataset;
  edited.identity.preferredName = "Uno";
  const second = await store.write(edited, first.etag);

  const again = structuredClone(second.data) as ContentDataset;
  again.identity.preferredName = "Dos";
  const third = await store.write(again, second.etag);

  assert.equal((await store.read()).etag, third.etag);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/store.test.ts
```

Expected: failure resolving `./store`.

- [ ] **Step 3: Write `editor/store.ts`**

```ts
/**
 * The only thing in the editor that touches the dataset file.
 *
 * Two promises hold this together. The first is that a dataset `pnpm run
 * validate` would reject never reaches the disk — validation happens before
 * serialization, and serialization before the write. The second is that a
 * formatting bug cannot lose data: the serialized text is parsed back and
 * compared against what went in, and a mismatch refuses the save instead of
 * writing it.
 *
 * The etag exists because this file is still edited by hand and by git. A save
 * carrying a stale etag means the file moved underneath the editor — a
 * checkout, a merge, another window — and overwriting it silently would throw
 * away whatever that was.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "./serialize";
import type { ValidationReport } from "./inspect";
import { inspectDataset } from "./inspect";

export const DATASET_FILE = "content/data/content.es.json";

/**
 * Line endings are normalized first, so the same content gives the same etag on
 * a Windows checkout (CRLF) and on CI (LF).
 */
export function etagOf(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
}

export interface DatasetSnapshot {
  data: ContentDataset;
  etag: string;
}

/** The dataset was refused. `report` is what the form renders. */
export class InvalidDatasetError extends Error {
  constructor(readonly report: ValidationReport) {
    super("The dataset was refused: it violates the schema or the contract rules.");
    this.name = "InvalidDatasetError";
  }
}

/** The file changed underneath the editor since the client read it. */
export class StaleEtagError extends Error {
  constructor(readonly currentEtag: string) {
    super("The file changed underneath the editor. Reload before saving.");
    this.name = "StaleEtagError";
  }
}

/** The serializer produced text that does not parse back to the input. */
export class SerializationError extends Error {
  constructor(cause: unknown) {
    super("The serializer changed the data. Nothing was written.");
    this.name = "SerializationError";
    this.cause = cause;
  }
}

export class DatasetStore {
  constructor(private readonly file: string = DATASET_FILE) {}

  /** Raw text plus its etag. No validation: used for the pre-write etag check. */
  private async readRaw(): Promise<{ raw: string; etag: string }> {
    const raw = (await readFile(this.file, "utf8")).replace(/\r\n/g, "\n");
    return { raw, etag: etagOf(raw) };
  }

  async read(): Promise<DatasetSnapshot> {
    const { raw, etag } = await this.readRaw();
    const parsed: unknown = JSON.parse(raw);
    const report = inspectDataset(parsed);
    if (!report.ok) throw new InvalidDatasetError(report);
    return { data: parsed as ContentDataset, etag };
  }

  async write(input: unknown, expectedEtag: string): Promise<DatasetSnapshot> {
    const report = inspectDataset(input);
    if (!report.ok) throw new InvalidDatasetError(report);

    const data = input as ContentDataset;
    const serialized = serializeDataset(data);
    try {
      assert.deepStrictEqual(JSON.parse(serialized), data);
    } catch (err) {
      throw new SerializationError(err);
    }

    const { etag: currentEtag } = await this.readRaw();
    if (currentEtag !== expectedEtag) throw new StaleEtagError(currentEtag);

    // Same directory, so the rename is atomic: a reader sees the old file or
    // the new one, never a half-written one.
    const tmp = `${this.file}.tmp-${process.pid}`;
    try {
      await writeFile(tmp, serialized, "utf8");
      await rename(tmp, this.file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }

    return { data, etag: etagOf(serialized) };
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/store.test.ts
pnpm run typecheck
```

Expected: all pass, typecheck clean.

- [ ] **Step 5: Confirm the real dataset was not touched**

```bash
git status --short
```

Expected: only your two new files. If `content/data/content.es.json` appears,
a test wrote to the committed file — stop and fix the test before committing.

- [ ] **Step 6: Commit**

```bash
git add editor/store.ts editor/store.test.ts
git commit -m "feat(editor): the read/write layer, with the etag and the atomic write"
```

---

### Task 3: `api.ts` — routing as a pure function

**Files:**
- Create: `editor/api.ts`
- Create: `editor/api.test.ts`

**Interfaces:**
- Consumes: `DatasetStore`, `InvalidDatasetError`, `StaleEtagError`,
  `SerializationError` (Task 2); `inspectDataset` (Task 1);
  `datasetDescriptor` from `editor/schema-adapter`.
- Produces:
  - `interface ApiRequest { method: string; path: string; body?: unknown }`
  - `interface ApiResponse { status: number; body: unknown }`
  - `function handleApi(request: ApiRequest, store: DatasetStore): Promise<ApiResponse>`

**The routes:**

| Method + path | Response |
|---|---|
| `GET /api/schema` | 200 `{ schema: datasetDescriptor }` |
| `GET /api/dataset` | 200 `{ data, etag }` |
| `POST /api/validate` | 200 `ValidationReport` — a report is not an error |
| `PUT /api/dataset` | 200 `{ data, etag }` / 422 `{ zodIssues, violations }` / 409 `{ message, etag }` |
| a known path, wrong method | 405 `{ message }` |
| anything else | 404 `{ message }` |

- [ ] **Step 1: Write the failing test**

Create `editor/api.test.ts`:

```ts
/**
 * Every route, without a socket.
 *
 * Routing is a pure function from a request to a response, so it is tested as
 * one. What an HTTP server adds on top — parsing a body, writing a status line —
 * is tested once in `server.test.ts` and does not need repeating per route.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentDataset } from "../content/schema/content-schema";
import { DatasetStore } from "./store";
import { handleApi } from "./api";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

async function freshStore(): Promise<{ store: DatasetStore; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), "editor-api-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");
  return { store: new DatasetStore(file), file };
}

test("GET /api/schema hands over the descriptor tree", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "GET", path: "/api/schema" }, store);
  assert.equal(res.status, 200);
  const body = res.body as { schema: { kind: string; fields: Array<{ key: string }> } };
  assert.equal(body.schema.kind, "object");
  assert.equal(body.schema.fields[0].key, "schemaVersion");
});

test("GET /api/dataset hands over the data and its etag", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "GET", path: "/api/dataset" }, store);
  assert.equal(res.status, 200);
  const body = res.body as { data: ContentDataset; etag: string };
  assert.equal(body.data.locale, "es");
  assert.ok(body.etag.length > 0);
});

test("POST /api/validate answers 200 with a clean report for a good dataset", async () => {
  const { store } = await freshStore();
  const { data } = (await store.read());
  const res = await handleApi({ method: "POST", path: "/api/validate", body: data }, store);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, zodIssues: [], violations: [] });
});

test("POST /api/validate answers 200 for a BAD dataset too: a report is not an error", async () => {
  const { store } = await freshStore();
  const { data } = await store.read();
  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  const res = await handleApi({ method: "POST", path: "/api/validate", body: broken }, store);
  assert.equal(res.status, 200);
  const body = res.body as { ok: boolean; violations: Array<{ message: string }> };
  assert.equal(body.ok, false);
  assert.ok(body.violations.some((v) => v.message.includes("does-not-exist")));
});

test("PUT /api/dataset saves and returns the new etag", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  const edited = structuredClone(data) as ContentDataset;
  edited.identity.preferredName = "Nicolás";

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data: edited, etag } },
    store,
  );
  assert.equal(res.status, 200);
  assert.ok((await readFile(file, "utf8")).includes('"preferredName": "Nicolás"'));
});

test("PUT with a rule violation is 422 and writes nothing", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();
  const broken = structuredClone(data) as ContentDataset;
  broken.achievements[0].roleId = "does-not-exist";

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data: broken, etag } },
    store,
  );
  assert.equal(res.status, 422);
  const body = res.body as { violations: Array<{ message: string }> };
  assert.ok(body.violations.some((v) => v.message.includes("does-not-exist")));
  assert.equal(await readFile(file, "utf8"), canonical);
});

test("PUT with a stale etag is 409 and hands back the current one", async () => {
  const { store, file } = await freshStore();
  const { data, etag } = await store.read();

  const res = await handleApi(
    { method: "PUT", path: "/api/dataset", body: { data, etag: "stale" } },
    store,
  );
  assert.equal(res.status, 409);
  assert.equal((res.body as { etag: string }).etag, etag);
  assert.equal(await readFile(file, "utf8"), canonical);
});

test("PUT without the envelope is 400, not a crash", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "PUT", path: "/api/dataset", body: { data: {} } }, store);
  assert.equal(res.status, 400);
});

test("a known path with the wrong method is 405", async () => {
  const { store } = await freshStore();
  const res = await handleApi({ method: "DELETE", path: "/api/dataset" }, store);
  assert.equal(res.status, 405);
});

test("an unknown path is 404", async () => {
  const { store } = await freshStore();
  assert.equal((await handleApi({ method: "GET", path: "/api/nope" }, store)).status, 404);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/api.test.ts
```

Expected: failure resolving `./api`.

- [ ] **Step 3: Write `editor/api.ts`**

```ts
/**
 * The routes, as a pure function from a request to a response.
 *
 * Nothing here imports `node:http`. That is what lets every route be tested
 * without binding a port, and it keeps the HTTP layer down to what HTTP
 * actually is: reading a body, writing a status.
 *
 * The status codes carry meaning the form depends on. 422 is "your data is
 * wrong, here is where"; 409 is "the file moved underneath you, reload"; a
 * validation REPORT is 200, because being told your draft is invalid is a
 * successful request.
 */

import { datasetDescriptor } from "./schema-adapter";
import { inspectDataset } from "./inspect";
// DatasetStore is only ever a parameter type here — the routing never
// constructs one, which is what keeps it testable against any store.
import type { DatasetStore } from "./store";
import { InvalidDatasetError, StaleEtagError } from "./store";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const json = (status: number, body: unknown): ApiResponse => ({ status, body });

/** `{ data, etag }`, or null when the client sent something else. */
function readEnvelope(body: unknown): { data: unknown; etag: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as { data?: unknown; etag?: unknown };
  if (typeof candidate.etag !== "string") return null;
  if (!("data" in candidate)) return null;
  return { data: candidate.data, etag: candidate.etag };
}

export async function handleApi(request: ApiRequest, store: DatasetStore): Promise<ApiResponse> {
  const { method, path } = request;

  if (path === "/api/schema") {
    if (method !== "GET") return json(405, { message: "GET only." });
    return json(200, { schema: datasetDescriptor });
  }

  if (path === "/api/validate") {
    if (method !== "POST") return json(405, { message: "POST only." });
    return json(200, inspectDataset(request.body));
  }

  if (path === "/api/dataset") {
    if (method === "GET") return json(200, await store.read());

    if (method === "PUT") {
      const envelope = readEnvelope(request.body);
      if (!envelope) {
        return json(400, { message: 'Expected a body shaped { "data": ..., "etag": "..." }.' });
      }
      try {
        return json(200, await store.write(envelope.data, envelope.etag));
      } catch (err) {
        if (err instanceof InvalidDatasetError) {
          return json(422, { zodIssues: err.report.zodIssues, violations: err.report.violations });
        }
        if (err instanceof StaleEtagError) {
          return json(409, { message: err.message, etag: err.currentEtag });
        }
        throw err;
      }
    }

    return json(405, { message: "GET or PUT only." });
  }

  return json(404, { message: `No route for ${method} ${path}.` });
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/api.test.ts
pnpm run typecheck
git status --short
```

Expected: tests pass, typecheck clean, and `content/data/content.es.json` does
NOT appear in `git status`.

- [ ] **Step 5: Commit**

```bash
git add editor/api.ts editor/api.test.ts
git commit -m "feat(editor): the API routes, testable without a socket"
```

---

### Task 4: the server and `pnpm run editor`

**Files:**
- Create: `editor/server.ts`
- Create: `editor/server.test.ts`
- Create: `scripts/editor.ts`
- Modify: `package.json` (add the `editor` script)

**Interfaces:**
- Consumes: `handleApi`, `ApiRequest` (Task 3); `DatasetStore` (Task 2).
- Produces:
  - `const EDITOR_PORT = 4322`
  - `const MAX_BODY_BYTES = 5_000_000`
  - `function createEditorServer(store: DatasetStore): Server` — from
    `node:http`, NOT listening. The caller binds it.

**Why the entry point is separate:** `createEditorServer` never calls `listen`,
so the test can bind port 0 and the entry point can bind 4322 without the two
fighting. This repo already keeps entry points in `scripts/`.

**Static files are not served yet.** `editor/public/` arrives in PR 3; until
then every non-API path answers 404 naming it.

- [ ] **Step 1: Write the failing test**

Create `editor/server.test.ts`:

```ts
/**
 * What the HTTP layer adds on top of `handleApi`: reading a body, writing a
 * status, refusing a body too large to be a dataset.
 *
 * One pass over the wire. The routes themselves are covered in `api.test.ts`
 * and are not repeated here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { DatasetStore } from "./store";
import { createEditorServer } from "./server";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

/** Binds port 0 — the OS picks a free one, so the test never collides with 4322. */
async function serve(): Promise<{ base: string; close: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "editor-server-"));
  const file = join(dir, "content.es.json");
  await writeFile(file, canonical, "utf8");

  const server = createEditorServer(new DatasetStore(file));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
  };
}

test("GET /api/dataset answers JSON over the wire", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/api/dataset`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as { data: { locale: string }; etag: string };
    assert.equal(body.data.locale, "es");
  } finally {
    await close();
  }
});

test("a PUT with a stale etag comes back as 409", async () => {
  const { base, close } = await serve();
  try {
    const current = (await (await fetch(`${base}/api/dataset`)).json()) as { data: unknown };
    const res = await fetch(`${base}/api/dataset`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: current.data, etag: "stale" }),
    });
    assert.equal(res.status, 409);
  } finally {
    await close();
  }
});

test("a body that is not JSON is 400, not a crash", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("the page is not here yet, and the 404 says where it will be", async () => {
  const { base, close } = await serve();
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 404);
    assert.match(JSON.stringify(await res.json()), /PR 3/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm exec tsx --test editor/server.test.ts
```

Expected: failure resolving `./server`.

- [ ] **Step 3: Write `editor/server.ts`**

```ts
/**
 * The HTTP layer, and nothing more: read a body, hand it to `handleApi`, write
 * the answer.
 *
 * Standard library only. The precedent is `scripts/build-pdf.ts`, whose
 * thirty-line server carries the comment that adding a dependency for this
 * would be more maintenance surface than the problem it solves.
 *
 * It does not call `listen`: `scripts/editor.ts` binds the port. That split is
 * what lets the test bind port 0 instead of fighting over 4322.
 *
 * Static files are not served yet — `editor/public/` arrives with the page in
 * PR 3, and serving a directory that does not exist would be scaffolding no
 * test could hold down.
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";

import { handleApi } from "./api";
import type { DatasetStore } from "./store";

/** The editor's port. 4322 sits next to Astro's 4321 on purpose. */
export const EDITOR_PORT = 4322;

/** The dataset is ~30 KB. Anything near this ceiling is a mistake, not an edit. */
export const MAX_BODY_BYTES = 5_000_000;

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createEditorServer(store: DatasetStore): Server {
  return createServer((req, res) => {
    void (async () => {
      const send = (status: number, body: unknown): void => {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body, null, 2));
      };

      const path = (req.url ?? "/").split("?")[0];
      const method = req.method ?? "GET";

      if (!path.startsWith("/api/")) {
        send(404, {
          message: "The editor page arrives in PR 3. The API is under /api/.",
        });
        return;
      }

      let body: unknown;
      if (method === "POST" || method === "PUT") {
        let raw: string;
        try {
          raw = await readBody(req);
        } catch (err) {
          if (err instanceof BodyTooLargeError) {
            send(413, { message: `Body over ${MAX_BODY_BYTES} bytes.` });
            return;
          }
          throw err;
        }
        try {
          body = JSON.parse(raw);
        } catch {
          send(400, { message: "The body is not valid JSON." });
          return;
        }
      }

      try {
        const answer = await handleApi({ method, path, body }, store);
        send(answer.status, answer.body);
      } catch (err) {
        // Nothing was written: `store.write` refuses before it touches the file.
        // Surfacing the message beats a hung request with no explanation.
        send(500, { message: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm exec tsx --test editor/server.test.ts
```

Expected: all pass.

- [ ] **Step 5: Write the entry point `scripts/editor.ts`**

```ts
/**
 * `pnpm run editor`. Binds the server to loopback and says where it is.
 *
 * Deliberately outside `src/pages/`: a route inside the site would need an SSR
 * adapter to accept a POST, would be built into `dist/`, and would force the
 * three checks that walk `dist/` to grow exceptions. See
 * `docs/superpowers/specs/2026-08-27-editor-design.md` §1.
 */

import { DatasetStore } from "../editor/store";
import { EDITOR_PORT, createEditorServer } from "../editor/server";

const store = new DatasetStore();
const server = createEditorServer(store);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${EDITOR_PORT} is busy. Another editor is probably already running.`);
    process.exit(1);
  }
  throw err;
});

// Loopback only, and not by accident: this process writes to the dataset.
server.listen(EDITOR_PORT, "127.0.0.1", () => {
  console.log(`Editor API on http://127.0.0.1:${EDITOR_PORT}/api/dataset`);
  console.log("The page arrives in PR 3. Until then: curl.");
});
```

- [ ] **Step 6: Add the script**

In `package.json`, immediately after `"dev"`:

```json
"editor": "tsx scripts/editor.ts",
```

- [ ] **Step 7: Drive it by hand once**

A server nobody has talked to is not known to work. In one terminal:

```bash
pnpm run editor
```

In another:

```bash
curl -s http://127.0.0.1:4322/api/dataset | head -5
curl -s -X PUT http://127.0.0.1:4322/api/dataset \
  -H 'content-type: application/json' \
  -d '{"data":{},"etag":"stale"}' | head -20
```

Expected: the first prints the dataset's opening lines; the second answers 422
with Zod issues (the empty object fails the shape before the etag is even
looked at). Stop the server with Ctrl-C, then confirm the dataset is untouched:

```bash
git status --short
```

Expected: `content/data/content.es.json` does NOT appear.

- [ ] **Step 8: Commit**

```bash
git add editor/server.ts editor/server.test.ts scripts/editor.ts package.json
git commit -m "feat(editor): pnpm run editor, on loopback and standard library only"
```

---

### Task 5: `format-data.ts` delegates to the store

This PR created a second implementation of "write the dataset safely":
`scripts/format-data.ts` reads, normalizes, validates, serializes and writes,
and now `DatasetStore` does the same with more care — a round-trip check and an
atomic write. Two implementations of that will diverge, and the one without the
atomic write is the one that can leave a half-written source of truth.

**Files:**
- Modify: `scripts/format-data.ts` (replace its body; the file keeps its name,
  its script and its JSDoc intent)

**Interfaces:**
- Consumes: `DatasetStore`, `InvalidDatasetError`, `DATASET_FILE` (Task 2).

- [ ] **Step 1: Rewrite `scripts/format-data.ts`**

```ts
/**
 * Writes `content.es.json` in canonical form.
 *
 * It exists so the gate has an answer: `data-format.check.ts` tells you the
 * file has drifted, and this is what puts it back. Deliberately not a
 * `*.test.ts` — it writes.
 *
 * The writing itself belongs to `DatasetStore`, which validates before it
 * serializes, parses its own output back before it saves, and renames a
 * temporary file into place rather than truncating the real one. Keeping a
 * second copy of that here would mean the careful version and the casual
 * version both existed, and the casual one is the one that can leave a
 * half-written source of truth.
 */

import { readFile } from "node:fs/promises";

import { DATASET_FILE, DatasetStore, InvalidDatasetError } from "../editor/store";

const store = new DatasetStore();
const before = (await readFile(DATASET_FILE, "utf8")).replace(/\r\n/g, "\n");

// A rule violation here is data to fix, not a crash: print the rule messages
// alone, the same way `validate.ts` does, instead of a raw stack trace.
try {
  const { data, etag } = await store.read();
  await store.write(data, etag);
} catch (err) {
  if (err instanceof InvalidDatasetError) {
    for (const issue of err.report.zodIssues) console.error(`  ${issue.path}: ${issue.message}`);
    for (const violation of err.report.violations) {
      console.error(`  [rule ${violation.rule}] ${violation.message}`);
    }
    process.exit(1);
  }
  throw err;
}

const after = (await readFile(DATASET_FILE, "utf8")).replace(/\r\n/g, "\n");
console.log(
  after === before
    ? `${DATASET_FILE} was already canonical.`
    : `${DATASET_FILE} rewritten in canonical form.`,
);
```

- [ ] **Step 2: Confirm it is still a no-op on a canonical file**

```bash
pnpm run format:data
git status --short
```

Expected: it prints `... was already canonical.` and `git status` does NOT list
`content/data/content.es.json`. The store rewrites the file with identical
bytes, so git sees no change — but if git DOES report a change, stop: the store
and the check disagree about the canonical form, which is a real defect.

- [ ] **Step 3: Confirm the error path still prints cleanly**

```bash
pnpm run test:format
pnpm test
```

Expected: `test:format` 2/2, and the full unit suite green.

- [ ] **Step 4: Commit**

```bash
git add scripts/format-data.ts
git commit -m "refactor(editor): one implementation of writing the dataset, not two"
```

---

### Task 6: docs, version, and the whole gate sequence

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-27-editor-design.md`
- Modify: `package.json` (`version`)

- [ ] **Step 1: Update `CLAUDE.md`**

In the file map's `editor/` block, after the `serialize.ts` lines, add:

```
  inspect.ts          unknown → { ok, zodIssues, violations }. Calls datasetSchema.safeParse and checkRules:
                      it decides nothing itself.
  store.ts            THE only thing that touches the dataset file. Validates, round-trips its own output,
                      checks the etag, renames a temp file into place.
  api.ts              The routes, as a pure function. No node:http, so every route is tested without a socket.
  server.ts           createEditorServer(store). Does NOT listen: scripts/editor.ts binds the port.
```

In the `scripts/` block, after the `format-data.ts` line, add:

```
  editor.ts           Entry point of `pnpm run editor`. Loopback only: this process writes to the dataset.
```

In the commands block, after `pnpm run dev`, add:

```
pnpm run editor      # local dataset editor on 127.0.0.1:4322. API only until PR 3
```

- [ ] **Step 2: Update the spec's file list**

In `docs/superpowers/specs/2026-08-27-editor-design.md` §4, replace the
`store.ts` and `server.ts` lines of the file tree with:

```
  inspect.ts            unknown → a structured verdict. Pure.
  inspect.test.ts
  store.ts              Read/write: validate → serialize → round trip → etag → atomic write.
  store.test.ts
  api.ts                The routes, as a pure function over a store. No node:http.
  api.test.ts
  server.ts             createEditorServer(store). Does not listen.
  server.test.ts
scripts/editor.ts              Entry point of `pnpm run editor`. Binds 127.0.0.1:4322.
```

Then, at the end of §3.3, add a paragraph recording why the split happened:

```markdown
**Refined during PR 2.** The routing was split out of the server into `api.ts`,
and binding the port moved to `scripts/editor.ts`. Routing is a pure function
from a request to a response, so it belongs on the tested side of the line this
spec draws — a socket in the way of those tests buys nothing — and this repo
already keeps its entry points in `scripts/`.
```

- [ ] **Step 3: Bump the version**

In `package.json`: `"version": "0.16.0"`. This PR adds features, so the minor
rises.

```bash
git fetch origin develop
pnpm run test:version
```

Expected: PASS. The fetch is required — the check compares against
`origin/develop`.

- [ ] **Step 4: Run the full sequence**

```bash
pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos
```

Expected: every step green. `audit:todos` reports 9 published TODOs and does not
block.

Two things to confirm by eye rather than assume:

- `test:js`, `test:bundle` and `test:landing` walk all of `dist/`. Nothing from
  `editor/` may appear in their output. If it does, something in `src/` imported
  from `editor/`, and that import is the bug.
- `git status` is clean. A test that wrote to the real dataset would show up
  here, and that is the one failure this PR must not ship.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-27-editor-design.md package.json
git commit -m "chore: 0.16.0"
```

---

## What this PR deliberately does not do

- **No page and no static file serving.** `editor/public/` and the hints table
  are PR 3, and the server's 404 says so.
- **No authentication.** It binds `127.0.0.1`; there is nothing to authenticate
  against.
- **No change to `content/schema/` or `editor/serialize.ts`.**
- **None of the technical debt in `docs/07-technical-debt.md` §19–§22.** Those
  are their own PR; mixing them in would stop this diff telling one story.
