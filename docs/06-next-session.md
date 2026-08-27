# 06 — Work plan

Rewritten 2026-08-26, after finishing phase 1 and the English migration.

**The infrastructure is closed.** Public site at
`https://cribbnicolas.pages.dev`, PDF on demand, analytics measuring, social
metadata published, and the `feature/*` → `develop` → `staging` → `main` flow
enforced by rulesets and by two workflows of our own. Detail in
[`05`](./05-deploy-and-analytics.md) and
[`08`](./08-branches-and-versioning.md).

---

## 0. The order, and why

Three phases. **The order matters and is not arbitrary.**

| Phase | What | Why here |
|---|---|---|
| **1** | Social metadata + the technical debt that does not touch data creation | What moves the needle most per hour. Sharing the link used to give a bare URL. **Done** |
| **2** | `pnpm run editor` | It needs the schema to be still. Touched earlier, it gets done twice |
| **3** | The debt that does touch data creation, and whatever is left | Resolved with the editor in sight, not before |

**The rule separating phase 1 from phase 3:** anything to do with **how the CV
data is created or modelled** waits for the editor. Fixing it earlier guarantees
it gets touched again.

---

## 1. Phase 1 — done, with a residue

Social metadata ([`07`](./07-technical-debt.md) §17 and §18), the 404, robots,
the sitemap, the favicon and `served.check.ts` are all closed. So is the English
migration of the whole repo, decided and executed on 2026-08-26.

The cosmetic entries (`§2`, `§3`, `§4`) and the two "read and decide" ones
(`§5`, `§12`) are closed. Typecheck went from 7 hints to 0, and criterion 5 of
the old plan — invariant 1 — became `scripts/invariants.test.ts` instead of a
grep to paste into a terminal.

What is left is three entries, none of them blocking:

| # | What to do | How to verify |
|---|---|---|
| §8 | `endpoints.check.ts`: that `/cv.json` parses and carries the contract's keys, and that `/llms.txt` has no empty fields and no split role titles | Add it to `content-validation.yml` with the other checks that read `dist/` |
| §9 | Move `GRUPOS` from `SkillList.astro` to `content/schema/` and have `llms.txt.ts` import from there | The CV and `/llms.txt` say the same labels in the same order |
| §10 | A test for embedded fonts in `pdf-output.check.ts` using the `pdfjs` API | It runs against both paths on its own, because that file already accepts `PDF_SOURCE` |
| §11 | `pnpm.overrides` to force `sharp >= 0.35.0` and see whether the tree takes it | `pnpm run audit:deps` green, and the build still passes |

**How to work the residue.** One branch per topic. Every PR raises the version
(see [`08`](./08-branches-and-versioning.md)).

**And one item nobody but the author can close** ([`07`](./07-technical-debt.md)
§13): look at the cross-hover, the pill's inertia and the PDF in a real viewer.
Ten minutes with `pnpm run dev` and `pnpm run pdf:local`.

---

## 2. Phase 2 — `pnpm run editor`

A local dataset editor, so `content.es.json` stops being edited by hand. Decided
2026-08-25 after evaluating Sanity and Keystatic (§4).

### The agreed shape

```bash
pnpm run editor     # opens localhost:4322, you edit, it saves content.es.json
pnpm run validate   # Zod + the 8 rules
commit → PR         # the usual gates
```

**Outside `src/pages/`, and that is the central decision.** A route inside the
site would bring three problems this repo has already paid to avoid:

1. Writing a file needs `POST`, and with `output: "static"` the endpoints are
   prerendered and GET-only. Enabling POST means an SSR adapter — the same thing
   that got Keystatic discarded.
2. A page in `src/pages/` gets built. "It only works locally" would come to
   depend on an `import.meta.env.DEV` guard, i.e. on nobody breaking it.
3. `no-client-js`, `bundle-budget` and `single-landing` walk all of `dist/`. An
   editor with forms would force them to have exceptions, and an exception inside
   a check is a permanent crack.

Precedent: `scripts/build-pdf.ts` already starts a 30-line server, with the
comment *"adding a dependency for this would be more maintenance surface than the
problem it solves"*.

### Scope, decided 2026-08-26

**The whole dataset**, not only the 90% that gets edited often: achievements,
metrics, prose, but also visibility, priorities, skillIds, roles, projects,
education and languages.

**The form is derived from the Zod schema**, generically. Adding a field to the
schema makes it appear in the editor with no extra work. With full-dataset scope
it is the only option that does not drift: hand-writing forms for ~20 interfaces
guarantees that in three months the editor and the schema disagree.

**The catch to isolate:** introspection in zod 3 goes through `_def`, which is
internal API. It belongs in one module with tests of its own, so a zod bump fails
there and not silently across the whole editor.

### How to proceed

- **Always write through `validate`.** The editor must not be able to save a
  dataset `checkRules` would reject; the error should show in the form and not
  three commands later.
- **Do not duplicate rules.** All validation comes from `content/schema/`. A rule
  reimplemented in the editor is a rule that will diverge.
- **Preserve the JSON formatting.** Rewriting it whole with `JSON.stringify`
  produces a huge diff on every edit and makes the history unreadable, which is
  half the reason the data is still in git.
- **The editor needs no UI tests**, but the layer that reads and writes does: it
  is where a datum gets lost.

### What the editor does NOT solve

Editing from a phone. Deliberately discarded — §4.

---

## 3. Phase 3 — closing

- **[`07`](./07-technical-debt.md) §7** — `/cv.json` publishes `publishPhoneOn`
  and 40 `visibility` + 40 `priority`. It is a new projection for the
  `public-api` surface, not a filter: the output type has to differ from the
  internal surfaces'. **With the editor done**, because by then it will be clear
  which fields are really internal.
- **[`07`](./07-technical-debt.md) §6** — the Function is not tested end to end
  locally. Decide whether it is worth a tunnel or accept it and close the entry.
- Whatever turned up along the way.

---

## 4. Data — the gap only the author can fill

None of this can be done without you (invariant 4: data is not invented). **It is
exactly the work the phase 2 editor exists to make bearable**, so it is worth
attacking with the tool built.

### Metrics: zero across the dataset

`grep -c '"metric"' content/data/content.es.json` → **0**. Candidates in
[`03-cv.md`](./03-cv.md):

| Achievement | What to measure |
|---|---|
| `dinkum-vite` | Build time before/after |
| `dinkum-mapbox` | Data or user volume of the map |
| `adsmovil-datos` | Time, volume or error rate in the collection |
| `adsmovil-react` | Team size, products migrated |
| `freelance-build` | Bundle weight or load time before/after |
| `hogarth-i18n` | Markets or languages |

An honest range with `confidence: "estimated"` works — it renders with "~"
(rule 4). An invented number collapses in the interview.

### The 8 published TODOs

`audit:todos` reports **9** because it counts occurrences in `dist/` and one
entry gets published in more than one output. They are 8 data points.

| What | Missing |
|---|---|
| summary | The long version, for LinkedIn and the portfolio |
| `dinkum-mapbox` | Data volume, what it solved for the end user |
| `jwd-maderas` | Architecture and modelling; enquiries received or time saved |
| `mapas-distritos` | What the user needed to solve; volume or impact |
| `wp-plugins` | Build time before/after, plugins delivered |
| languages | **The real English level** — declared today without confirmation |

### Others

- [ ] Links for the three projects: `links: []`. The section renders them only if
      they exist — it is editing the dataset, not touching code.
- [ ] **Hogarth**: confirm `employmentType` and `start: 2023-07`.
- [ ] **Freelance role (2020-04 → 2022-06)**: one achievement, with
      `skillIds: ["javascript"]`. Those 2.2 years connect to no other technology,
      which is why WordPress — declared `core` — comes out small on the map.
- [ ] **`Skill.periods`**: only `react` is migrated, and with the span it already
      had. The real history per technology is yours to load.

---

## 5. Content and frontend, after the three phases

- [ ] **Long-form case studies** ([`04`](./04-portfolio.md) §2: problem →
      decision → outcome). Blocked on `problem.short` and `outcome.short`.
- [ ] **Services section** (the freelance side). `services` is empty on purpose —
      do not fill it with placeholders.
- [ ] **About section.**
- [ ] **Portfolio pattern research** ([`04`](./04-portfolio.md) §6). Worth doing
      **before** designing the case studies, not after.
- [ ] **Designed CV (CV-A).** The machinery already supports it: the dataset
      declares `cv` and `cv-short`, and today only `cv-ats` is rendered.

### Why there is no backend

Evaluated 2026-08-25 under the constraint of keeping the stack free.

- **Keystatic: discarded.** Its docs require an Astro adapter to deploy, plus the
  React and Markdoc integrations. That is SSR and React in a repo whose thesis is
  `output: static` and 2.4 KB of critical JS.
- **Sanity: viable, not now.** The free tier is three orders of magnitude more
  than enough, but its model has already changed twice (2023 and 2025). The
  decisive point is another: with the data outside git, **the content stops
  passing through the gates** — `validate`, rules 7 and 8 and `test:pdf` run on
  push, not on a webhook. A badly loaded achievement would publish with nothing
  looking at it.
- **The real friction is not the missing backend**, it is that a typo costs three
  PRs. A CMS does not fix that: it sidesteps it by skipping the gates.

**Adopting it later costs the same as today:** writing `sanity-source.ts` and
changing one line in `content/source/index.ts`. That option does not expire.

**Decided NOT to do:** an English dataset. Translating a CV produces translated
English, which is worse than written English.

---

## 6. State at close

```
typecheck       0 errors, 0 hints   validate      Dataset valid
pnpm test      80 pass              test:pdf      10 pass
test:workflows 13 pass              test:js       11 pass
test:bundle    10 pass              test:landing   9 pass
test:og        11 pass              test:served    3 pass (against production)
audit:todos     9 published TODOs (missing data, not failures)
```

Consumption against the ceilings: see the table in the
[`README`](../README.md#limits-and-ceilings).

Technical debt: **18 entries, 11 resolved.** See
[`07`](./07-technical-debt.md).
