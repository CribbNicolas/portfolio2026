# TODO

Three lists. **TODO**: doing next. **Technical debt**: a finding to analyse
later, logged here instead of being fixed inside an unrelated change.
**Deferred**: analysed, not worth doing now, the idea is kept. Move items
between lists; delete one only when it is done.

## TODO

Landing v2 ships as one PR, and every stage below is done before it opens.
Stages run in order: each one assumes the previous is closed (translating
before the Spanish is final, or reviewing before the identity is, means doing
it twice). CI is adapted to the shape the site ends up with, and the
author's manual review (stage 5) closes it before the PR.

### 1. Core — done (2026-10-29)

v2 serves `/` and `/en/` from one component
(`src/components/v2/Landing.astro`, copy in `src/lib/landing-copy.ts`); v1
is the brief view at `/brief` and `/en/brief` (the cv-ats CV on screen,
canonical → its landing, out of the sitemap), without the 3D map. The ATS
approach was revalidated: the layout holds, and the two content fixes it
found (metrics print with their label, the role heading carries only title
and company) are in. The author's read of the copy is in stage 5.

### 2. Design and identity — done (2026-10-29)

The landing's violet is the site's palette (`tokens.css`: `--accent` for
surfaces, `--accent-ink` for text on dark), on the brief view, the 404,
the favicon, the OG card and the iOS icon; the printed CV keeps its own
light, standard palette (`cv.css` `@media print`). The loader shows once
per deploy (`src/lib/landing-head.ts`). The two still stretches (the
summary before the map, the hall before the seats beats) are halved.
Redirecting bots to the brief view was considered and rejected: serving
crawlers a different page than people is cloaking, and `/` already carries
every fact as HTML.

### 3. Performance and accessibility

- [ ] Lighthouse, mobile and desktop, on v2 (ES and EN) and the brief
      view.
- [ ] Core Web Vitals: LCP with the loader in front, CLS from the held scenes,
      INP while Lenis runs.
- [ ] Measure v2's JS chunk; the number becomes its byte ceiling in stage 4.
- [ ] Accessibility: keyboard through the held scenes, visible focus,
      screen-reader order, contrast with the final palette.

### 4. CI/CD under the new directives

- [ ] Write the directive first: v2's exception to invariant 7 (scroll
      hijacking, client JS on the landing) in CLAUDE.md and in the headers of
      the checks it touches. Explicit, not a silent allowlist.
- [ ] `test:js` and `test:bundle`: the landing in `PAGES_WITH_JS` (Lenis and
      the held scenes listen for `wheel`/`touchmove`), its chunk with the
      ceiling measured in stage 3.
- [ ] `test:js`: the brief views ship the analytics script, and the
      landings an inline head script (`document.documentElement.classList
      .add("js")`) that the "every <script> without src is data" rule
      rejects. Decide both in `PAGES_WITH_JS` and the rule.
- [ ] `test:landing`'s CV drift test counts `<li>` from `#cv` to the end
      of the page and expects the PDF's count. The landing's CV chapter shows
      the `portfolio` surface (every achievement), the PDF `cv-ats`: assert
      that every PDF achievement appears in the chapter instead, and count
      inside the section only.
- [ ] `public/_headers` CSP against v2's inline script.
- [ ] `served.check.ts` and `single-landing.check.ts` for the new structure
      (v2 on `/`, the brief view on `/brief`).
- [ ] "Zero hex in JS" for the map: today only a comment convention; turn it
      into a check.
- [ ] Full sequence from CLAUDE.md, then Lighthouse again.

### 5. Author's review: visual and text (last, before the PR)

Everything only the author can sign off, done on the branch's Pages preview
once stages 1–4 are closed (a text change after it means `i18n:lock` and
the checks again).

**Text**
- [ ] Read the hook on screen, in both locales.
- [ ] Confirm the provisional DeltaDictum copy: the `[DECISION]` memory typed
      in the interception (`ddHook` in `landing-copy.ts`) and the CTA line
      ("Un producto mío, hecho para la forma en que trabajo con agentes de
      código.").
- [ ] Confirm the DeltaDictum project as written into the dataset (problem,
      solution, outcome; from its README and CHANGELOG only, no `decisions`:
      a trade-off would have been invented).
- [ ] English CV bullets open with "I built…"; English CVs usually drop
      the pronoun (human readers, not the ATS).
- [ ] Read and sign off, as prose, the English: `summary.long`, Hogarth, the
      DeltaDictum project and every `en` line of `landing-copy.ts`.
- [ ] English CV chapter: the kicker "CV" sits over the heading "CV"
      (`cvKicker` and `MESSAGES.en.cvTitle`); keep one.

**Visual**
- [ ] The six resolutions: 375×667, 390×844, 412×915, 768×1024, 1366×768,
      1920×1080 (DevTools device mode, scroll the whole page), in both
      locales and on the brief view.
- [ ] The new CV chapter (`.cvx`, before the close).
- [ ] The brief view redesign: raised panels over the animated field, the
      reveal as you scroll, figures and metrics in the accent, `core` skills
      set apart, the contact in the header (on phones, its only place).
- [ ] At 1366×768 the dock overlaps the close's last line while it scrolls
      under it (seen in a screenshot, 2026-10-29).
- [ ] The violet across the site: the brief view, the 404, the favicon in a
      light and a dark tab bar, the OG card, the iOS home-screen icon.
- [ ] The two halved still stretches feel right on a real wheel and a phone.
- [ ] The reduced-motion ("still") page once more after the layout changes.
- [ ] The page with JavaScript off (DevTools → disable JavaScript): it now
      reuses the still layout; nothing should be hidden or stacked.
- [ ] Phones: check the seats beat card no longer covers the cart and surfaces.
- [ ] At least once on a real phone, iOS Safari and Android Chrome. Held scroll
      (Lenis stop + `is-held`), `svh` heights and the touch cue have only run
      emulated. Compare Lenis against native scroll there.
- [ ] Look at the social card in a real chat and in LinkedIn's Post Inspector
      (the branch's Pages preview URL).

- [ ] PR: from a `feature/*` branch (not `spike/landing-v2`) into `develop`,
      with the version bump. `major` if any URL or anchor of today's `/` goes
      away, `minor` otherwise.

### After the merge (needs a real deploy)

- [ ] After the next production deploy, check `pnpm run pdf:refresh` works:
      `PDF_REFRESH_TOKEN` was set as a Pages Production secret on 2026-10-29,
      and Pages applies secrets to new deployments only.
- [ ] With `PUBLIC_CLARITY_ID` set (production), check the browser holds no
      `_clck`, `_clsk` or `MUID` cookie after interacting with `/`, and
      that Clarity still records (`/collect` requests): consent is declared
      denied on purpose (`src/scripts/analytics.ts`).
- [ ] The loader shows on the first visit after a deploy and not on the next
      one (`CF_PAGES_COMMIT_SHA` is the build id; locally it is "local").
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
