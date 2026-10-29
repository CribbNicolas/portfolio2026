# TODO

Three lists. **TODO**: doing next. **Technical debt**: a finding to analyse
later, logged here instead of being fixed inside an unrelated change.
**Deferred**: analysed, not worth doing now, the idea is kept. Move items
between lists; delete one only when it is done.

## TODO

Landing v2 ships as one PR, and every stage below is done before it opens.
Stages run in order: each one assumes the previous is closed (translating
before the Spanish is final, or reviewing before the identity is, means doing
it twice). CI is adapted last, to the shape the site ends up with.

### 1. Core — v2 with no debt, v1 as the simple version, translations

**Spanish content (first: everything else translates or lays out from it)**
- [ ] Ask the RPPL client whether the map's shape may be shown. Send it now;
      the answer takes its own time.
- [ ] `summary.long` says "En Dinkum entrego las dos puntas" in the present
      tense, but development on Muse and Seat Map ended (2026-02/03); today it
      is support. Fix the tense (ES, then EN and `i18n:lock`).
- [ ] A hook sentence that passes the voice test.
- [ ] Confirm the provisional DeltaDictum copy: the `[DECISION]` memory typed
      in the interception (`ddHook` in `v2.astro`) and the closing line.
- [ ] "Quién soy" is the About section; its mini career line may be redundant
      next to "Recorrido".
- [ ] The slot left by the dropped Audiences chapter: a second career
      highlight, or close it.
- [ ] DeltaDictum (project) and Astro (skill) move from `v2.astro` into
      `content.es.json`, then EN, `i18n:lock`, `og:local`. Until then neither
      reaches the JSON-LD (`knowsAbout`), `llms.txt` or `cv.json`.
- [ ] The CI panel list is typed in `v2.astro`; read it from
      `content-validation.yml`.

**v2 debt**
- [ ] `src/scripts/v2/peak.ts:61` raises an `astro check` hint.
- [ ] Clarity and the Cloudflare beacon in v2 (added by hand per landing file).
- [ ] Cookie consent for EU visitors: Clarity writes eight third-party cookies
      (`src/scripts/analytics.ts`); today there is only a footer line. Lands
      together with Clarity in v2.

**SEO and agents: v2 loses nothing v1 has** (audited 2026-10-29 against
`dist/index.html` and `dist/v2/index.html`)
- [ ] `<head>`: v2 emits 8 tags against v1's 26. `v2.astro` calls `<Base>`
      with the title "v2 (spike)" and without `shareable` (Open Graph +
      Twitter Card), `hreflang` (es/en/x-default) or the JSON-LD `Person`
      (`slot="head"`, as `index.astro` does). Title back to
      `${fullName} — ${searchTitle}`.
- [ ] `identity.links` in the close lack `rel="me"` (v1: `rel="me noopener"`);
      it ties the page to the LinkedIn/GitHub profiles, as `sameAs` does.
- [ ] Indexable content v2 drops: education (Digital House, INCADE, UGD: 0
      of 3), three project names (RPPL map, Muse CRM, Muse API), 5 of 14
      achievements (the journey shows two per role) and the Cloudflare skill.
      Decide where it lives in v2's HTML (a compact CV chapter, the Audiences
      slot), so `/` keeps every fact the dataset publishes.
- [ ] Anchors: v2 has none of `ANCHORS` (`#mapa`, `#proyectos`, `#cv`; EN
      `#map`, `#projects`). `cv.astro` and `robots.txt` send the reader to the
      landing's `#cv`, and any shared link with an anchor lands on nothing.
      Keep the ids on v2's equivalent sections, or accept losing them (then the
      bump is `major`).
- [ ] Duplicate content: the simple version repeats v2's facts on a second
      indexable URL. Decide its `canonical` (to itself or to `/`) and whether
      it goes in the sitemap and in `HREFLANG`; `Base` and the sitemap must
      agree.
- [ ] Sitemap: today it lists `/v2/` with no `hreflang` pair. After the swap,
      `/`, `/en/` and the simple version's pair, `/v2/` gone.
- [ ] `llms.txt` (ES and EN, in production today) links four
      `/projects/<slug>` "Caso" pages that do not exist: 404 for every agent
      that follows them (`src/lib/llms-txt.ts:59`). Drop the line until case
      pages exist, and make `endpoints.check.ts` resolve every internal link
      of `llms.txt` against `dist/`.
- [ ] `llms.txt`'s "CV (HTML)" link points to `/cv`: `noindex`, disallowed in
      `robots.txt`. Point it where the reader's CV is after the anchor
      decision, and update `robots.txt`'s comment to match.
- [ ] Without JS the text is already in the HTML (checked). Remaining: with
      JS off, no CSS leaves a chapter invisible or stacked.

**English**
- [ ] Hard-coded Spanish in `v2.astro` and the chapter scripts moves to a
      per-locale table, `messages.ts` style (a missing translation is a
      compile error).
- [ ] `/en/v2` from the same page, the way `/en/` shares `HomeDocument` with `/`,
      with the same `<head>` in `en` (`og:locale` `en_US`, `og.en.jpg`).
- [ ] Check `formatMetricEnds` output in English.
- [ ] Author reads and signs off the English `summary.long` and Hogarth.

**v1 becomes the "simple version"**
- [ ] A better name than "versión simple" (candidates: "versión clásica",
      "versión directa", "lectura rápida", "vista breve").
- [ ] Keep or remove v1's 3D map (`src/scripts/lab/`, `three`, `GraphSvg`,
      `knowledge-graph`/`graph-layout`). If it stays,
      `src/scripts/lab/field.ts:133`: after degrading, reset
      `measure = frameMeter()` as `graph-3d.ts` does. If it goes, so do the
      files and the `three` dependency.
- [ ] The changes the author has in mind for it.
- [ ] Its URL once v2 takes `/` (not `/cv`: PDF source, no incoming links).
- [ ] The swap: v2 serves `/` and `/en/`, v1 moves to its URL, `/v2` stops
      existing. `LOCALE_PATHS`/`anchors.ts`, `messages.ts`, `llms.txt` and the
      sitemap follow.
- [ ] A link each way between v2 and the simple version, in both locales.

**CV**
- [ ] Revalidate the ATS approach (one-column `cv-ats`, standard headings,
      keywords): is the CV passing filters, or does the formula need to change?

### 2. Design and identity

- [ ] Palette: violet lives only on `/v2`; favicon, OG card, `Logo`, `/cv`
      and `404` are terracotta. One identity across v2, the simple version and
      the PDFs (`/cv` never prints dark). `theme-color` in `Base.astro`
      (`#131417`) follows the final `--bg`. Then `og:local`.
- [ ] Loader: once per session, or on every load (today every load, while the
      opening is polished).
- [ ] The two ~1-screen holds where nothing moves (intro→map, map→seats).

### 3. Performance and accessibility

- [ ] Lighthouse, mobile and desktop, on v2 (ES and EN) and the simple
      version.
- [ ] Core Web Vitals: LCP with the loader in front, CLS from the held scenes,
      INP while Lenis runs.
- [ ] Measure v2's JS chunk; the number becomes its byte ceiling in stage 5.
- [ ] Accessibility: keyboard through the held scenes, visible focus,
      screen-reader order, contrast with the final palette.

### 4. Manual visual review

- [ ] Author's review at the six resolutions: 375×667, 390×844, 412×915,
      768×1024, 1366×768, 1920×1080 (DevTools device mode, scroll the whole
      page), in both locales and on the simple version.
- [ ] The reduced-motion ("still") page once more after the layout changes.
- [ ] Phones: check the seats beat card no longer covers the cart and surfaces.
- [ ] At least once on a real phone, iOS Safari and Android Chrome. Held scroll
      (Lenis stop + `is-held`), `svh` heights and the touch cue have only run
      emulated. Compare Lenis against native scroll there.
- [ ] Look at the social card in a real chat and in LinkedIn's Post Inspector
      (the branch's Pages preview URL).

### 5. CI/CD under the new directives

- [ ] Write the directive first: v2's exception to invariant 7 (scroll
      hijacking, client JS on the landing) in CLAUDE.md and in the headers of
      the checks it touches. Explicit, not a silent allowlist.
- [ ] `test:js` and `test:bundle`: the landing in `PAGES_WITH_JS` (Lenis and
      the held scenes listen for `wheel`/`touchmove`), its chunk with the
      ceiling measured in stage 3.
- [ ] `public/_headers` CSP against v2's inline script.
- [ ] `served.check.ts` and `single-landing.check.ts` for the new structure
      (v2 on `/`, the simple version on its URL).
- [ ] "Zero hex in JS" for the map: today only a comment convention; turn it
      into a check.
- [ ] Full sequence from CLAUDE.md, then Lighthouse again.
- [ ] PR: from a `feature/*` branch (not `spike/landing-v2`) into `develop`,
      with the version bump. `major` if any URL or anchor of today's `/` goes
      away, `minor` otherwise.

### After the merge (needs a real deploy)

- [ ] After the next production deploy, check `pnpm run pdf:refresh` works:
      `PDF_REFRESH_TOKEN` was set as a Pages Production secret on 2026-10-29,
      and Pages applies secrets to new deployments only.
- [ ] Verify on staging that our `robots.txt` wins over Cloudflare's managed
      one; if not, use Search Console.

## Technical debt

(empty)

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
