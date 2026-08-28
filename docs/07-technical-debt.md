# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**15 of 26 entries are closed.** The open ones keep their original numbers: a
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
| 8 | `/cv.json` and `/llms.txt`, the two surfaces agents consume, had no gate at all. A real `formatRoleTitle` bug had already got through into one of them | `scripts/endpoints.check.ts`, in `content-validation.yml` with the other checks that read `dist/` |
| 9 | The skill grouping lived in two places and had diverged: the CV printed `Lenguajes:` in editorial order, `/llms.txt` printed `- language:` in insertion order | `content/schema/skill-groups.ts`, imported by both |
| 10 | Nothing verified the fonts were embedded. The PDF would look right on a machine with Manrope installed and wrong on every other one | A test in `pdf-output.check.ts` reading the font descriptors, which runs against the published PDF too |
| 11 | `pnpm audit` reported a high through `astro > sharp <0.35.0`, so `audit:deps` failed on every run | An `overrides` entry in `pnpm-workspace.yaml` — pnpm 11 no longer reads `pnpm.overrides` from package.json |
| 12 | Three acceptance criteria lived in an old plan as commands to paste into a terminal | Two were already covered (`no-client-js.check.ts` is stricter than criterion 3's grep; `jsonld.test.ts` covers criterion 4). The third — invariant 1 — is now `scripts/invariants.test.ts` |
| 14 | `smoke-deploy.yml` never ran: it listened for `deployment_status`, and Pages publishes a *check run*, not a GitHub Deployment. The gate went weeks without firing once | Rewritten around `check_run` + `/build.json` to wait for the published commit |
| 15 | The checks read `dist/`, so anything injected after the build — Web Analytics enabled from the dashboard — was invisible | `served.check.ts`, the only one verifying the served response |
| 16 | The smoke treated a 429 from Browser Rendering as a broken PDF. It is the quota, not a failure | The smoke warms the PDF tolerating the 429; `pdf-output.check.ts` tells the two apart in its message |
| 17 | The `<head>` had seven tags: no Open Graph, no Twitter Card, favicon 404, sitemap 404 | `Base.astro` with opt-in `shareable`, `favicon.svg`, `robots.txt.ts`, `@astrojs/sitemap` |
| 18 | No social image existed, so the card had nothing to show | `build-og.ts` + `og.lock.json` + `og-output.check.ts` |

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

## 7. The public API publishes internal fields

**Severity: medium.** It is a contract with third parties, and the repo is now
public.

`/cv.json` serves the `public-api` surface, but `resolveView` only filters
`phone` and `streetAddress`. Everything else passes through whole. Measured on
`dist/cv.json` from the 2026-08-25 build:

```
publishPhoneOn exposed: true
"priority"  keys in the output: 40
"visibility" keys in the output: 40
```

`visibility` and `priority` are **internal editorial decisions**: they say which
achievement you consider first-tier and which third-tier, and on which surfaces
you decided not to show something. A recruiter opening the JSON sees the ranking
you made of your own work. `publishPhoneOn` also describes a privacy policy
nobody outside cares about.

**Why it was not fixed here.** Touching `resolveView` is touching the file rule 8
depends on, and doing that in the middle of a deploy change is asking for it.

**Fix.** In `resolveView`, for the `public-api` surface, map `Achievement` and
`Skill` to a shape without `visibility` or `publishPhoneOn`. It is a projection,
not a filter: the output type would have to be different from the internal
surfaces', and that is where the real work is.

---

## 13. Two things were never looked at by eye

**Severity: not measurable, which is why it is here.**

- **The card ↔ map cross-hover.** It is verified that the DOM ids match the
  `:has()` rules 3/3 and that there are no orphans. That proves the CSS points at
  something, not that it looks right.
- **The pill's inertia.** Simulated before committing — it drags 19.9 px, crosses
  zero 200 ms after stopping, bounces back 3.5 px — and switched off under
  `prefers-reduced-motion`. The numbers are correct; the feel has to be felt.
- **The PDF in a real viewer**, not only passing the ten tests.

Ten minutes with `pnpm run dev` and `pnpm run pdf:local`. It is the only entry on
this list that nobody but the author can close.

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

## 24. A GET of a dataset that is already invalid on disk returns a bare 500

**Severity: medium. Found in the same review as §23.**

`editor/api.ts`'s `GET /api/dataset` branch calls `store.read()` uncaught, so
when `store.read()` throws `InvalidDatasetError` — the dataset on disk fails
`inspectDataset` — the error escapes `handleApi` and the server's outer catch
turns it into a bare `{ message }` 500. `PUT` catches the same error and answers
422 with `{ zodIssues, violations }`; `GET` drops that report on the floor.

**How to check it.** Write an invalid `content.es.json` to a temp file, point a
`DatasetStore` at it, and call `handleApi({ method: "GET", path: "/api/dataset"
}, store)`: the promise rejects instead of resolving to a report.

**Why it was not fixed.** `pnpm run validate` still answers the "what is wrong"
question today, so nothing is actually lost — but PR 3's story is opening the
editor after a bad merge, and that story is exactly this response: today it is a
500 with no report to render.

**Fix.** The same two-arm `catch` `PUT` already has, wrapped around the `GET`
branch's `store.read()`. About four lines.

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
