# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**42 of 42 entries are closed.** The original numbers stay: a renumbered list
breaks every reference from a commit message or another doc. What remains of
the campaign is Wave 4 — bilingual leftovers in
[00-index](./00-index.md), not code debt — see
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
| 19 | The zod adapter's `_def` was typed as an open bag | Discriminated union of per-`typeName` shapes; a typo'd property is a compile error |
| 20 | `datasetDescriptor` was an unchecked `as ObjectDescriptor` | `describeObject()` narrows and throws |
| 21 | `periods` in the serializer's inline table never fired | Comment: unreachable while `skills` is itself inline; kept as a decision |
| 22 | Serializer tests covered the dataset we have, not the schema we allow | Synthetic fixture in `serialize.test.ts` for media, certifications, services, testimonials |
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
| 38 | Four schema types had no `id`, so reordering them looked like a stale translation | `id` on `Link`/`Media`/`TechnicalDecision`; `arrayKey` falls back to `code` for languages |
| 39 | `Service.name` fell into the `NOT_TEXT` denylist | `isServiceName` override + synthetic test; datasets stay empty |
| 40 | Locale → URL encoded four times, two of them ternaries that fail silent with a third language | `LOCALE_PATHS` next to `ANCHORS`; switch, hreflang, PDF buttons and `sourcePath` all read it |
| 41 | English anchors' scroll offset lived in a page-scoped style, so renaming `ANCHORS.en.map` dropped it | `anchorScrollCss()` emitted from `ANCHORS`; `single-landing.check.ts` asserts both landings carry it |
| 42 | `messages.test.ts` only caught pasted Spanish if it had an accent | Allowlist of keys that may be identical; every other key must differ |

