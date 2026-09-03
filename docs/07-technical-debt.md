# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**38 of 42 entries are closed.** The open ones keep their original numbers: a
renumbered list breaks every reference from a commit message or another doc.
The remaining four are waves 3–4 in
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
| 20 | `datasetDescriptor` was an unchecked `as ObjectDescriptor` | `describeObject()` narrows and throws |
| 21 | `periods` in the serializer's inline table never fired | Comment: unreachable while `skills` is itself inline; kept as a decision |
| 23 | `SerializationError` had no test | Serializer injected on `DatasetStore`; one test hands it a liar |
| 24 | GET of an already-invalid dataset returned a bare 500 | Same 422 report PUT already returns, drawn on the page |
| 25 | `handleApi` could not be tested against a fake store | `DatasetApi` structural interface |
| 26 | `scripts/editor.ts` installed no process-level safety net | `unhandledRejection` / `uncaughtException` log and exit non-zero |
| 27 | The write queue's key did not case-fold on Windows | `queueKey` lowercases on `win32` |
| 28 | The write queue's Map never evicts | Accepted 2026-09-03. The process writes one path; eviction is more machinery than the leak |
| 29 | Top-level collection items could be added but never removed | `remove this item` in the detail header; refused when something still points at the id |
| 30 | Top-level scalars were unreachable; `updatedAt` never refreshed | `header` nav group; stamped on save only when the rest of the dataset changed |
| 31 | The sidebar label did not follow an edited `id` | `navButtons` map; `onChange` retitles the one row |
| 32 | After a 409, Save re-enabled on the next keystroke | `stale` latch, cleared only by `load()` |
| 33 | Editor test fixtures never cleaned up their `mkdtemp` directories | `createTempDirs()` per file, `after` cleanup |
| 34 | No test asserted a singular `reference` hint sits on a string | Four lines in `hints.test.ts` |
| 35 | Clearing an optional object left `{}` and blocked the save | `set()` prunes hollow nested objects |
| 36 | A failed fetch at load left the page on "loading…" | `load()` checks both responses and draws the error |
| 37 | The bundle budget measured `dist/index.html` by path, so `/en/` shipped with no byte ceiling, and the `WebGLRenderer` scan followed the same hard-coded `<script src>` — silently blind after Rollup started sharing the boot chunk between two entries | `bundle-budget.check.ts` now takes its pages from `PAGES_WITH_JS` (`scripts/pages-with-js.ts`, shared with `no-client-js.check.ts`) and follows static `import` specifiers transitively from each page's entry chunk, so the byte budget and the `three` scan both see the real payload, not the wrapper |
| 40 | Locale → URL encoded four times, two of them ternaries that fail silent with a third language | `LOCALE_PATHS` next to `ANCHORS`; switch, hreflang, PDF buttons and `sourcePath` all read it |
| 41 | English anchors' scroll offset lived in a page-scoped style, so renaming `ANCHORS.en.map` dropped it | `anchorScrollCss()` emitted from `ANCHORS`; `single-landing.check.ts` asserts both landings carry it |
| 42 | `messages.test.ts` only caught pasted Spanish if it had an accent | Allowlist of keys that may be identical; every other key must differ |

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
