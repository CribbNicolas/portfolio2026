# Design — `pnpm run editor`

Phase 2 of [`06`](../../06-next-session.md). Decided 2026-08-27.

A local editor for `content/data/content.es.json`, so the dataset stops being
edited by hand. It is not a CMS and it is not a route of the site: it is a Node
process that runs on your machine, writes one file, and can only write a file
`pnpm run validate` would accept.

---

## 1. Why it is not inside `src/pages/`

Decided 2026-08-25, recorded here because every later decision hangs off it.
A route inside the site would bring back three problems this repo already paid
to avoid:

1. Writing a file needs `POST`, and with `output: "static"` the endpoints are
   prerendered and GET-only. Enabling POST means an SSR adapter — the same thing
   that got Keystatic discarded.
2. A page in `src/pages/` gets built. "It only works locally" would come to
   depend on an `import.meta.env.DEV` guard, i.e. on nobody breaking it.
3. `no-client-js`, `bundle-budget` and `single-landing` walk all of `dist/`. An
   editor with forms would force them to have exceptions, and an exception
   inside a check is a permanent crack.

Precedent: `scripts/build-pdf.ts` already starts a 30-line server, with the
comment *"adding a dependency for this would be more maintenance surface than
the problem it solves"*.

**Consequence:** nothing under `editor/` reaches `dist/`, so no check needs an
exception and the byte budgets are untouched.

---

## 2. Scope

**The whole dataset**, not only the fields that get edited often: achievements,
metrics and prose, but also visibility, priorities, skillIds, roles, projects,
education and languages.

**The form is derived from the Zod schema.** Adding a field to `validation.ts`
makes it appear in the editor with no extra work. With full-dataset scope it is
the only option that does not drift: hand-writing forms for ~20 interfaces
guarantees that in three months the editor and the schema disagree.

**Out of scope, deliberately:**

- Editing from a phone. Discarded in [`06`](../../06-next-session.md) §4.
- Authentication. The server binds `127.0.0.1`; there is nothing to authenticate
  against.
- Loading the missing data (metrics, English level, project links). That is the
  work the editor exists to make bearable, and it happens after it is built.
- UI tests. The layer that reads and writes gets tests; the rendering does not.

---

## 3. Decisions

### 3.1 Zod introspection: an adapter, keeping the range

Introspection in zod 3 goes through `_def`, which is internal API and not
covered by semver. `package.json` declares `^3.23.8`; what is installed is
**3.25.76** — two minors of internal churn that arrived without anyone deciding.

**Decision: keep the range, and put every `_def` access behind one module.**
`editor/schema-adapter.ts` is the only file in the repo allowed to read `_def`,
and it has tests that assert the shape it expects — a field's type, whether it
is optional, an enum's values, an array's element. A zod bump then fails in one
file with a message that says what changed, instead of failing silently and
diffusely across the editor.

Rejected: pinning the exact version. It would freeze zod for the whole repo to
protect one module, and once the adapter has tests the pin adds nothing.

Zod 4 changed introspection substantially. That migration will hurt whenever it
comes; the adapter is what keeps it to one file.

### 3.2 Writing the JSON: a canonical serializer

`JSON.stringify(data, null, 2)` rewrites all 344 lines on the first save: it
drops the blank lines that group the top-level sections and expands the
one-object-per-line style of `skills`. Every data commit would then mix the real
change with a reformat, which is half the reason the data is still in git.

**Decision: our own deterministic serializer, the file normalized once, and a
gate that keeps it canonical.** Not a width heuristic — an explicit set of
rules, so a new alias never reformats a row it does not belong to:

1. Two-space indent, trailing newline, and `\n` as the line separator the
   serializer emits.
2. Key order is the schema's order (the adapter already produces it).
3. A blank line before every top-level key except the first three
   (`schemaVersion`, `locale`, `updatedAt` stay as a header block).
4. Arrays of scalars inline — `["TS"]` — when the inline form fits in 100
   columns counting the indent; otherwise one element per line. Measured over
   the 44 scalar arrays in the dataset: the widest is `identity.titleAliases`
   at 110 columns (expanded today) and the next is 76 (inline today). The
   threshold sits in a 34-column gap, so it is not tuned to a knife edge.
5. What prints inline comes from two explicit tables, not from a width:
   `visibility` is an inline object wherever it appears, and the arrays
   `skills`, `languages`, `certifications`, `links`, `media` and `periods`
   print one inline object per line. Everything else is expanded.

   A width rule cannot express this: a `skills` element is ~190 columns inline
   and must stay inline, a `Prose` object is ~170 and must stay expanded. They
   overlap, so no threshold separates them — which is why the table is the
   mechanism and not a fallback for it.

Applied to the current dataset this is expected to produce a **one-line diff**:
a blank line before `testimonials`. Key order was checked against the schema
across every object in the dataset and already matches, so rule 2 moves nothing.
That normalization is its own commit, and if the diff turns out larger than the
expected line, the rules get reconciled with the file before it is committed —
the normalization is not allowed to smuggle in a reformat.

`scripts/data-format.check.ts` fails if the committed JSON is not in canonical
form, so a hand edit stays canonical too and the gate does not depend on the
editor being the only writer.

**Line endings are compared normalized, and that is not a detail.** The repo has
no `.gitattributes` and `core.autocrlf` is `true`, so `content.es.json` sits as
CRLF in a Windows working copy and as LF in the Linux checkout CI runs on. A
byte comparison would fail locally and pass in CI — the worst shape a gate can
have. The serializer emits `\n`; the check and the store both collapse `\r\n` to
`\n` before comparing. Git still normalizes to LF on commit, so writing `\n`
produces no diff noise either.

Rejected: `jsonc-parser` for surgical edits. It preserves arbitrary hand
formatting with no normalization, at the cost of a dependency in a repo that
states it prefers thirty lines of its own to one more package.

### 3.3 Shape: a JSON API plus a vanilla page

**Decision: the adapter runs in Node and exposes the schema as a plain JSON
descriptor tree; a static page with vanilla ES modules renders it.** No bundler,
no framework, no build step.

That split is the point: the only module that knows about zod is the adapter,
and the client is a dumb renderer over JSON. It also allows adding and removing
array items (`skillIds`, `periods`, `links`, `media`) without a round trip, and
showing `checkRules` violations while typing.

Rejected: server-rendered forms with `POST` and a full reload — every array item
becomes a round trip and half-edited state lives on the server. Rejected: an
interactive CLI — bad at exactly what this is for (multi-line prose, seeing a
role with its achievements, navigating 22 skills).

**Refined during PR 2.** The routing was split out of the server into `api.ts`,
and binding the port moved to `scripts/editor.ts`. Routing is a pure function
from a request to a response, so it belongs on the tested side of the line this
spec draws — a socket in the way of those tests buys nothing — and this repo
already keeps its entry points in `scripts/`.

### 3.4 Saving: a hard block, with live validation

`checkRules` does not distinguish warnings: everything is a violation.

**Decision: the editor can never write a dataset `validate` would reject** —
neither a Zod failure nor a rule violation. To keep that from being a surprise
at save time, validation runs on every change (debounced, `POST /api/validate`),
so the violation shows up while typing.

Multi-entity edits are not a problem: the whole dataset is held in memory in the
client, so creating a skill and the achievement that references it happens
together and is saved once.

Rejected: blocking on Zod only and letting rule violations through. It would
allow committing a dataset that `pnpm run validate` rejects — precisely what
[`06`](../../06-next-session.md) says the editor must not be able to do.

### 3.5 Widgets: the schema plus a checked hints table

A form derived from the schema alone renders `skillIds: string[]` as free-text
inputs, and `roleId` the same. Typing ids by hand against 22 skills, with the
error surfacing only at referential integrity, is the friction the editor exists
to remove.

**Decision: the schema decides which fields exist and of what type; a small
table of per-path overrides decides the widget when the type is not enough.**
`achievements[].skillIds` → a multi-select of existing skills, `*.roleId` → a
select of roles, `*.long` → a textarea. A field with no hint still renders from
the schema, so the "add a field, it appears" property holds. `hints.test.ts`
fails if a hint points at a path the schema no longer emits: drift is detected,
not assumed.

Rejected: convention by field name (`*Id` → reference picker). Implicit magic —
renaming a field silently changes its widget and nothing verifies it.

---

## 4. Architecture

```
editor/
  descriptors.ts        The field-tree types. Zero zod imports.
  schema-adapter.ts     zod `_def` → Descriptor tree. THE ONLY file touching `_def`.
  schema-adapter.test.ts
  hints.ts              path → widget table. Overrides, not a replacement.
  hints.test.ts         Every hint path exists in the tree the adapter emits.
  serialize.ts          The canonical serializer.
  serialize.test.ts
  inspect.ts            unknown → a structured verdict. Pure.
  inspect.test.ts
  store.ts              Read/write: validate → serialize → round trip → etag → atomic write.
  store.test.ts
  api.ts                The routes, as a pure function over a store. No node:http.
  api.test.ts
  server.ts             createEditorServer(store). Does not listen.
  server.test.ts
  public/               index.html + app.js + editor.css. No bundler, ES modules.
scripts/editor.ts              Entry point of `pnpm run editor`. Binds 127.0.0.1:4322.
scripts/format-data.ts         Writes content.es.json in canonical form. The fix path the gate points at.
scripts/data-format.check.ts   Gate: content.es.json is in canonical form.
```

### 4.1 The seam: `descriptors.ts`

The tree the adapter emits is plain JSON, so the client never sees zod:

```ts
type Descriptor =
  | { kind: "string"; optional; nullable; minLength?; maxLength?; pattern? }
  | { kind: "number" | "boolean" }
  | { kind: "enum"; values: string[] }   // z.enum AND unions of literals
  | { kind: "array"; element: Descriptor }
  | { kind: "object"; fields: Array<{ key: string; descriptor: Descriptor }> };
```

`fields` keeps the schema's declaration order, which is also where the
serializer's key order comes from — one source, not two.

`visibility.priority` is a union of the literals 1–5, not a `z.enum`. The
adapter collapses unions of literals into `enum`; that is a named test case, not
an incidental behaviour.

### 4.2 The API

`server.ts` binds `127.0.0.1:4322`. No CORS: nothing else is meant to reach it.

| Route | What it does |
|---|---|
| `GET /` + static | Serves `editor/public/`. Its own server, not Astro. |
| `GET /api/schema` | Descriptor tree + hints. Fetched once on load. |
| `GET /api/dataset` | The current dataset + an `etag` (hash of the file as read). |
| `POST /api/validate` | Body is a candidate dataset. Returns `{ zodIssues[], violations[] }`. |
| `PUT /api/dataset` | Body is a dataset + `etag`. Validates, serializes, writes. |

### 4.3 The write path, in strict order

```
body → datasetSchema.parse   → fails: 422 { zodIssues }
     → checkRules            → fails: 422 { violations }
     → serialize()           → parse(output) must deep-equal the input, else 500 (nothing is written)
     → write tmp             → the slow part (bytes to disk) happens BEFORE the check
     → etag still matches?   → no: 409 (the file changed underneath: a git checkout, a hand edit)
     → rename                → atomic, same directory
```

Writing the tmp file before the etag recheck, not after, is deliberate: the
only step that touches the target file — the rename — sits strictly after the
check, which shrinks the check-then-act window to the rename alone instead of
spanning the whole write. It is also what makes the cleanup path reachable at
all: with the write after the check, a `writeFile` failure could only happen
past the point where refusing still matters.

`store.ts` reimplements no rule: it calls `inspectDataset` from
`editor/inspect.ts`, which composes `datasetSchema.safeParse` and `checkRules`
— the same two things `validateDataset` composes, for the same reason
(`editor/inspect.ts` says why at the top). A rule error in the editor and in CI
are literally the same message.

The round-trip assertion before writing is what makes the serializer safe to
own: a formatting bug loses no data, it refuses to save.

### 4.4 Errors in the client

Every Zod issue carries a `path`; every violation carries a rule number and its
text. The renderer anchors Zod issues to their field by path. `checkRules`
violations are cross-entity by nature — rule 2 spans roles, rule 3 spans skills
and achievements — so they go to a fixed panel, not to a field. Save stays
disabled while either list is non-empty.

---

## 5. Testing

[`06`](../../06-next-session.md): *"the editor needs no UI tests, but the layer
that reads and writes does: it is where a datum gets lost."*

| File | What it holds down |
|---|---|
| `schema-adapter.test.ts` | The shape it expects from `_def`: field type, optionality, enum values, array element, unions of literals collapsed to `enum`, `.strict()` respected. **This file is the gate for a zod bump.** |
| `serialize.test.ts` | Round trip (`parse(serialize(x))` ≡ `x`), idempotence (`serialize(serialize(x))` ≡ `serialize(x)`), and that the normalized real dataset differs from today's only by the expected blank line. |
| `store.test.ts` | Rejects an invalid dataset without touching the file, writes atomically, returns 409 on a stale etag, and leaves no `.tmp` file behind when `writeFile` fails. |
| `hints.test.ts` | Every path in the table exists in the adapter's tree. |
| `scripts/data-format.check.ts` | The committed JSON is canonical, compared with line endings normalized so the verdict is the same on Windows and in CI. Runs in `content-validation.yml`. |

New scripts: `pnpm run editor` and `pnpm run test:format`.

---

## 6. Delivery

Three PRs into `develop`, each green and each with its own version bump
([`08`](../../08-branches-and-versioning.md)).

| PR | What | Why it can stand alone |
|---|---|---|
| 1 | `descriptors` + `schema-adapter` + `serialize` + the JSON normalization + `data-format.check.ts` + CI | The serializer and the adapter are worth having even if the phase stops here |
| 2 | `store` + `server` + the API + read/write tests | Editable with `curl`, with no page |
| 3 | `public/` + hints + polish | The form itself |

The normalization lands in PR 1 as its own commit, so the reformat never shares
a diff with new code.
