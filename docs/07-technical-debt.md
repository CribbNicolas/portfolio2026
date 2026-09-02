# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**23 of 37 entries are closed.** The open ones keep their original numbers: a
renumbered list breaks every reference from a commit message or another doc.

What does **not** go here: product and data pending items, which live in
[00-index](./00-index.md) and [06-next-session](./06-next-session.md). This is
only code and infrastructure debt.

---

## Resolved

Kept as a one-line record. The reasoning is in the commit that closed each one.

| # | What it was | Closed by |
|---|---|---|
| 1 | Soft 404: a non-existent route returned `200 text/html`, so crawlers treated broken URLs as valid pages | `src/pages/404.astro` + the check in `single-landing.check.ts` |
| 2 | Vite warned that a chunk exceeded 500 kB on every build. The warning described the intended design, and a warning that is always there is one nobody reads | `chunkSizeWarningLimit: 600` in `astro.config.mjs`, with the comment saying the real ceiling is `bundle-budget.check.ts` |
| 3 | Three dead symbols in `graph-3d.ts`. `ORBIT` was the bad one: a configuration constant with a believable name that did nothing | Deleted, and the two genuinely ignored values marked as such |
| 4 | Three `<script>` tags carrying the `astro(4000)` hint | Explicit `is:inline`. Typecheck went from 7 hints to 0 |
| 5 | A merge into `main` left no CI run of its own, which reads as if the merge skipped validation | Accepted and closed. The check that counts comes from the `pull_request` event and always runs; the per-branch run adds nothing |
| 7 | `/cv.json` published `visibility`, `priority`, `publishPhoneOn` and `Metric.source` | `Viewed<T>` in the view types; `resolveView` projects every surface |
| 8 | `/cv.json` and `/llms.txt`, the two surfaces agents consume, had no gate at all. A real `formatRoleTitle` bug had already got through into one of them | `scripts/endpoints.check.ts`, in `content-validation.yml` with the other checks that read `dist/` |
| 9 | The skill grouping lived in two places and had diverged: the CV printed `Lenguajes:` in editorial order, `/llms.txt` printed `- language:` in insertion order | `content/schema/skill-groups.ts`, imported by both |
| 10 | Nothing verified the fonts were embedded. The PDF would look right on a machine with Manrope installed and wrong on every other one | A test in `pdf-output.check.ts` reading the font descriptors, which runs against the published PDF too |
| 11 | `pnpm audit` reported a high through `astro > sharp <0.35.0`, so `audit:deps` failed on every run | An `overrides` entry in `pnpm-workspace.yaml` — pnpm 11 no longer reads `pnpm.overrides` from package.json |
| 12 | Three acceptance criteria lived in an old plan as commands to paste into a terminal | Two were already covered (`no-client-js.check.ts` is stricter than criterion 3's grep; `jsonld.test.ts` covers criterion 4). The third — invariant 1 — is now `scripts/invariants.test.ts` |
| 13 | Cross-hover, pill inertia and the PDF were never looked at by eye | Author, 2026-08-31. The download in `astro dev` 404'd; `localCvPdf` in `astro.config.mjs` serves `dist/cv.pdf` |
| 14 | `smoke-deploy.yml` never ran: it listened for `deployment_status`, and Pages publishes a *check run*, not a GitHub Deployment. The gate went weeks without firing once | Rewritten around `check_run` + `/build.json` to wait for the published commit |
| 15 | The checks read `dist/`, so anything injected after the build — Web Analytics enabled from the dashboard — was invisible | `served.check.ts`, the only one verifying the served response |
| 16 | The smoke treated a 429 from Browser Rendering as a broken PDF. It is the quota, not a failure | The smoke warms the PDF tolerating the 429; `pdf-output.check.ts` tells the two apart in its message |
| 17 | The `<head>` had seven tags: no Open Graph, no Twitter Card, favicon 404, sitemap 404 | `Base.astro` with opt-in `shareable`, `favicon.svg`, `robots.txt.ts`, `@astrojs/sitemap` |
| 18 | No social image existed, so the card had nothing to show | `build-og.ts` + `og.lock.json` + `og-output.check.ts` |
| 24 | GET of an already-invalid dataset returned a bare 500 | Same 422 report PUT already returns, drawn on the page |
| 29 | Top-level collection items could be added but never removed | `remove this item` in the detail header; refused when something still points at the id |
| 30 | Top-level scalars were unreachable; `updatedAt` never refreshed | `header` nav group; stamped on save only when the rest of the dataset changed |
| 32 | After a 409, Save re-enabled on the next keystroke | `stale` latch, cleared only by `load()` |
| 35 | Clearing an optional object left `{}` and blocked the save | `set()` prunes hollow nested objects |
| 36 | A failed fetch at load left the page on "loading…" | `load()` checks both responses and draws the error |

---

## 6. The Function cannot be tested end to end locally

**Severity: low. It is a limitation, not a defect — noted so it is not
rediscovered.**

`pnpm dlx wrangler pages dev dist` serves `/cv.pdf` and is enough to verify
routing, caching and the error paths. What it **cannot** verify is the render:
the Function asks Browser Rendering to print `http://localhost:8788/cv`, and that
URL does not resolve from Cloudflare's cloud.

So the render is only tested by deploying. That is covered today by
`smoke-deploy.yml`, which runs `test:pdf` against every successful deploy —
previews included — so the cycle is "push to `staging` and watch the smoke", not
"push to production and pray".

**Way out, if it ever becomes annoying:** a tunnel (`cloudflared tunnel`)
exposing the local `wrangler pages dev` on a public URL. That is infrastructure
for a problem solved today by waiting a minute for a preview. It does not look
worth it.

---

## 19. The zod adapter's `_def` shape is typed as an open bag

**Severity: low. Found in the final review of the editor handoff PR (`0.15.0`),
deferred on purpose.**

`editor/schema-adapter.ts` is the only file allowed to read zod's internal
`_def`, and it models that value as `interface ZodDef { typeName: string;
[key: string]: unknown }`. The index signature means a typo'd property name —
`def.innterType` — compiles silently and returns `undefined` instead of failing
where it is written.

**How to check it.** Rename any `_def` access in the file to a name zod does not
have and run `pnpm run typecheck`: it passes. `pnpm test` is what catches it.

**Why it was not fixed.** The type is wrapping an API that is deliberately
untyped, and the 22 tests in `schema-adapter.test.ts` cover every branch that
exists — including six that assert against the real `datasetSchema`. The net
holds; it just is not the type system.

**Fix.** A discriminated union of per-`typeName` shapes, so a wrong property is a
compile error and not a test failure. Worth doing when zod 4 forces the file open
anyway.

---

## 20. `datasetDescriptor` is an unchecked cast

**Severity: very low. Same review as §19.**

`editor/schema-adapter.ts` ends with `describe(datasetSchema) as
ObjectDescriptor`. `describe` returns the whole `Descriptor` union, so nothing
statically guarantees the top-level result is an object.

**How to check it.** Read the last lines of the file: the `as` is right there.

**Why it was not fixed.** `datasetSchema` is a hardcoded `z.object(...).strict()`
at the call site, so the cast cannot diverge from reality without someone
rewriting the schema's top level — and several tests read `datasetDescriptor` at
import time, so a wrong shape fails immediately.

**Fix.** A `describeObject()` helper that narrows and throws otherwise, removing
the cast. Ten lines.

---

## 21. One entry of the serializer's inline table is unreachable

**Severity: very low. Same review as §19.**

`editor/serialize.ts` lists `periods` in `INLINE_ELEMENT_ARRAYS`, but the entry
never fires: `periods` only exists on `Skill`, every `Skill` is an element of the
`skills` array, and that array is itself inline — so a skill is printed whole by
`inline()`, which consults no table.

**How to check it.** Put a `throw` inside the `INLINE_ELEMENT_ARRAYS.has(key)`
branch for `periods` and run `pnpm run test:format`: it passes.

**Why it was not fixed.** It is correct-but-dormant, not wrong. Removing it would
have to be undone the day `periods` — or any field like it — is used outside
`Skill`, and the cost of keeping it is one line in a table that is meant to be
read as a decision.

**Fix.** Delete the entry, or leave a comment saying it is currently unreachable.
Decide it when the schema next moves.

---

## 22. The serializer's tests cover the dataset we have, not the schema we allow

**Severity: low. Same review as §19.**

`content.es.json` has no `Achievement.metric`, no non-empty `media`, no
certifications, no services and no testimonials. All five are legal in the
schema, and `serialize.test.ts` therefore exercises none of them — the
`certifications` and `media` entries of the inline table are asserted by no
committed test.

**How to check it.** `grep -c '"metric"' content/data/content.es.json` → 0. The
same holds for the other four collections.

**Why it was not fixed.** It was verified, just not committed: a throwaway probe
built a synthetic dataset carrying all five shapes, confirmed it passes
`validateDataset`, and confirmed it round-trips and is idempotent through
`serializeDataset`, with `media` and `certifications` rendering as one inline
object per line and `metric`, the service description and the testimonial
rendering expanded. So the paths are known to work; what is missing is a test
that keeps them working.

**Fix.** Move that probe into `editor/serialize.test.ts` as a fixture. It is the
natural moment to do it when the metrics gap in
[06](./06-next-session.md) §4 is filled, because the dataset will then carry the
shapes for real.

---

## 23. `SerializationError` has no test

**Severity: low. Found in the final review of `feature/editor-server` (`0.16.0`).**

`DatasetStore.writeExclusive` parses its own serializer's output back and
refuses the save if it does not deep-equal the input — the round-trip guard the
whole file's opening comment leans on. Nothing exercises that path: every test
that reaches `write()` does so with real data, and the real serializer round-trips
it, so `SerializationError` is thrown by no committed test.

**How to check it.** `grep SerializationError editor/store.test.ts` → no matches.

**Why it was not fixed.** Provoking it honestly needs a serializer that lies —
either a modified `editor/serialize.ts` for the duration of one test, or
dependency injection added to `DatasetStore` purely so a test can hand it a
broken one. Neither is a small change to make in passing.

**Fix.** Inject the serializer (or a narrower "round-trip check" function) as an
optional constructor parameter, defaulting to the real one, and have one test
pass a fake that returns text which does not parse back. A few lines on the
class, one test.

---

## 25. `handleApi` cannot be tested against a fake store

**Severity: low. Found in the same review as §23.**

`handleApi`'s `store` parameter is typed as `DatasetStore`, the concrete class —
not an interface. `DatasetStore` has private members (`file`, `readRaw`,
`writeExclusive`), and TypeScript compares classes carrying private members
nominally, not structurally: a plain object implementing `read`/`write` with the
right signatures still fails to typecheck as a `DatasetStore`. The file's own
opening comment says routing is tested "without binding a port", which is true,
but not yet "against any store that throws whatever it likes" — every existing
`api.test.ts` case goes through a real `DatasetStore` over a temp file.

**How to check it.** Try passing `{ read: async () => {...}, write: async () =>
{...} }` where `handleApi` expects its second argument: `tsc` refuses it.

**Why it was not fixed.** No test currently needs it — the temp-file
`DatasetStore` is fast enough that nothing has reached for a fake yet.

**Fix.** Type the parameter as a structural interface (`{ read(): ...; write():
... }`) exported from `store.ts` or `api.ts`. Natural moment: when PR 3 next
touches this file and a test wants a store that throws on demand.

---

## 26. The editor entry point installs no process-level safety net

**Severity: medium. Found in the same review as §23.**

`scripts/editor.ts` handles `EADDRINUSE` on the server's own `error` event, but
nothing in the process listens for `unhandledRejection` or `uncaughtException`.
Commit `5784467` established the stakes: this is the one process holding write
access to the dataset, and an unhandled rejection kills a Node process outright
since v15. `editor/server.ts`'s outer `try/catch` closes that gap for the request
handler today, but it closes it per-handler — every route, present and future,
has to remember to funnel its errors through `send` — rather than structurally,
at the one place that would catch whatever a future handler forgets.

**How to check it.** `grep -n "unhandledRejection\|uncaughtException" scripts/editor.ts` → no matches.

**Why it was not fixed.** Today's only handler (`handleApi`) is already covered
by `server.ts`'s catch, so there is no live gap yet — this is a net for what PR 3
adds, not for what exists now.

**Fix.** A few lines in `scripts/editor.ts`: log and exit non-zero on either
event, rather than letting Node's default handling decide. PR 3 adds a static
file handler, which is exactly the kind of code that forgets a try/catch — do
this before or alongside it.

---

## 27. The write queue's key is a resolved path, and Windows does not case-fold it

**Severity: very low. Found in the re-review of the editor's `0.16.0` fix wave.**

`editor/store.ts` serializes concurrent writes through a module-level
`Map<string, Promise<void>>` keyed by `resolve(this.file)`. That makes two
`DatasetStore` instances over the same file share one queue — which is the
point, and what the comments now truthfully claim. But `resolve()` does not
case-fold on Windows, so two instances built from paths differing only in case
(`C:\...` against `c:\...`) land in different entries and quietly get the
pre-`5f1cdb7` race back: both check the same etag, both pass, the second rename
discards the first, and both callers see success.

**How to check it.** Construct two stores over the same file, one path
upper-cased in its drive letter, and issue overlapping writes. Both fulfil.

**Why it was not fixed.** Every construction site in the repo passes either the
default `DATASET_FILE` constant or a path from `mkdtemp`, so no caller can
currently produce the mismatch. Normalizing case would be wrong on
case-sensitive filesystems, so the fix is a real decision rather than a
one-liner.

**Fix.** Key by `realpath` where the file exists, or normalize case only on
`win32`. Worth doing if the editor ever takes a path from user input.

---

## 28. The write queue's Map never evicts

**Severity: negligible. Same re-review as §27.**

`writeQueues` in `editor/store.ts` holds one entry per resolved path for the
lifetime of the process, with no eviction.

**How to check it.** Read the module scope of `editor/store.ts`: nothing ever
calls `delete`.

**Why it was not fixed.** In practice the process writes one path, so the Map
holds one entry. Eviction would need to know when a queue is idle, which is
more machinery than the leak it prevents.

**Fix.** Delete the entry when a write settles and the tail is still the one it
installed. Only worth it if something ever drives many paths through one
process.

---

## 31. The sidebar label does not follow an edited `id`

**Severity: low. Same review as §29.**

`onAdd` and `onRemove` both call `renderNav()`; `onChange` does not. Editing a
skill's `id` therefore changes the field and the dataset but leaves the sidebar
showing the old label until something else forces a re-render — navigating away
and back. `labelFor` reads `item.id || item.code || item.name`, so the same
staleness hits `name` where there is no `id`.

**How to check it.** Select a skill, change its `id`, look at the sidebar: the
row still carries the previous text.

**Why it was not fixed.** Calling `renderNav()` from `onChange` re-renders the
whole sidebar on every keystroke, and the naive version also fights focus. The
right shape is to redraw the one button whose label changed, which needs the nav
to know which node belongs to which item.

**Fix.** Keep a handle on the button per `collection.index` and update its text
in `onChange` when the edited path ends in `id`/`code`/`name`, rather than
rebuilding the nav.

---

## 33. The editor's test fixtures never clean up their `mkdtemp` directories

**Severity: low. Same review as §29; pre-existing.**

`static.test.ts`, `api.test.ts` and `store.test.ts` each create temp directories
with `mkdtemp` and none of them removes one — `store.test.ts` creates four.
`scripts/editor-page.check.ts` does the same with the dataset copy it edits.
Every run leaves another `editor-*` directory in the system temp folder, holding
a copy of the dataset. Nothing breaks; the litter simply accumulates, and on
Windows nothing sweeps it.

**How to check it.** `grep -rn "rm(\|rmdir" editor/*.test.ts` → no matches. Run
`pnpm test` twice and list `%TEMP%`: one new `editor-*` directory per fixture per
run.

**Why it was not fixed.** It costs nothing per run and the tests are correct as
they are, so it never blocked anything — and a `rm(..., { recursive: true })` in
the wrong `after` hook deletes a directory another still-running test is reading.

**Fix.** A shared `tempDir()` helper that registers the directory and removes it
in one `test.after`, used by the three tests and the smoke.

---

## 34. No test asserts a singular `reference` hint sits on a string

**Severity: low. Same review as §29.**

`hints.test.ts` checks the descriptor KIND under a `textarea` hint (must be a
string) and under a `reference-list` hint (must be an array of strings). The
third widget has no such check: `reference` is only tested for naming a
collection that exists. A `reference` hint moved onto an array — or onto an
object — would pass every test in the file and produce a `<select>` bound to a
value it cannot represent.

**How to check it.** Point `"achievements[].skillIds"` at `{ widget:
"reference", source: "skills" }` and run `pnpm test`: green, and the page draws
a single-value picker over an array field.

**Why it was not fixed.** The gap is symmetrical with two checks that already
exist, so it is four lines — but it is a test, and this branch's commit is a
defect fix; adding coverage to it would blur what the diff says.

**Fix.** The `textarea` test, with `reference` in the filter and `string` as the
expected kind. Four lines in `hints.test.ts`.


---

## 37. The bundle budget measures one landing, by path

**Severity: low today, medium the day `/en/` exists. Found 2026-09-02 while
designing the English version.**

`bundle-budget.check.ts` opens `dist/index.html` and nothing else:

```ts
const HOME = join(DIST, "index.html");
```

Every per-page assertion in the file — the 4 KB ceiling on critical JS, the
30 KB one on the HTML — is therefore about that one path. The home is the only
page shipping JavaScript, so today the check covers everything it should.

The English landing of
[`specs/2026-09-02-en-site-design.md`](./superpowers/specs/2026-09-02-en-site-design.md)
is a second page with the same JS. It would be added to `PAGES_WITH_JS` in
`no-client-js.check.ts` — an explicit line in a diff, which is the point of that
allowlist — and then ship with **no byte budget at all**, silently.

What is already covered, and does not need work: a duplicated 3D chunk. The
`withThree.length === 1` assertion is global over `_astro/`, so if the locale
split made Rollup emit two copies of three, this check fails today, before
anyone thinks to look.

**How to check it.** Add any second page importing `mountGraph`, build, and run
`pnpm run test:bundle`: green, with the new page's critical path unmeasured.

**Why it was not fixed.** The second landing does not exist yet. Writing the
loop now means writing it against an imagined directory layout, and a gate
written blind is how you get one that passes for the wrong reason.

**Fix.** Take the pages to measure from `PAGES_WITH_JS` — the list that already
decides which pages are allowed to ship JS — instead of a constant, and assert
the per-page budgets over each. The two checks then share one definition of
"page with JavaScript", which is what they were both always about.
