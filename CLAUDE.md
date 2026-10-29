# CLAUDE.md — instructions for future sessions

Operating instructions for you. This file holds what is true everywhere in the
repo. What is true of one file lives in that file's header comment; what is
true of an area and no file says (decisions, discarded options, traps) lives in
DeltaDictum and arrives when you touch those files. Pending work: `docs/TODO.md`.

## What this is

A CV and portfolio for a developer looking for work and freelance clients in the
Spanish-speaking market (LatAm first). **The data is the single source of
truth; every surface is a derived view**: the landings (`/`, `/en/`), the
CV pages the PDFs are printed from (`/cv`, `/en/cv`), the PDFs, JSON-LD,
`/cv.json` and `/llms.txt`. The dataset stores atomic facts (`Role`,
`Achievement`, `Skill`, `Metric`, `Project`), never documents.

Positioning, which every piece of copy serves: the search title is
"Desarrollador Full Stack" (what recruiters type), the brand is "Product
Engineer" (complete products, not just the interface). The differentiator is
shipping whole products: geospatial maps at scale, legacy systems modernised
without breaking them. AI is a visible pillar of how the work gets done, never
the headline.

## Language

Site content is Spanish (`content.es.json`, canonical, always edited first) and
English (`content.en.json`, translated from it). Identifiers, comments, docs and
commit messages are always English. A user-visible string stays in its
surface's language, URL anchors included.

## Invariants (non-negotiable)

1. **Visibility and durations are resolved once.** `resolveView`
   (`content/schema/resolve-view.ts`) filters; `dates.ts` computes. A
   `.filter` on visibility or a month calculation anywhere else is a bug.
   Everything imports from `content/source/index.ts`, never `json-source`.
2. **No duration or seniority is written by hand.** It derives from
   `careerStart`/`start`/`end`.
3. **Never invent a metric, number, date or achievement.** A missing datum goes
   in as `TODO — ...` inside the `Prose`. An invented number collapses in the
   interview.
4. **`Prose.short` and `Prose.long` are two registers, not a truncation.** No
   `.slice()` or `truncate()` deriving one from the other.
5. **The contract rules are tests.** When the data breaks one, fix the data,
   not the rule.
6. **Voice.** Test every line: could another developer with the same stack have
   written this exact sentence? If yes, rewrite it with a proper name, a number
   or a decision. Achievements: past-tense verb + concrete object + what for +
   outcome. Banned: `apasionado`, `proactivo`, `resultados`, `soluciones
   innovadoras`, `aprovechar`, `liderar` (with no object), `buenas prácticas`
   (without saying which), `stack moderno`, `escalable` (without the scale),
   `cutting-edge`, `dinámico`, `orientado a resultados`.
7. **Design anti-checklist.** No skill bars, radars or percentages; no stock
   illustrations or decorative blobs; no carousels, custom cursors or splash
   screens; no photos with text inside; `/cv` never prints dark. No scroll
   hijacking — except on landing v2, where it is a deliberate, open decision.
8. **Free tiers only.** Hosting, rendering, analytics and CI stay on free plans;
   the domain is the only thing worth paying for.

## Commands

**pnpm only** — `pnpm-workspace.yaml` (`allowBuilds`) decides which packages may
run install scripts; npm would run them all. Every script is in `package.json`
and each check explains itself in its header. Three need care:

- `pnpm run pdf:refresh` re-renders the **published** PDFs. It changes production.
- `pnpm run og:local` and `pnpm run i18n:lock` regenerate committed files.
  Commit what they write.

**Before calling anything done**, run the full sequence (CI runs the same):

`pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run test:i18n && pnpm run test:editor && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos`

## Branches and versions

`feature/*` → `develop` → `staging` → `main`. Only `develop` enters `staging`
and only `staging` enters `main` (`flujo-de-ramas.yml`). Every PR into
`develop` raises `package.json` `version` (`version-gate.yml`); promotions carry
the number as is. Choosing the bump is a judgement no check makes:

- `patch` — a fix; nothing new, nothing reads differently.
- `minor` — something new: a section, an endpoint, a datum that was not there.
- `major` — something that existed changes shape: a URL goes away, a
  `/cv.json` field is renamed.

## Pending work

`docs/TODO.md` has three lists: **TODO** (doing next), **Technical debt** (a
finding to analyse later — log it there instead of fixing it inside an
unrelated change) and **Deferred** (analysed, not worth doing now, the idea is
kept). Move items between lists; do not delete one that is not done.
