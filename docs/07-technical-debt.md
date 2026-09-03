# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**26 of 42 entries are closed.** The open ones keep their original numbers: a
renumbered list breaks every reference from a commit message or another doc.
The remaining sixteen are the four waves in
[2026-09-03-close-technical-debt](./superpowers/plans/2026-09-03-close-technical-debt.md).

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
| 6 | The Function cannot be tested end to end locally: Browser Rendering cannot print `localhost` | Accepted 2026-09-03. The smoke already prints the published PDF; a tunnel is infra for a one-minute preview |
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
| 28 | The write queue's Map never evicts | Accepted 2026-09-03. The process writes one path; eviction is more machinery than the leak |
| 29 | Top-level collection items could be added but never removed | `remove this item` in the detail header; refused when something still points at the id |
| 30 | Top-level scalars were unreachable; `updatedAt` never refreshed | `header` nav group; stamped on save only when the rest of the dataset changed |
| 32 | After a 409, Save re-enabled on the next keystroke | `stale` latch, cleared only by `load()` |
| 35 | Clearing an optional object left `{}` and blocked the save | `set()` prunes hollow nested objects |
| 36 | A failed fetch at load left the page on "loading…" | `load()` checks both responses and draws the error |
| 37 | The bundle budget measured `dist/index.html` by path, so `/en/` shipped with no byte ceiling, and the `WebGLRenderer` scan followed the same hard-coded `<script src>` — silently blind after Rollup started sharing the boot chunk between two entries | `bundle-budget.check.ts` now takes its pages from `PAGES_WITH_JS` (`scripts/pages-with-js.ts`, shared with `no-client-js.check.ts`) and follows static `import` specifiers transitively from each page's entry chunk, so the byte budget and the `three` scan both see the real payload, not the wrapper |

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

## 38. Four schema types carry no `id`, so reordering them reads as a translation gone stale

**Severity: low. Found 2026-09-02 while building the translation lock.**

`scripts/i18n-fields.ts` keys each array item's path by its own `id` precisely
so reordering an array does not invalidate every translation under it — moving
an achievement does not make its `text.short` look like it changed. Four types
in `content-schema.ts` have no `id` field at all: `TechnicalDecision`, `Link`,
`LanguageSkill`, `Media`. For every array of these, the walker falls back to
the array index, so reordering the array — not editing a single word in it —
makes `pnpm run test:i18n` report every item after the moved one as stale, for
text that never changed.

**How to check it.** Swap the order of the two entries in `identity.links`
(`GitHub` before `LinkedIn` today) and run `pnpm run test:i18n`: it reports the
`label` and `url` paths as stale, even though neither string moved — only its
position did.

**Why it was not fixed.** `identity.links` has two entries and does not get
reordered in the ordinary course of editing the CV; `TechnicalDecision` and
`Media` are not populated in either dataset yet (see entry 22); `languages` has
two entries in a fixed, meaningful order (Spanish first). The false positive is
real but currently unreachable in practice, and the fix touches
`content-schema.ts` and its Zod mirror — a schema change, not a scoped fix to
`i18n-fields.ts` alone.

**Fix.** Add `id` to the four interfaces (and their Zod schemas in the same
commit, per this repo's convention) the day any of their arrays grows past a
size where reordering is realistic — `TechnicalDecision` the moment case
studies start populating it.

---

## 39. `Service.name` has no path override waiting for it in the translation walker

**Severity: low. Found 2026-09-02, same review as #38.**

`i18n-fields.ts`'s `NOT_TEXT` denylist excludes the key `name` everywhere
except two path-specific overrides: `projects.*.name` (a title) and
`languages.*.name` (a word in the language it names). `services` is empty in
both datasets today — see [`00-index.md`](./00-index.md) — so nothing is lost
yet. But `Service.name` is a title exactly like `Project.name`
("Desarrollo de un panel a medida", not "Panel"), not a proper noun like
`Skill.name`. When `services` gets filled in, its `name` field will silently
fall into the excluded set: `test:i18n` will not flag it as missing, `i18n:lock`
will not stamp it, and the field will simply never be checked for a translation
— no error, no warning, just an English CV missing text nobody was told to look
for.

**How to check it.** Add one entry to `services` in `content.es.json` with a
`name`, run `pnpm run test:i18n`: it passes, even with `services` absent
entirely from `content.en.json`, because `services` itself is not `projects` or
`languages` and the path never reaches `translatableFields`'s walker as
tracked text.

**Why it was not fixed.** `services` is intentionally empty — filling it with a
placeholder just to add the override would be inventing data to test a check,
which is exactly what invariant 4 forbids. The override is one line
(`isServiceName`, mirroring `isProjectName`) but it is untestable against real
data until there is real data.

**Fix.** The day the first `Service` is written: add
`const isServiceName = key === "name" && /^services\.[^.]+$/.test(path);` next
to the existing two, and confirm `test:i18n` demands a translation for it.

---

## 40. Locale → URL is encoded four times, in two styles with opposite failure modes

**Severity: low today, medium the day a third language exists. Found in the
whole-branch review of the bilingual slice (`0.20.0`).**

The same mapping is written four times: `PDF_HREF` in `HomeDocument.astro`,
`other === "es" ? "/" : "/en/"` in `LocaleSwitch.astro`, `ALTERNATE_LOCALES` in
`Base.astro`, and `sourcePath` in `functions/_pdf.ts`.

Two of those are `Record<Locale, …>` tables and two are ternaries, and **that is
the real problem, not the repetition**: adding `pt` makes the tables a compile
error and makes the ternaries silently return the English answer.

**How to check it.** Add `"pt"` to `Locale` in `content-schema.ts` and run
`pnpm run typecheck`. The tables complain; `LocaleSwitch.astro` and
`functions/_pdf.ts` compile and are wrong.

**Fix.** One `LOCALE_PATHS: Record<Locale, { home: string; cv: string; pdf: string }>`
beside `ANCHORS` in `src/lib/anchors.ts`, and delete the other three.

---

## 41. The English anchors' scroll offset lives in a page, not in the stylesheet

**Severity: low. Same review.**

`src/styles/home.css` hard-codes `#mapa`/`#proyectos` for `scroll-margin-top`,
and `src/pages/en/index.astro` compensates with a page-scoped `:global(#map),
:global(#projects)` block. That was correct while the slice had to prove the
Spanish output was byte-identical; the constraint expired at merge.

It leaves the anchor names in a third place `single-landing.check.ts` does not
read. Renaming `ANCHORS.en.map` passes every gate and silently drops the offset,
so every anchor jump on `/en/` lands with the heading hidden under the floating
pill — a bug that only shows after a click, which is why nothing caught it.

**How to check it.** Rename `ANCHORS.en.map` to anything and run the full gate:
green. Then click the index link on `/en/`.

**Fix.** Both id sets in `home.css`, delete the page-scoped block. Better: emit
the rule from `ANCHORS`, the way `lab-hover-css.ts` already emits CSS from data.

---

## 42. `messages.test.ts` catches an untranslated string only if it has an accent

**Severity: low. Same review.**

The guard against pasting a Spanish string into `MESSAGES.en` is a regex for
`[áéíóúñ¿¡]`. It catches the realistic case and false-positives on nothing, but
a Spanish string with no diacritics — `"Proyectos"`, `"Contacto"`, `"Stack"` —
slips through silently.

The dataset has a real answer for this (`UNTRANSLATED_MIN_LENGTH` in
`i18n.check.ts`: identical AND over 40 characters); the chrome copy does not,
because most chrome strings are short enough that identical is often legitimate.

**Fix.** Not obvious, which is why it is here rather than done: either a list of
keys allowed to be identical (maintenance every time one is added), or accept
the gap and rely on the accent test plus review. Revisit if a bare-ASCII Spanish
string ever reaches production.
