# TODO

Three lists. **TODO**: doing next. **Technical debt**: a finding to analyse
later, logged here instead of being fixed inside an unrelated change.
**Deferred**: analysed, not worth doing now, the idea is kept. Move items
between lists; delete one only when it is done.

## TODO

### Landing v2 — before `/v2` can ship

**Review**
- [ ] Author's review at the six resolutions: 375×667, 390×844, 412×915,
      768×1024, 1366×768, 1920×1080 (DevTools device mode, scroll the whole page).
- [ ] At least once on a real phone, iOS Safari and Android Chrome. Held scroll
      (Lenis stop + `is-held`), `svh` heights and the touch cue have only run
      emulated. Compare Lenis against native scroll there.
- [ ] The reduced-motion ("still") page once more after the layout changes.
- [ ] Phones: check the seats beat card no longer covers the cart and surfaces.

**English**
- [ ] `/en/v2` from the same page, the way `/en/` shares `HomeDocument` with `/`.
- [ ] Hard-coded Spanish in `v2.astro` and the chapter scripts moves to a
      per-locale table, `messages.ts` style (a missing translation is a
      compile error).
- [ ] Check `formatMetricEnds` output in English.
- [ ] Author reads and signs off the English `summary.long` and Hogarth.

**v1 becomes the "simple version"**
- [ ] The changes the author has in mind for it.
- [ ] A better name than "versión simple" (candidates: "versión clásica",
      "versión directa", "lectura rápida", "vista breve").
- [ ] Its URL once v2 takes `/` (not `/cv`: PDF source, no incoming links).
- [ ] Keep or remove v1's 3D map (`src/scripts/lab/`, `three`, `GraphSvg`,
      `knowledge-graph`/`graph-layout`) in the simple version.

**Content and design**
- [ ] Confirm the provisional DeltaDictum copy: the `[DECISION]` memory typed
      in the interception (`ddHook` in `v2.astro`) and the closing line.
- [ ] DeltaDictum (project) and Astro (skill) move from `v2.astro` into
      `content.es.json`, then EN, `i18n:lock`, `og:local`.
- [ ] A hook sentence that passes the voice test.
- [ ] Ask the RPPL client whether the map's shape may be shown.
- [ ] Palette: violet lives only on `/v2`; favicon, OG card, `Logo` and `/cv`
      are terracotta. Decide before v2 takes `/`.
- [ ] Loader: once per session, or on every load (today every load, while the
      opening is polished).
- [ ] "Quién soy" is the About section; its mini career line may be redundant
      next to "Recorrido".
- [ ] The slot left by the dropped Audiences chapter: a second career
      highlight, or close it.
- [ ] The two ~1-screen holds where nothing moves (intro→map, map→seats).
- [ ] The CI panel list is typed in `v2.astro`; read it from
      `content-validation.yml`.

**Gates and shipping**
- [ ] `test:js` and `test:bundle` fail on `/v2`: the page is not in
      `PAGES_WITH_JS`; Lenis and the held scenes listen for `wheel`/`touchmove`.
      Decide the exception explicitly (CLAUDE.md invariant 7 and the checks),
      not as a silent allowlist; give v2's chunk its own byte ceiling.
- [ ] Clarity and the Cloudflare beacon in v2 (added by hand per landing file).
- [ ] `public/_headers` CSP against v2's inline script; `served.check.ts`,
      `single-landing.check.ts`, `anchors.ts` and `messages.ts` once v2 is `/`.
- [ ] `src/scripts/v2/peak.ts:61` raises an `astro check` hint.
- [ ] Full sequence from CLAUDE.md, then Lighthouse again.
- [ ] Ship through `feature/*` → `develop` with a version bump.

### Site and infrastructure
- [ ] After the next production deploy, check `pnpm run pdf:refresh` works:
      `PDF_REFRESH_TOKEN` was set as a Pages Production secret on 2026-10-29,
      and Pages applies secrets to new deployments only.
- [ ] Cookie consent for EU visitors: Clarity writes eight third-party cookies
      (`src/scripts/analytics.ts`); today there is only a footer line.
- [ ] Verify on staging that our `robots.txt` wins over Cloudflare's managed
      one; if not, use Search Console.
- [ ] Look at the social card in a real chat and in LinkedIn's Post Inspector.
- [ ] `src/scripts/lab/field.ts:133`: after degrading, reset
      `measure = frameMeter()` as `graph-3d.ts` does; today the degrade step
      barely matters.
- [ ] `summary.long` says "En Dinkum entrego las dos puntas" in the present
      tense, but development on Muse and Seat Map ended (2026-02/03); today it
      is support. Fix the tense (ES, then EN and `i18n:lock`).
- [ ] Revalidate the ATS approach (one-column `cv-ats`, standard headings,
      keywords): is the CV passing filters, or does the formula need to change?

## Technical debt

- [ ] "Zero hex in JS" for the map is only a comment convention; no check
      enforces it.

## Deferred

- Per-posting CV: a generator that emits the exact `Skill.aliases` variant a job
  post uses, and a JSON Resume mapper. Wait for a concrete need.
- Own domain, then update `SITE_URL`.
- Blog: never decided.
- JSON-LD `CreativeWork` per project: little value while case studies have no
  page of their own; today only `Person` is emitted.
- JWD Maderas: unpublished until the author finishes it; links, outcome and
  metric come with the launch.
- Sanity (or any CMS): only if the local editor stops being enough. It costs
  `sanity-source.ts` plus one line in `content/source/index.ts`.
- zod 4: its own PR, gated by `editor/schema-adapter.ts`'s tests.
