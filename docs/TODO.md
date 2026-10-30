# TODO

Two lists. **TODO**: doing next. **Technical debt**: a finding to analyse
later, logged here instead of being fixed inside an unrelated change. What
was analysed and is not worth doing now lives in `docs/DEFERRED.md`. Move
items between them; delete one only when it is done.

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

### 3. Performance and accessibility — done (2026-10-29)

Measured on the production build served locally (`astro preview`, no
Cloudflare compression, so byte figures run high), Lighthouse 13.6, first
visit (loader on):

| Page | Mobile P / A / BP / SEO | LCP | CLS | TBT | Desktop P |
|---|---|---|---|---|---|
| `/` | 97 / 100 / 100 / 100 | 2.2 s | 0 | 120 ms | 99 |
| `/en/` | 95 / 100 / 100 / 100 | 2.3 s | 0 | 220 ms | 99 |
| `/brief` | 94–100 / 100 / 100 / 100 | 0.9 s | 0.001 | 0–290 ms | 100 |
| `/en/brief` | 99–100 / 100 / 100 / 100 | 0.8 s | 0.001 | 90–110 ms | 100 |

- Fixed: the brief view's field compiled its shader synchronously (a
  300–870 ms long task on a throttled phone); it now links with
  KHR_parallel_shader_compile and polls (~150 ms left, software GL).
- Fixed: the map counter's heading read "0" to a screen reader; it reads
  the metric now.
- INP with Lenis running (412 px, CPU ×4): worst interaction 56 ms.
- Keyboard: 42 stops on `/`, 43 on `/brief`, every one on screen with a
  focus ring. Headings: one H1, no skipped levels, on both.
- Contrast, final palette: all text ≥ 5.5:1 (ink on the violet buttons is
  the lowest). The violet itself on the dark ground is 2.9:1: surfaces and
  marks only, never text.
- JS, gzip: the landing's critical chunk 71.6 KB (GSAP, ScrollTrigger,
  SplitText, Lenis, d3-delaunay, the chapters); the brief view 1.5 KB
  critical + 2 KB deferred (the field). HTML with inlined CSS: 49 KB on
  the landing, 19 KB on the brief view. Lighthouse flags ~25 KB of unused
  JS on the landing and ~1.1 s of style and layout on a throttled phone,
  both under the loader on a first visit.

### 4. CI/CD under the new directives — done (2026-10-29)

The full CLAUDE.md sequence passes. CLAUDE.md invariant 7 names the
landing's scroll exception; `scripts/pages-with-js.ts` holds it
(`SCROLL_DRIVEN_PAGES` for the landing, `PAGES_WITH_JS` adds the brief
view). Byte ceilings from stage 3 plus margin; the wheel/touchmove rule
exempts only chunks no other page loads. The landing's inline head script
is a constant allowed by its sha256 in `public/_headers` (checked against
the build and, after deploy, the served CSP). Two production-only breaks
were found on the way and fixed: the CSP would have blocked that head
script, and Astro was inlining the analytics script (Clarity would have been
blocked too). The CV drift test now asserts the landing's chapter carries
every achievement the PDF prints; the brief views are checked for
canonical, no OG and no sitemap entry. "Zero hex in JS" is a test.
Lighthouse after it: `/` 98/100/100/100, `/brief` 96/100/100/100 (mobile).

### 5. Author's review: visual and text (last, before the PR)

Everything only the author can sign off, once stages 1–4 are closed, on a
local production build (`pnpm run build && pnpm run preview`): Pages only
builds previews for `staging`, not for `feature/*` branches. A text change
after it means `i18n:lock` and the checks again.

**Text** — signed off by the author, 2026-10-29: the hook, the DeltaDictum
copy and project, and the English as prose, as they stand.

**Visual** — 2560×1440 reviewed by the author in both locales, the guided
landing and the brief view (2026-10-29). What is left:

Swept by Claude, 2026-10-29, at 375×667, 390×844, 412×915, 768×1024,
1366×768 and 1920×1080 in both locales: the animated landing walked in
half-screen steps, the brief view, the reduced-motion and the no-JS pages,
checked for sideways scroll, text past an edge, the dock over text that
cannot scroll out, the seats card over the cart and surfaces, and title lines
holding one word. Fixed: 12 px of sideways scroll on the brief view at
375 px and the map chapter's text past the edge in reduced motion (two grids
without `minmax(0, 1fr)`), the close's line cut off under the dock at
1366×768 (it now scales with the screen's height), and the seats card over
the surfaces on short phones (hidden there; the beat names all three).

The author's pass at the same sizes (2026-10-29), fixed and measured:
the seats card cut the sync line ("Mapa 4 · Carrito 4") on short phones,
moving in from above and, in Spanish, at rest (phones now only move it below
its place; card, rail and title tighter under 720 px tall); the toolbox's
page-colour band covered "4 etapas" until it stuck; "ESP" touched the PDF
half's curve at 375 and 768 (the label sizes from the half, in `cqi`); the
hero's name crowded the guided/brief choice at 1366×768 (capped at 19vh,
centred above the choice); the brief view's metric chips ran past their
panel at 375 (they break, one pill per line). The landing's CV chapter now
has the PDF's role shape: title · company, then dates, place, concurrency
and client, and the metric with its label. Reduced motion: every infinite
loop stops (the C spun frantically at tokens.css's 0.01ms), and the dock's
"Descargar CV" opens the same C with its two halves, shown in place. The CV
dialog closes on a click or tap anywhere off the halves, guided and brief.
Without JavaScript the guided landing shows a fixed way to the brief view
(`<noscript>`, not a redirect: preview crawlers would lose the OG card), a
card on the right on desktop, a bar along the bottom on phones; and its
"Descargar CV" buttons open both PDFs in the brief view's native popover
(CvPick.astro, shared; content-sized, so the backdrop closes it natively).

Accessibility audit (axe-core 4.10 over 12 page/state combinations, keyboard,
reflow, 200 % zoom, forced colors; 2026-10-30). Done, axe now at 0: the
focus ring in the text violet (2.9 → 7.6:1); "Quién soy" on the violet, the
halves' "PDF", "nonce ✕" and /cv on screen to AA contrast; the hero's name
and the PDF halves under Windows high contrast; no nested `<aside>`; /cv
reflows at 320 px (screen only; the PDF keeps `nowrap`); the language link
spelled out for screen readers; the brief view's own `<title>`. The rest
(keyboard and screen readers in the scenes, 200 % zoom, endless motion, a
skip link, an NVDA pass) is in `docs/DEFERRED.md`.

- [ ] The two halved still stretches feel right on a real wheel and in phone
      emulation (author).

### 6. Release — PR, merge, deploy (Claude)

- [ ] Move the work from `spike/landing-v2` to a `feature/*` branch.
- [ ] PR into `develop` with the version bump: `minor` (no URL or anchor of
      today's `/` goes away; `/brief` and `/en/brief` are new). CI green.
- [ ] Merge, then the promotions `develop` → `staging` → `main`
      (`flujo-de-ramas.yml`), each one carrying the number as is.
- [ ] Watch each deploy through: the Pages build, `smoke-deploy.yml`
      (`test:served`, which now checks the CSP lets the landing's head
      script run and that `/brief` is served), and the site itself on staging
      and production.

### 7. After the deploy (Claude)

The author checks the live site on real phones once it is deployed;
anything found there ships afterwards as minor fixes.

- [ ] After the next production deploy, check `pnpm run pdf:refresh` works:
      `PDF_REFRESH_TOKEN` was set as a Pages Production secret on 2026-10-29,
      and Pages applies secrets to new deployments only.
- [ ] With `PUBLIC_CLARITY_ID` set (production), check the browser holds no
      `_clck`, `_clsk` or `MUID` cookie after interacting with `/`, and
      that Clarity still records (`/collect` requests): consent is declared
      denied on purpose (`src/scripts/analytics.ts`).
- [ ] The loader shows on the first visit after a deploy and not on the next
      one (`CF_PAGES_COMMIT_SHA` is the build id; locally it is "local").
- [ ] Author, on the live site: the favicon in a light and a dark tab bar,
      the iOS home-screen icon, and the social card in a real chat and in
      LinkedIn's Post Inspector (staging URL first: it needs a public address).
- [ ] Verify on staging that our `robots.txt` wins over Cloudflare's managed
      one; if not, use Search Console.

## Technical debt

(empty)
