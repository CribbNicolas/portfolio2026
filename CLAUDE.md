# CLAUDE.md — instructions for future sessions

Operating instructions for you, not documentation for humans. The background
docs already exist in `docs/`: they are linked here, not repeated.

## What this is

The **content** layer of a portfolio + CV for a developer looking for work and
freelance clients in LatAm/Spanish. Guiding principle: **the data is the single
source of truth; the CV, the portfolio and the LinkedIn blocks are derived
VIEWS.** The backend stores atomic facts (`Achievement`, `Skill`, `Role`,
`Metric`), never documents. There is a content layer (schema + validation + JSON
dataset + one `ContentSource` implementation) and a static Astro frontend that is
**one navigable page**: `/` with hero, anchor index, knowledge map, projects and
the full CV. `/cv` still exists but is NOT a destination — it is the source the
PDF is printed from, with `noindex` and no incoming links. Long-form case
studies, services and the freelance side wait for the next slice. Why the schema
is the way it is: `docs/CONTRACT.md` and `docs/01`–`04`. Do not rewrite them;
read them.

**Language.** The site content is in Spanish — it is a CV for a Spanish-speaking
market — and, since 2026-09-02, also in English under `/en/`: see
`docs/10-i18n.md` for the whole bilingual workflow. Identifiers, comments, docs
and commit messages stay in English always. When you touch a user-visible
string it stays in the surface's own language. The URL anchors are addresses,
not code, in EITHER language: `/` uses `#mapa`/`#proyectos`/`#cv`, `/en/` uses
`#map`/`#projects`/`#cv` (`src/lib/anchors.ts`), and the reasoning is the same
one in both — an address in a language the reader does not speak is noise.

## File map

```
content/
  schema/
    content-schema.ts   The types + the contract interfaces (ContentSource, ContentView). The source of types.
    validation.ts       Zod (shape) + checkRules (coherence). Rules 1,2,3,6 + referential integrity + Skill.periods.
    dates.ts            THE source of duration arithmetic. Rule 1. `monthsFromPeriods` merges spans and SUMS them:
                        a gap is not experience, and two parallel jobs are not twice the same years.
    resolve-view.ts     THE source of visibility logic. resolveView(dataset, surface). Rules 7,8. Shared by every backend.
  data/
    content.es.json     The real dataset, canonical. Spanish is edited first, always — docs/10-i18n.md.
    content.en.json     The English CV, translated FROM the Spanish one. Never edited first.
    translation.lock.json  One hash per Spanish string, stamped by `i18n:lock`. What `test:i18n` checks against.
  source/
    json-source.ts      ContentSource over the JSON. Only fetches/caches the dataset and delegates to resolveView.
    index.ts            ⚠️ The ONE line that changes when migrating to Sanity. The whole frontend imports from here.
    content-source.test.ts  Tests of rules 7,8 + locale (what the schema does NOT validate).
scripts/validate.ts     Entry point of `pnpm run validate`.
.github/workflows/      content-validation.yml — typecheck + validate + test + build + pdf:local + test:pdf + the four
                        checks + audit:todos on every push. Uploads dist/cv.pdf as an artifact. Does NOT deploy:
                        Cloudflare Pages handles that.
                        smoke-deploy.yml — runs test:pdf against the PUBLISHED /cv.pdf on every successful Pages
                        deploy (staging previews included). Only fires if the file is on the default branch.
                        It is what sets SITE for served.check.ts.
                        version-gate.yml — PRs into develop only: package.json.version has to rise.
                        flujo-de-ramas.yml — PRs into staging/main only: checks which branch they come from.
                        Only staging enters main; only develop enters staging. Rulesets cannot express this:
                        they look at the target branch, not the source.
functions/              Cloudflare Pages Functions. The ONLY thing in the repo that runs at runtime.
  cv.pdf.ts           GET /cv.pdf. Three-line caller of createPdfHandler("es"); the route is this file's OWN path.
  en/cv.pdf.ts        GET /en/cv.pdf. Same factory, createPdfHandler("en"). No copy-pasted body — see _handler.ts.
  _handler.ts         The shared implementation both routes call: Browser Rendering, caching, error shapes.
                      The underscore keeps it out of Pages routing.
  _pdf.ts             The pure pieces (request body, cache key, headers, sourcePath per locale).
  _pdf.test.ts        Guards that the served PDF asks for the SAME options as the tested PDF.
docs/                   See docs/00-index.md. The "why" of every design decision lives there.
                        08-branches-and-versioning.md — feature/* → develop → staging → main, and the bump rule.
                        READ IT before opening a PR: the one into develop fails if you do not raise the version.
                        07-technical-debt.md — what was found out of scope and not fixed. Look at it BEFORE
                        "fixing something on the way": it may already be noted with its reason.
                        09-seo-and-metadata.md — what the <head> emits, and above all what it deliberately does NOT
                        and under what condition to reconsider. READ IT before "adding the missing tag":
                        og:site_name, hreflang, profile:*, webmanifest and favicon.ico are DECIDED, not forgotten.
editor/                 The local content editor; `pnpm run editor` serves the page and its API over content.es.json. NOTHING here reaches dist/, which is why no check needs an exception.
  descriptors.ts      The zod-free field tree. The seam: the browser never sees zod.
  schema-adapter.ts   THE ONLY file that reads zod's `_def`. Its tests are the gate for a zod bump.
  serialize.ts        THE canonical written form of content.es.json. Key order comes from the schema; what prints
                      inline comes from two explicit tables, NOT from a line width.
  inspect.ts          unknown → { ok, zodIssues, violations }. Calls datasetSchema.safeParse and checkRules:
                      it decides nothing itself.
  store.ts            THE only thing that touches the dataset file. Validates, round-trips its own output,
                      checks the etag, renames a temp file into place.
  api.ts              The routes, as a pure function. No node:http, so every route is tested without a socket.
  server.ts           createEditorServer(store). Does NOT listen: scripts/editor.ts binds the port.
  hints.ts            Per-path widget overrides. Full paths, NOT field names: a convention would change a widget
                      silently on a rename. hints.test.ts fails when a path stops existing.
  static.ts           Serves editor/public. The traversal guard checks where a path LANDS, not what it looks like.
  public/             The page. Plain ES modules, no build step, and the ONLY code here the typecheck never sees —
                      which is why scripts/editor-page.check.ts exists.
src/
  pages/cv.astro      The CV in HTML. THE source of the layout; the PDF comes from here.
                      NOT a navigable destination: `noindex` and zero incoming links.
                      The reader reaches the CV through the landing's `#cv` anchor.
  pages/index.astro   The Spanish landing: hero + index + #mapa + #proyectos + #cv.
  pages/en/index.astro  The English landing. Same shared HomeDocument, locale="en", content.en.json.
                      In PAGES_WITH_JS alongside `/`: it renders the same 3D map.
  pages/en/cv.astro   The English CV in HTML. Same shared CvDocument, locale="en". Zero JS, same as /cv.
  pages/cv.json.ts    public-api endpoint. Spanish only — locale is hardcoded, not read from the request.
  pages/build.json.ts The published commit (CF_PAGES_COMMIT_SHA). One consumer: the smoke, which uses it to wait
                      for Cloudflare to serve the commit just pushed.
  pages/404.astro     Without this, Pages returns 200 with HTML for any route: a soft 404.
  pages/llms.txt.ts   Markdown endpoint for agents. Spanish only, same reason as cv.json.ts.
  components/cv/      Dumb components: they receive resolved props, they filter nothing.
  components/projects/ProjectList.astro  The projects. Each card carries the id `buildHoverCss` expects:
                      the cross-hover with the map works with NO JS.
  components/lab/GraphSvg.astro  The map in SVG. NOT a placeholder: it is the real fallback.
                      The `lab` prefix is the name of the BLOCK (the map), not of a route: `/lab` no longer exists.
  components/Logo.astro  The complete brand: the ring with the N inside. The geometry does NOT live here,
                      it comes from lib/brand.ts. It uses var(--accent)/var(--ink), so dark mode falls out
                      of the tokens with no CSS of its own.
  lib/brand.ts        THE source of the brand geometry. Shared by the header logo and the social card.
                      public/favicon.svg CANNOT import it (it is static): og-output.check.ts verifies they
                      have not diverged.
  lib/jsonld.ts       ContentView → schema.org Person.
  lib/graph-svg.ts    PositionedGraph → draw list. Fog, paint order, labels.
  lib/lab-hover-css.ts  Graph → `:has()` rules. The cross-hover works with NO JS.
  scripts/analytics.ts  Clarity. ONLY index.astro calls it; never Base.astro (/cv at zero JS).
                      The Cloudflare Web Analytics beacon goes in index.astro too, also by hand: enabling it
                      from the Pages dashboard injects it into the WHOLE site and no-client-js.check.ts would
                      not see it (it looks at dist/, not at what is served).
                      Without PUBLIC_CLARITY_ID the import is tree-shaken and costs nothing.
  scripts/lab/        The ONLY thing bundled for the browser. See §Map frontend.
  scripts/lab/pill.ts  Lag of the floating bar while scrolling. Ornament: behind `prefers-reduced-motion`,
                      and the rAF switches itself off when it settles. Reads `scrollY` INSIDE the frame,
                      not in the listener.
  scripts/lab/interaction.ts  Drag, neighbourhood focus, tooltip. Does not import three: the renderer hands it
                      a `project` function. Changing renderer does not touch this file.
  styles/cv.css       One column. No flex/grid/table allowed (it breaks parsing).
  styles/projects.css  The project list. Typographic hierarchy, no cards with shadows.
  styles/tokens.css   `--width` is the width of EVERY section. One value, on purpose.
  styles/lab.css      The map. Both canvases are pointer-events:none. That is what makes the
                      "it does not capture the mouse" promise true.
content/schema/
  format-metric.ts    Rule 4. The "~" of estimates lives here and only here. Takes a Locale.
  format.ts           Durations, MM/AAAA ranges, role titles. Rules 1 and 2. Takes a Locale; output stays
                      in that locale's language, not always Spanish.
  messages.ts         Chrome copy — the words the SITE says, not the author's — as Record<Locale, Messages>.
                      A missing translation is a COMPILE error, so this layer needs no gate of its own.
  pdf-filename.ts     ONE definition of the PDF's name: Cribb_Nicolas_CV_<updatedAt>.pdf, `_EN_` tag for
                      English. <updatedAt> is the DATASET's, not the clock's — see the file's own comment.
  skill-groups.ts     THE order and labels of the skill groups. Shared by the CV and /llms.txt, which
                      used to keep two lists and print two different taxonomies.
  knowledge-graph.ts  ContentView → graph. Includes the derived skill↔skill affinity.
  graph-layout.ts     3D forces + projection. Deterministic, runs ONLY at build time.
scripts/
  og-template.ts      The HTML of the social card. PURE: it receives already resolved texts and binaries.
                      Deliberately not a page in src/pages/ — it would be built and the three checks that walk
                      dist/ would have to learn to ignore it.
  og-data.ts          What the generator and its check share: the texts derived from the dataset and the
                      fingerprint. Separate because build-og.ts is an entry point.
  build-og.ts         Writes public/og.jpg + og.lock.json. `og:local`, outside the build.
  og-output.check.ts  Dimensions, WhatsApp's weight ceiling, that the image has not gone stale, and that the
                      favicon still draws the ring from lib/brand.ts.
  pdf-options.ts      THE definition of the print options. Shared by render-pdf.ts (Playwright, the gate) and
                      functions/cv.pdf.ts (production). Living apart, the tested PDF and the served PDF would
                      diverge silently.
  render-pdf.ts       renderPdf({ url }). Takes a URL, not a component. It NO LONGER produces the deliverable:
                      it produces the dist/cv.pdf the pre-deploy gate runs against.
  build-pdf.ts        Serves dist/ and prints /cv → dist/cv.pdf. Outside `build`: it is `pdf:local`.
  pdf-output.check.ts Verifies the PDF. With PDF_SOURCE=<url> it runs the SAME assertions against the published
                      PDF. Deliberately not a *.test.ts.
  no-client-js.check.ts  Per-page JS policy over all of dist/. Shields /cv.
  bundle-budget.check.ts The home's budget: three off the critical path.
  single-landing.check.ts The landing is the only door: /cv without links or indexing, and the landing's CV
                      section in sync with the PDF. Plus: 404.html exists.
  endpoints.check.ts  /cv.json and /llms.txt, the two surfaces agents consume. That the JSON parses and
                      carries the contract keys, and that the markdown has no empty fields.
  format-data.ts      Writes content.es.json in canonical form. The fix path the gate points at. `format:data`.
  i18n-fields.ts      The shared walker: `translatableFields(dataset)` → path → Spanish string, `hashOf(s)`.
                      Path is built from ids, never array indices, so reordering achievements does not
                      invalidate every translation. `NOT_TEXT` is a DENYLIST of key names — a new prose
                      field is tracked the day it is added, which is the safe direction to be wrong in.
  i18n-lock.ts        Writes `content/data/translation.lock.json`: hash of every Spanish string an English
                      translation was checked against. `i18n:lock`. Same shape as `og.lock.json`: a
                      committed artifact, a check that recomputes, a regenerate command the failure names.
  i18n.check.ts       Three failures, three different fixes: structure drift (a tracked path in one dataset
                      and not the other), missing translation (English still byte-identical to Spanish AND
                      over 40 chars), stale translation (Spanish hash no longer matches the lock). Not a
                      *.test.ts: `pnpm test`'s glob would run it against whatever the datasets happen to be
                      at that point instead of at the deliberate moment `test:i18n` runs it, same reason as
                      `data-format.check.ts`.
  editor.ts           Entry point of `pnpm run editor`. Loopback only: this process writes to the dataset.
  editor-page.check.ts  The page in a real browser: loads, renders from the schema, saves. Needs Chromium.
  data-format.check.ts  THE canonical written form of the dataset is committed as such. Not a *.test.ts: it reads a committed artifact.
  served.check.ts     The ONLY thing verifying the SERVED response and not dist/. Runs from the smoke. Catches
                      what happens after the build: injections at the edge.
  audit-todos.ts      Non-blocking report of published TODOs.
  version.ts          Version comparison. Pure, no I/O. Accepts ONLY x.y.z.
  version.test.ts     Tests of the above. Runs in `pnpm test`.
  invariants.test.ts  Invariants 1 and 3 over the SOURCES of src/: nothing filters by visibility and
                      nothing computes a duration by hand. A *.test.ts because it needs no build.
  version-bump.check.ts  The bump gate. Reads git, which is why it is not a *.test.ts.
  workflows.check.ts  The CI .yml files parse. It exists because an embedded CR left smoke-deploy.yml invalid
                      for three commits without anyone noticing.
```

**Do not touch without thinking:**
- `content/source/index.ts` — it is the migration seam. Changing the import
  changes the backend of the whole project.
- `content/schema/resolve-view.ts` — any visibility `.filter` appearing anywhere
  else is a bug. All that logic goes here.
- `content/data/content.es.json` — do not invent data to fill it (see invariant 4).

## Commands

**The package manager is pnpm** (`packageManager: pnpm@11.1.3`). Do not use
`npm`: `pnpm-workspace.yaml` declares which packages may run install scripts
(`allowBuilds`), and that is the real reason for the switch — with npm any of the
450 packages in the tree executes arbitrary code on install.

```bash
pnpm run typecheck   # astro sync && tsc --noEmit && astro check
pnpm run validate    # tsx scripts/validate.ts — Zod + hard rules
pnpm test            # tsx --test — rules 7,8, locale and the graph
pnpm run dev         # astro dev
pnpm run editor      # local dataset editor on 127.0.0.1:4322. Page + API; test:editor is its only gate
pnpm run build       # ONLY astro build. No Chromium: that is why it runs on Cloudflare Pages
pnpm run pdf:local   # prints dist/cv.pdf with Playwright. Pre-deploy gate, not the deliverable
pnpm run og:local    # writes public/og.jpg (the social card) + og.lock.json. It gets COMMITTED
pnpm run test:pdf    # verifies the PDF (needs a prior pdf:local, or PDF_SOURCE=<url>)
pnpm run test:js     # per-page JS policy over all of dist/ (needs a build)
pnpm run test:bundle # byte budget of the home's map (needs a build)
pnpm run test:landing # /cv isolated + CV section in sync with the PDF (needs a build)
pnpm run test:endpoints # /cv.json parses and /llms.txt is whole (needs a build)
pnpm run test:format # the committed dataset is in canonical form (no build needed)
pnpm run test:i18n   # EN is a current translation of ES: structure, no untranslated copies, no stale hash
pnpm run test:editor # the editor page end to end in Chromium (needs no build)
pnpm run format:data # rewrites content.es.json in canonical form. The fix for the above
pnpm run i18n:lock   # re-stamps translation.lock.json to the current ES text. The fix test:i18n points at
pnpm run test:og     # the social card has not gone stale + the favicon parses (needs a build)
pnpm run test:served # verifies the PUBLISHED site. Needs SITE=https://…  (not dist/)
pnpm run test:version # the PR raises package.json.version. Needs: git fetch origin develop
pnpm run test:workflows # the CI .yml files parse and declare jobs. Runs FIRST in CI
pnpm run audit:todos # lists published TODOs. Not blocking
pnpm run audit:deps  # pnpm audit --audit-level high
```

**Run the full sequence before calling anything done:**
`pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run test:i18n && pnpm run test:editor && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos`.
If `validate` fails, the message says which rule was violated and how to fix it;
read it, do not skip it. All of that runs in CI on every push
(`.github/workflows/content-validation.yml`) — `audit:todos` included, but as the
last step and without blocking: it is a report, not a gate.

**If you change `og-template.ts`, `src/lib/brand.ts`, the photo or the dataset,
run `pnpm run og:local` and commit the artifacts.** The fingerprint in
`og.lock.json` covers all four, and `test:og` fails otherwise. That is the gate
working, not a false positive.

## Invariants (non-negotiable)

1. **The frontend NEVER filters by `visibility` and never computes durations.**
   All of that lives in `resolveView` (`getView` calls it). A
   `.filter(v => v.priority...)` or a month calculation in a component is wrong.
2. **Everything imports from `content/source/index.ts`, never from
   `json-source`.** That is the line that changes when migrating to Sanity.
3. **No duration or seniority is ever written by hand.** It is derived from
   `careerStart`/`start`/`end` via `dates.ts`. Rule 1 of the validator catches it.
4. **Never invent metrics, numbers, dates or achievements to fill the dataset.**
   A missing datum goes in as an explicit `TODO` in the `Prose`. An invented
   number collapses in the interview and is worse than having no number.
5. **`Metric.confidence` distinguishes `measured` from `estimated`; estimates
   render with "~" or "aprox."** Do not break that distinction (rule 4).
6. **`Prose.short` and `Prose.long` are NOT truncation.** They are two different
   registers of writing: one telegraphic and dense in keywords, the other
   explaining. If a `truncate()` / `.slice()` appears that generates `short` from
   `long`, the intent has been broken. Writing both by hand is intentional.
7. **The rules in `docs/CONTRACT.md` are CI tests, not suggestions.** If
   something new violates them, the data gets fixed, not the rule.
8. **The copy follows the voice rules of `docs/02-branding.md`,** including the
   list of banned words (`apasionado`, `proactivo`, `escalable` with no scale,
   `buenas prácticas` without saying which). Test: "could someone else with my
   stack have written this exact sentence?" If yes, the sentence does nothing.

## Where each hard rule is enforced

The 8 rules of `docs/CONTRACT.md` are NOT all validated in the same place. Before
assuming `validate` covers something, look at this table:

| Rule | What | Where it is enforced |
|---|---|---|
| 1 | No hand-written duration | `validation.ts` → `checkRules` + `collectProse` (walks ALL `Prose`, short and long). **CI** |
| 2 | No two overlapping full-time roles without `concurrent` | `validation.ts` → `checkRules` (`overlaps`). **CI** |
| 3 | A `core` skill needs evidence | `validation.ts` → `checkRules`. **CI** |
| 4 | `estimated` renders with "~" | `content/schema/format-metric.ts` → `formatMetric`. The only place. **`pnpm test`** (runs in CI) |
| 5 | Every `Media` with `alt` | `validation.ts` → Zod (`media.alt.min(1)`). **CI** |
| 6 | `approved: false` is not rendered | Both: `resolveView` filters by `t.approved`; `checkRules` also warns about an unapproved one with no exclusion. **CI + runtime** |
| 7 | `cv-short` cuts by `priority` | `resolve-view.ts` (`PRIORITY_CUTOFF`, `MAX_ACHIEVEMENTS_PER_ROLE`). **`pnpm test`**, not `validate`. |
| 8 | `streetAddress`/`phone` only on listed surfaces | `resolve-view.ts` (identity filtering). **`pnpm test`**, not `validate`. |
| — | Referential integrity (`roleId`/`projectId`/`skillId`) | `checkRules` (rule 0). **CI** |
| — | `Skill.periods` coherence (`end` after `start`, no overlap) | `checkRules` (rule 0). **CI** |
| — | Invariants 1 and 3 in the frontend code | `scripts/invariants.test.ts`. **`pnpm test`** |

## Map frontend (the only thing with JavaScript)

**The two landings (`/` and `/en/`) are the ONLY pages shipping JS.** `/cv` and
`/en/cv` stay at zero and that is NOT negotiable: the PDF is rendered from there
waiting on `networkidle`, so a script slipping in changes the PDF silently.
**Since 2026-08-25 that went from breaking your build to breaking production:**
the PDF is printed by `functions/_handler.ts` (via `functions/cv.pdf.ts` and
`functions/en/cv.pdf.ts`) over the PUBLISHED page, not over your `dist/`.
`PAGES_WITH_JS` in `no-client-js.check.ts` is the allowlist — adding a page is
an explicit decision in a diff, not an accident.

Rules, all verified in CI by `bundle-budget.check.ts` and
`no-client-js.check.ts`:

1. **Nothing under `src/scripts/` imports from `@content`.** `json-source.ts`
   statically imports zod and the whole dataset: one import sends them to the
   browser. Types cross only through `src/scripts/lab/types.ts`, which imports
   nothing at runtime. Precedent and comment: `src/lib/jsonld.ts`.
2. **`three` has ONE importer — `graph-3d.ts` — and it is loaded with a dynamic
   `import()`.** One static import in any module is enough for Rollup to put
   three (127 KB gzip) in the initial bundle with nobody noticing. The check
   looks for `WebGLRenderer` in the critical chunks.
3. **`three/examples/jsm/*` and `three/addons` are forbidden.** `OrbitControls`
   registers `wheel` with `preventDefault`: that is scroll hijacking, which spec
   §3.4 forbids. It is rejected on behaviour, not on weight.
4. **The canvases are always `pointer-events: none`. What listens is the
   CONTAINER** (`.lab__map`, which is also `tabindex=0`). That separation is what
   allows clicking nodes without the map keeping the events that are not its own.
   The hit test is by projection to NDC, not with `Raycaster`: the projection has
   to be computed anyway to place the labels.
5. **No `wheel` and no `touchmove` listener** (a test verifies this over the
   emitted chunks). Scrolling is arbitrated by the browser via
   `touch-action: pan-y`: vertical scrolls, horizontal rotates. That is the
   difference from scroll hijacking — the browser arbitrates, not us. The ONLY
   `preventDefault` calls in `src/scripts/` are on the keyboard (arrows over an
   already focused map, Space over a list item), never on the pointer.
6. **Zero hex in JS.** Colors come from `getComputedStyle` over the tokens, so
   dark mode works with no theme JS.
7. **The SVG is never removed from the DOM.** The 3D is layered on top and the
   SVG goes to `opacity: 0`. Reverting — lost WebGL context, frames over budget —
   is dropping a class.

**Whether the device can take it is decided in four steps** (`capability.ts`),
and only the third one measures: `prefers-reduced-motion`/`saveData`/
`effectiveType`/`deviceMemory`/WebGL2 before downloading a byte; the context on
mount; **the median of the first 30 frames against a 20 ms ceiling**; and live
degradation (first `dpr → 1`, then off). The third is the one that matters: on
iOS `saveData`, `effectiveType` and `deviceMemory` do not exist — they are
Chromium APIs — so leaning on step 1 is deciding blind on half the phones.

## Conventions (deduced from the code, not from preferences)

- **Comments explain the WHY, not the what.** Section banners `// ---`. JSDoc
  `/** */` on public types and functions; when a field or function enforces a
  rule, it is named by number: `// Rule 8: ...`.
- **Typing:** `interface` for data shapes, `type` for unions and aliases
  (`Surface`, `SkillCategory`). Dates are ALWAYS `YearMonth` =
  `` `${number}-${number}` ``, the string `"YYYY-MM"`, never `Date` in the data.
  Every type is exported from `content-schema.ts`.
- **Zod mirrors the interfaces 1:1:** one lowercase `const` per `interface`
  (`role` ↔ `Role`), same fields, same order, and **all with `.strict()`** — an
  undeclared key throws instead of being dropped silently. If you add a field to
  an interface, add it to the Zod schema in the same commit (otherwise data
  carrying that field blows up in `validate`/`test`, which is the point).
- **Naming:** `id` in kebab/lowercase (`"mapbox-gl"`), `camelCase` functions,
  `PascalCase` types, `UPPER_SNAKE` config constants (`PRIORITY_CUTOFF`).
- **Pure functions in `schema/`; I/O only in `source/` implementations.**
  `resolveView` and `checkRules` have no side effects.
- **ESM** (`"type": "module"`), imports without extensions, `import type` for
  types.
- **Missing data goes in as `TODO — ...` inside the `Prose`**, not as an empty
  field and not as an invented number. `Prose.short` is capped at **180
  characters** (Zod validates it): if the text does not fit, it is not for
  `short`, it goes in `long`.

## Pending / what NOT to do yet

**Start with `docs/06-next-session.md`:** it is the three-phase work plan, with
how to proceed on each task and what to verify. The rule that orders everything:
**whatever touches how the data is CREATED waits for the phase 2 editor**; fixing
it earlier guarantees it gets redone.

Before "fixing something on the way", look at `docs/07-technical-debt.md`: it may
already be noted with its reason and with the phase it belongs to. Full status in
`docs/00-index.md`. Operational summary:

- **Frontend:** it exists (static Astro, see `src/` in the file map), bilingual
  since 2026-09-02: `/cv` and `/en/cv` over `cv-ats`, `/` and `/en/` over
  `portfolio`. The designed CV (CV-A) and the case studies wait. `components/cv/`
  are dumb: they receive resolved props and filter nothing (invariant 1).
- **Output generators** (CV PDF, `/cv` HTML, JSON-LD `Person`, `/llms.txt`,
  `/cv.json`): they exist. Rule 4 lives in a single `formatMetric()`. Detail of
  what each one emits: `docs/CONTRACT.md` §2 and `docs/04`.
- **Metrics:** two loaded on the RPPL map (`dinkum-mapbox`, `dinkum-mapbox-index`).
  The rest of the gap is still open — candidates in `docs/03-cv.md`. An honest
  range with `confidence: "estimated"` works; an invented number does not.
- **Data confirmed 2026-08-31:** Hogarth `full-time` + `concurrent` (2023-07 →
  2024-01), English **A2**. `careerStart` remains 2020-04. Single source:
  `docs/00-index.md`.
- **`services` and `testimonials` are empty on purpose** — they are in the schema
  so there is nothing to migrate later. Do not fill them with placeholders.
- **Bilingual workflow: Spanish is edited first, always.** English follows
  through the loop in `docs/10-i18n.md` — `test:i18n`, translate, `i18n:lock`.
  `/llms.txt`, `/cv.json` and the OG social card stay Spanish-only, on purpose;
  the doc says why and when to reconsider each.
- **Backend: NOT for now.** Evaluated 2026-08-25 (`docs/06`). Keystatic
  discarded — it demands an SSR adapter plus React and Markdoc; Sanity viable but
  postponed, because with the data outside git the content stops passing through
  the gates. In its place goes `pnpm run editor`, a local editor. Adopting Sanity
  later still costs the same: `sanity-source.ts` and one line in `index.ts`.
- **Ceilings at the limit:** the PDF is at 2 of 2 pages and the 3D chunk at 87%.
  Adding content to the CV means removing something else. Full table in the
  `README`.
