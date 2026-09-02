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
| **2** | `pnpm run editor` | It needs the schema to be still. Touched earlier, it gets done twice. **Done** |
| **3** | The debt that does touch data creation, and whatever is left | Resolved with the editor in sight, not before |

**The rule separating phase 1 from phase 3:** anything to do with **how the CV
data is created or modelled** waits for the editor. Fixing it earlier guarantees
it gets touched again.

---

## 1. Phase 1 — done, with a residue

Social metadata ([`07`](./07-technical-debt.md) §17 and §18), the 404, robots,
the sitemap, the favicon and `served.check.ts` are all closed. So is the English
migration of the whole repo, decided and executed on 2026-08-26.

**Phase 1 is closed.** Nine debt entries went with it — the cosmetic ones
(`§2`, `§3`, `§4`), the two that only needed a decision (`§5`, `§12`), and the
four that needed work (`§8`, `§9`, `§10`, `§11`).

Three of those are worth remembering, because each one was a gate that did not
exist rather than a tidiness fix:

- **Invariant 1 held only because nobody had broken it.** `CLAUDE.md` calls it
  non-negotiable and nothing enforced it. Now `scripts/invariants.test.ts` does,
  along with invariant 3.
- **`/cv.json` and `/llms.txt` had no gate at all**, and they are the two
  surfaces agents consume. Now `scripts/endpoints.check.ts`.
- **Nothing verified the fonts were embedded in the PDF.** It would have looked
  right on the author's machine and wrong on every other one, and the ten
  existing tests could not see it — they all read the extracted text, which does
  not change.

Phase 1 residue ([`07`](./07-technical-debt.md) §13) closed 2026-08-31: the
author confirmed the cross-hover and the pill. The download button in
`pnpm run dev` 404'd because Pages Functions do not run there; `astro.config.mjs`
now serves `dist/cv.pdf` in dev.

---

## 2. Phase 2 — done

`pnpm run editor` landed in 0.17.0 (the page) and 0.18.0 (the six medium gaps
from the page review: GET 422, 409 latch, load errors, header scalars,
`updatedAt`, remove with a ref check, prune of hollow optional objects). The
shape below is what was built, kept so the next session does not reopen the
decisions.

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

**And the range already drifted.** Measured 2026-08-27: `package.json` declares
`zod: ^3.23.8` and what is installed is **3.25.76** — two minors of internal
churn that arrived without anyone deciding. `_def` is not covered by semver, so
`^3` is a wider door than it looks.

Decide this before writing the introspection, not after:

- **Pin the exact version** while the editor exists, and treat a bump as its own
  PR with the introspection tests as the gate. Blunt, and it makes the cost
  visible instead of surprising.
- **Or keep the range** and put every `_def` access behind one adapter module
  with tests that assert the shape it expects — a field's type, whether it is
  optional, an enum's values. Then a bump fails in one file with a message that
  says what changed.

The second is preferable and is what §"How to proceed" already implies. Either
way it is a decision, not a default.

Zod 4 changed introspection substantially. That migration will hurt whenever it
comes, and the adapter is what keeps it to one file.

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

### Metrics: two loaded (RPPL map); the rest still empty

`dinkum-mapbox` and `dinkum-mapbox-index` carry `metric` as of 2026-09-01.
Candidates still open in [`03-cv.md`](./03-cv.md):

| Achievement | What to measure |
|---|---|
| `dinkum-vite` | Closed as a Webpack→Vite claim: the Woo plugin is still wp-scripts. The Vite work is Muse. |
| `adsmovil-datos` | Time, volume or error rate in the collection |
| `adsmovil-react` | Team size, products migrated |
| `freelance-landings` | Closed as a named case: landings in a team, stack only |
| `hogarth-i18n` | Markets or languages |

An honest range with `confidence: "estimated"` works — it renders with "~"
(rule 4). An invented number collapses in the interview.

### The published TODOs

English level closed 2026-08-31 (**A2**). The rest are still data, not code.

| What | Missing |
|---|---|
| summary | `long` drafted 2026-09-01 (LinkedIn About / portfolio). Author will edit. |
| `jwd-maderas` | Unpublished 2026-09-01 (`except` every surface) until it ships. Still in the dataset. |
| `wp-plugins` | Rewritten 2026-09-01 as WooCommerce Seat Map (no Vite; Playwright suite is team-owned) |

### Others

- [x] **RPPL map** (`mapas-distritos`): live demo link, problem/outcome, three
      decisions, ~13.000 districts. Loaded 2026-09-01.
- [ ] Links for the other two projects: `jwd-maderas` and `wp-plugins` still
      have `links: []`.
- [x] **Hogarth**: `full-time` + `concurrent: true`, `start: 2023-07` → `end: 2024-01`. Confirmed 2026-08-31.
- [x] **Freelance role (2020-04 → 2022-06)**: `skillIds` now include WordPress, Docker, Vue, Quasar, SCSS. Still one achievement.
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

Verified on `develop` at `5663f5b`, from a `pnpm install --frozen-lockfile`, on
2026-08-27. Not from memory — the numbers below are that run.

```
typecheck       0 errors, 0 hints   validate        Dataset valid
pnpm test      80 pass              test:pdf        11 pass
test:workflows 13 pass              test:js         11 pass
test:bundle    10 pass              test:landing     9 pass
test:endpoints 10 pass              test:og         11 pass
test:served     3 pass (production) audit:deps      green for the first time
audit:todos     9 published TODOs (missing data, not failures)
```

Consumption against the ceilings: see the table in the
[`README`](../README.md#limits-and-ceilings).

Technical debt: **36 entries, 22 resolved.** Phase 3 still holds §6 and §7.
The rest of the open list is low or negligible editor internals. See
[`07`](./07-technical-debt.md).
