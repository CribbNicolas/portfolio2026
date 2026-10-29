# Landing v2 — working notes

Running notes for the v2 of the landing (`/` and `/en/`). Not a spec yet: it
collects decisions as they are made, the candidate tools, and the inventory of
what has to change. The spec gets written from here once the first two sections
are agreed.

Started 2026-10-26.

## 1. Direction (decided by the author)

- **Goal:** a landing that produces a "wow" effect. Performance and
  optimization are kept where possible but are **no longer the priority**.
- **The landing IS the experience.** Animation, 3D rotations and transitions
  are the page itself, not a widget embedded in it. This is the difference
  from the v1 knowledge map, which was "a map inside a landing".
- **One continuous experience from start to finish**, gripping, and it
  **culminates in downloading the CV**. The header probably goes away (to be
  seen while iterating).
- **Positioning:** a web developer who adapts to new technologies — the page
  itself has to demonstrate that, not claim it.
- **Tone:** professional and interesting; sells without looking like an
  old-fashioned sales pitch. Subtlety over claims.
- **Data:** the landing no longer reuses the CV components. It takes the data
  (the dataset) and builds a far more attractive presentation from it.
- **Process:** build the first two sections, look at them, iterate. No fixed
  reference site.
- **Smooth scroll:** try Lenis and see how it feels.
- **Scroll hijacking is acceptable here**, because the scroll *drives* the
  experience. This reverses the v1 anti-checklist (spec 2026-08-14 §3.4) for
  the landing only.
- **Budget:** raised. Whatever has to be rewritten is rewritten.
- **The 3D node map is removed.**

## 2. What does NOT change

- `/cv` and `/en/cv` stay exactly as they are: zero JS, single column, the
  source of the PDFs. `functions/` keeps printing from them.
- The content layer: schema, validation, `resolveView`, the dataset, i18n.
- Invariants 1–8 of `CLAUDE.md`. In particular the landing still reads data
  through `content/source/index.ts` → `getView("portfolio")`, not the raw JSON
  (invariant 2), and never computes durations or filters by visibility
  itself (invariant 1). Invariant 4 (no invented data) and the voice rules of
  `docs/02-branding.md` apply to every word the new landing says.

## 3. Candidate skills

Ecosystem search on 2026-10-26 (`npx skills find`, skills.sh). None installed
yet. Install with `npx skills add <owner/repo@skill>`.

### Primary

| Skill | Source | Why |
|---|---|---|
| `gsap-core`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-performance` | greensock/gsap-skills — official, 17k★, ~70k installs each | Timeline, scroll `scrub`/`pin`, SplitText, Flip, MorphSVG. The backbone |
| `animation-vocabulary`, `review-animations`, `animation-performance` | emilkowalski/skills — 50k★ | Motion judgment: easing, duration, when not to animate |
| `impeccable`, `overdrive` | pbakaus/impeccable — 89k★ | `overdrive` targets exactly the wow layer: shaders, scroll scenes |
| `high-end-visual-design`, `redesign-existing-projects` | leonxlnx/taste-skill — 103k★ | Premium visual direction; the second one fits a v2 |
| `threejs-shaders`, `threejs-postprocessing`, `threejs-animation` | cloudai-x/threejs-skills — 3.8k★ | 3D, shaders, bloom/distortion, for logos and scenes |
| `frontend-design` | anthropics/skills — 1M installs | General design baseline |

### Niche — read before installing

| Skill | Source | Why |
|---|---|---|
| `cinematic-gsap-lenis-motion-system`, `cinematic-scroll-storytelling`, `scroll-scrubbed-visual-sequence`, `build-threejs-scroll-worlds`, `horizontal-scroll-scenes`, `reveal-hover-effect` | mengto/skills — 7k★, ~0.4–2.4k installs | Closest to the brief (GSAP + Lenis, scroll-scrubbed sequences) but low usage |
| `motion-design` | lottiefiles/motion-design-skill — 2.5k★ | Only if Lottie is used |
| `react-three-fiber`, `spline-interactive`, `barba-js` | freshtechbro/claudedesignskills | Only if R3F / Spline / Barba are chosen |
| `hyperframes-*` | heygen-com/hyperframes — 73k★ | HTML-based video; an alternative to Remotion, which we already use |

Discarded: `devmartinese/awwwards-animations-skill` (15★).

### Already installed

- **Remotion** skills (`remotion-*`). Used in `C:\dev\dd-linkedin-video` for the
  DeltaDictum LinkedIn video. Candidate for rendering scroll-scrubbed clips.

## 4. Candidate libraries

- **GSAP** — 100% free since the Webflow acquisition, bonus plugins included
  (SplitText, MorphSVG, ScrollSmoother). Main option.
- **Lenis** — smooth scroll. To try (author's call).
- **three.js** — already a dependency; now free of the v1 rules (dynamic
  import only, no `three/addons`).
- **Motion** (motion.dev), **Theatre.js** (visual sequencing of 3D), **Rive**
  (interactive state machines), **Lottie**, **OGL** (lighter WebGL).
- **Native:** View Transitions, CSS scroll-driven animations (Chromium +
  Safari 26; Firefox unconfirmed — use as progressive enhancement only).

## 5. Video that advances with scroll

1. `<video>` + `currentTime`: simplest; needs all-intra encoding
   (`ffmpeg -g 1`), heavier, can stutter on mobile.
2. **WebP frame sequence drawn on `<canvas>`, driven by ScrollTrigger** — the
   Apple technique, most reliable, costs preloading.
3. WebCodecs: decode every frame up front; best performance, uneven support.

Proposed pipeline: Remotion scene → WebP frames → canvas scrubbed by scroll.

## 6. Change inventory

### Remove (the v1 map)

- `src/scripts/lab/` (boot, capability + test, field, graph-3d, hover-bus,
  interaction, pill, types)
- `src/components/lab/GraphSvg.astro`, `src/styles/lab.css`
- `src/lib/graph-svg.ts`, `src/lib/lab-hover-css.ts`, `src/lib/lab-data.ts`,
  `src/lib/map-labels.ts`
- `content/schema/knowledge-graph.ts` (+ test), `content/schema/graph-layout.ts`
  — check first whether anything outside the map uses them
- `CLAUDE.md` § "Map frontend" (rules 1–7, the capability probe) and the
  file-map entries for all of the above
- `docs/04-portfolio.md` §7 (the knowledge map) — superseded

### Rewrite

- `src/components/HomeDocument.astro`, `src/styles/home.css`,
  `src/components/projects/ProjectList.astro`, `src/styles/projects.css`
- `src/pages/index.astro`, `src/pages/en/index.astro`
- `src/lib/anchors.ts` — section ids change; `LOCALE_PATHS` stays
- `content/schema/messages.ts` — new chrome copy
- `scripts/bundle-budget.check.ts` — new budget, new rules
- `scripts/single-landing.check.ts` — the landing no longer mirrors the CV
  section; keep "/cv isolated, noindex, no incoming links" and the 404
- `scripts/no-client-js.check.ts` / `scripts/pages-with-js.ts` — `/cv` still
  at zero; landings allowlisted
- `public/_headers` — CSP may need `worker-src`/`media-src`/`blob:` for video
  and canvas work; verified by `served.check.ts`
- `docs/superpowers/specs/2026-08-14-sistema-visual-design.md` §3.4 — record
  that scroll hijacking is now allowed on the landing
- OG card (`og-template.ts`) if the visual identity changes → `og:local`

### Keep

- `src/lib/jsonld.ts`, `src/lib/llms-txt.ts`, `/cv.json`, `/llms.txt`
- Analytics on first interaction (`src/scripts/analytics.ts`)
- `prefers-reduced-motion`: the experience needs a still version

## 7. Research

Personal branding / self-marketing research requested 2026-10-26: how to sell
a person (not a brand) without old-fashioned sales, the wow effect,
hiring-manager psychology, standing out, signaling adaptability.
Notes in `docs/v2/research_notes/`, report in
`docs/v2/reports/Marca personal para desarrollador web.md` (done 2026-10-26).

Proposed by the report, not yet agreed: a six-chapter arc (Apertura → map as
the peak → legacy without breaking it → dated trail → how I work → close on
the CV), section 1 painted as static HTML before any JS with the CV reachable
from the first viewport, a persistent minimal control in place of the header,
and the scroll-hijacking mitigations table.

Pending from the author:
- A hook sentence that passes the voice test (the current tagline does not).
- Whether the RPPL client allows showing the map or its data shape; if not,
  illustrative geometry with the real numbers in the text.

## 8. Answered questions (2026-10-26)

- **Visual identity:** base + freedom. The ring-with-N logo and the dark tone
  stay as anchors; palette, typography and visual language are open.
- **Personal presence:** none. No photo, video or 3D portrait — the person is
  inferred from the work and the voice. (The OG card keeps its photo unless
  decided otherwise.)
- **Branching:** close the current branch first
  (`feature/lab-3d-resilience-and-dark-theme`), then open a long-lived
  `feature/landing-v2` off `develop`. v1 stays in production until v2 is ready.

- **Loader (2026-10-26):** allowed, ONLY if loading needs it, and kept under
  ~3 s. Report's caveat: no percentage loader that blocks the page — it is
  the remembered negative peak. Fits best as the logo ring drawing itself
  over already-painted HTML, skipped on reduced motion and on repeat visits.
- **RPPL map (2026-10-26):** illustrative geometry. Real numbers in the text.
- **Arc (2026-10-26):** the report's six chapters accepted as the starting
  point for a sketch of sections 1 and 2.

## 9. Spike (2026-10-26)

Branch `spike/landing-v2` off `develop`, uncommitted, throwaway. Route `/v2`
(`src/pages/v2.astro`, `src/scripts/v2/`, `src/styles/v2.css`). Deps added:
`gsap`, `lenis`, `d3-delaunay`, `simple-icons` (dev, build-time only). No checks run on it.

- Loader: the ring outline draws, fills, the N strokes in, the mark zooms out.
  Since 2026-10-28 it shows a REAL percentage under the mark and the outline
  draws with it: fonts (15), page `load` capped at 5 s (15), each chapter's
  init run under the loader one frame apart (60, the map weighs most),
  `ScrollTrigger.refresh()` (5), two painted frames (5). No minimum time; the
  hero entrance is built paused and plays as the mark leaves. `?nointro`
  skips it. Was once per session (sessionStorage);
  since 2026-10-28 it plays on EVERY load while the opening is polished, and
  a reload always starts at the top (`scrollRestoration = "manual"`, bfcache
  restores force a reload). Decide before the real build whether to bring
  the once-per-session gate back.
- Section 1: static hero (name in SplitText, meta, provisional hook, facts,
  CV + mail). The giant ring turns slowly; the map's mesh shows through its
  hole.
- Hero choice note (2026-10-28): "Bajá para ver el recorrido guiado" with a
  cue, or "Ver la versión simple". The cue is picked by INPUT in CSS
  (`hover: none` + `pointer: coarse` → a finger swiping up; otherwise a mouse
  wheel), not by width. Bottom-left on desktop; in the flow under the
  buttons on phones (at the bottom it sat on the ring). SPIKE: the simple
  version links to the current landing (`paths.home`). OPEN for the real
  build: once v2 IS `/`, the simple version needs its own route — `/cv`
  cannot be it, `single-landing.check.ts` forbids incoming links to it.
- The dive: hero and map are ONE pinned stage. Scrolling flies through the
  ring's hole; the map's clip circle is computed from the ring geometry so the
  hole and the window are the same circle.
- Section 2: ~13,000 generated Voronoi cells in canvas, CSS 3D tilt. Five
  beats: brief → scale (counter to the dataset's figure, `formatMetric` label)
  → artifacts flicker → an index sweep cleans them → `formatMetric` result
  with before/after bars. Texts come from the dataset achievements.
- Reduced motion: no loader, no Lenis, no pin; the map drawn complete.

### Iteration 2 (2026-10-26)

The author asked for a personal section before the map. New order:

1. **Apertura** — normal section now (not pinned); on scroll the copy drifts
   up and the giant ring rolls away.
2. **Quién soy** (pinned) — manifesto lit word by word by the scroll ("Soy
   Nico. Desarrollador full stack con el foco puesto en el frontend: 6+ años…",
   years via `formatSeniority`; "foco en el frontend" is the author's own
   positioning). Then an isometric 3D stack of three plates built from
   `view.skills` (Interfaz / Servidor y CMS / Entrega) that opens with the
   frontend plate lifted highest, and a career line drawn from
   `view.experience` (2020 Independiente → 2024 Dinkum).
3. **El mapa** — the ring RETURNS centered with the mesh in its hole, and the
   dive goes through it. Then the five beats as before.
4. **Nada se pierde** (pinned) — illustrative hall of seats, four beats:
   the plugin (`dinkum-wp`), two clicks racing into the cart and one losing the
   nonce (map 4 · cart 3, red), AsyncPile queueing them (`dinkum-woo-sync`,
   map 4 · cart 4), and reload / minicart / checkout showing the same seats.

Code split into `src/scripts/v2/{main,util,about,peak,map,seats}.ts`.

### Iteration 3 (2026-10-26)

Author's feedback, applied:

- **The C floods the screen.** Opening and "Quién soy" are ONE pinned stage
  (`src/scripts/v2/intro.ts`). On scroll the C stops turning, crosses OVER
  the copy and grows around a point inside its body until the screen is solid
  accent; "Quién soy" is revealed on that color (dark ink on terracotta).
- **The stack breaks apart WHILE the manifesto lights up**, not after.
- **The cards end facing the reader**: the isometric pile turns flat into
  three readable cards, Interfaz on top with a highlighted border.
- **Career line faster**: ~0.45 timeline units instead of 1.4.
- **Faster scroll everywhere**: Lenis `lerp 0.14`, `wheelMultiplier 1.45`,
  `touchMultiplier 1.6`; pins shortened (intro 300%, map 460%, seats 380%).

### Iteration 4 (2026-10-26)

- **Pacing in one unit.** `paced()` in `src/scripts/v2/util.ts` re-times each
  chapter's timeline in screens of scroll per beat, and the pin length is the
  sum. Before, "Quién soy" took ~2.1 screens while each map beat took ~0.7.
  Now every beat sits in 0.8–1.1, with "Quién soy" at 1.7 because it is the
  one with reading in it:

  | Chapter | Beats (screens) | Total |
  |---|---|---|
  | Intro | cover 0.85 · quién soy 1.7 · career 0.5 | 3.05 |
  | Map | dive 0.8 · brief 0.8 · scale 1.1 · broke 0.8 · decision 1.0 · result 0.9 | 5.4 |
  | Seats | brief 0.8 · broke 1.0 · decision 1.1 · result 0.8 | 3.7 |

- **The cards' turn is organic**: the two camera angles on different curves
  and offset in time (an arc, not a hinge), each card leaves the pile a beat
  after the one above, yaws slightly on the way and settles with a small
  overshoot (`back.out(1.25)`).
- **Spaced pile, in order (2026-10-28).** The author's complaint was the
  stretch where all three cards sat flush on one another, and that they
  arrived 3 → 2 → 1. Now they rise straight into a SPACED pile (z 80 / 20 /
  -40 after "still too far apart" — first try was 260 / 80 / -100; ×0.45 on
  phones) in reading order, Interfaz → Servidor → Entrega,
  each landing below the ones already there so none passes through another.
  The turn is the one from iteration 4, except the spread starts 0.1 into it
  instead of 0.22, so the pile no longer presses together before opening.
  (A version with no pile — each card in its own slot from the start — was
  tried and rejected the same day: the author preferred the pile.) Open for
  the mobile pass: at 390 px the tilted cards run past the right edge, and
  the manifesto line clips on the right.
- **Astro on the Interfaz card (2026-10-28, author's ask).** Not in the
  dataset: added in the page frontmatter after Next.js, slice 10 → 11,
  SPIKE-only like DeltaDictum. The real build adds it as a `Skill` in
  `content.es.json` (+ en, `i18n:lock`, `og:local`, and the PDF must still fit
  2 pages). The cards went from aspect 3.3 to 2.9 so 11 chips fit.
- **Icon + name on every chip (2026-10-28, author's call after the
  recommendation: never icon-only — the first reader is often not
  technical).** Brand marks from `simple-icons` (CC0, devDependency, inlined
  as SVG at build time: zero JS), mapped by skill id in `v2.astro`. No mark
  of their own, so a drawn line icon that says what the thing is: Jotai →
  one atom (nucleus + one orbit), Playwright → a theatre mask (its own logo
  is a pair), CI/CD → the DevOps infinity loop, Monorepos → one box holding
  four packages, AI-assisted → the sparkle. Cards widened to `min(40vw,
  540px)` to fit; on phones aspect 3.6 → 3.1 and the stack 300 → 360 px —
  checked at 390 px: no chip overflows, nothing collides.
- **Accent → muted violet** `#9b8ce8` (faint `#1e1a2e`), overriding the tokens
  on /v2 only. 6.4:1 against `--bg` both ways. The favicon, OG card, logo
  geometry consumers and `/cv` keep the terracotta until the palette is
  decided for real.

### Iteration 5 (2026-10-26)

- **Deeper violet, split in two.** `--accent: #5e4bc4` for SURFACES (the C,
  "Quién soy" background, buttons, tokens), with light ink on it (5.5:1).
  `--accent-ink: #a99bf0` for TEXT and thin marks on dark (7.6:1): kickers,
  labels, rails, picked seats, the map ramp's top. "Quién soy" flipped to light
  ink on the deep violet.
- **Chapter 5, "Recorrido"** (`src/scripts/v2/journey.ts`). NOT pinned —
  plain scroll after two pinned chapters, as a change of rhythm. Left: the four
  stages in order (range, duration, `formatRoleTitle` — so Hogarth carries
  "(en paralelo)" per rule 2 —, context, two achievements). Right: a sticky
  toolbox with the year and a skill count; each skill pops in at the stage of
  its FIRST use in an achievement's `skillIds` (derived, not typed). On phones
  the toolbox rides at the top showing only the stage's new skills.
  Story it tells from the data: 2020 Vue/Quasar/Django/Docker/WordPress →
  2022 React/Next/Mapbox/Node/CI/CD → 2023 TypeScript/Git → 2024 Vite,
  monorepos, Jotai, PHP, Ruby, Material UI.
- Open question: "Quién soy" still has its own short career line; with
  "Recorrido" in place it may be redundant.

### Iteration 6 (2026-10-26) — two more chapters before "Recorrido"

Order now: Intro (pin) → Map (pin) → Seats (pin) → **Audiences** (free) →
**DeltaDictum** (free) → Recorrido (free). The two new ones are plain scroll
on purpose: four pinned chapters in a row would be the "long sequences read
as broken" risk from the report.

- **Audiences** (`src/scripts/v2/aud.ts`), from `adsmovil-audiencias`
  (priority 1, not used until now; another employer, another skill: complex
  logic made into an interface). Sticky Venn (edad / rubro / localidad);
  each text step switches the operator — AND, OR, XOR, NOT, and a closing
  `(edad AND rubro) OR localidad` — the region fills, 170 illustrative people
  dots light up when they belong, and the count follows. Labeled
  "ilustrativo".
- **DeltaDictum** (`src/scripts/v2/dd.ts`), the author's own product. A
  terminal demo (the memory arrives before the edit; illustrative, based on a
  real benchmark task), 1,883 recorded agent runs, project requirements met
  alone vs with DD (Opus 5.5 69% → 100%, Haiku 5.5 43% → 96%; 26
  pre-registered tasks, 4 projects), the benchmark's clearest finding AGAINST
  DD stated plainly (candor after the proof), and the facts: v1.1.0 on npm,
  3 harnesses + 2 in preview, zero dependencies / model calls / network,
  first commit 2026-09-10 → 1.0 on 2026-10-22.
- ⚠ **DeltaDictum is NOT in the dataset.** Its figures live as constants in
  `src/pages/v2.astro`, copied from the supermem repo (README, CHANGELOG,
  `site/src/config.js`, `docs/benchmarks/2026-10-bench-full.md`). Before the
  real build it must become a Project + Achievements in `content.es.json`
  (and the English translation), with those files as metric `source`s —
  invariant 4 and the single-source rule.
- Other repos in `C:\dev` (KEDO 1.0.0, Project-Patriark, Orquesta,
  IntelliForm, Merchan7…) are not in the dataset either; none is featured
  without the author choosing it.

### Iteration 7 (2026-10-26) — author's feedback on iteration 6

- **Audiences removed.** The author did not like it. `aud.ts` deleted.
  The slot for a second career highlight stays open.
- **DeltaDictum redone after its OWN site** (`cribbnicolas.github.io/deltadictum`,
  source in `C:\dev\supermem\site`), which is what the author asked for:
  the claim ("Lo que tu código no dice, dicho en el momento justo"), the live
  Claude Code session where the [TRAP] memory arrives inside the edit (same
  steps and timings as DD's hero, played while on screen), "Cómo funciona" in
  three steps with DD's own drawings ported and recolored with the tokens
  (SMIL replaced by CSS `offset-path` so colors come from variables), the
  install commands, and four facts (v1.1.0 npm, 3 + 2 harnesses, first
  commit → 1.0 dates, PolyForm Shield).
- **The benchmark is NOT public**: every number from it is gone (runs,
  requirement rates, hook latency, the Haiku finding). Do not bring it back.

### Iteration 8 (2026-10-26) — the last two chapters

- DD: the install block is gone; a single link to its documentation.
- **Cómo trabajo** (`src/scripts/v2/work.ts`), plain scroll, calm. Headline
  (provisional, mine): "La IA escribe rápido. Lo que entra al repo lo decido
  yo." — the stance of `summary.long`. Three principles (AI with review on my
  side; no invented numbers, "~" put by code; the ATS CV untouched and
  guarded), then the limits LAST: "Español nativo · Inglés A2" from
  `view.languages`, remote from Rosario UTC-3. Beside it, a sticky panel
  with the 15 blocking steps of `content-validation.yml`, in order, ticking
  as the reader scrolls, ending in "listo para publicar". Spike: the list is
  typed in the page; the real build should read the workflow file.
- **Cierre** (`src/scripts/v2/close.ts`), short pin: the C returns, turns
  into place, and a button grows INTO its hole — "Descargar CV · PDF", same
  `paths.pdf` as the dock, `download` named by `pdfFilename`. Next to it the
  closing line straight from `summary.long` ("Busco trabajo de full stack y
  freelance cuando hay un producto atrás, no una landing más."), the file
  name, email, GitHub, LinkedIn. Footer: name, city, and "Para agentes:
  llms.txt · cv.json".
- Full order now: Apertura → Quién soy → Mapa → Nada se pierde →
  DeltaDictum → Recorrido → Cómo trabajo → Cierre. ~26 screens on desktop.
- Mobile rough edges added: the CI panel is not sticky on phones, so its
  ticking happens off screen.

### Iteration 9 (2026-10-26) — close fixed, general polish

- **Close no longer pinned.** The pin started with the C invisible, so a
  full empty screen sat between "Cómo trabajo" and the close. Now its
  entrance is scrubbed while the section rises (top 90% → top 15%).
- **Download button = two half-discs in the C's hole: ESP | EN**, each its
  own PDF (`/cv.pdf`, `/en/cv.pdf`) named by `pdfFilename` from its OWN
  dataset's `updatedAt`. Each half leans toward its side on hover.
- **Polish pass:**
  - one vertical rhythm `--section-pad` for every free-scroll chapter; the
    last journey stage no longer leaves a screen of dead air;
  - the cards' thickness fades as they turn flat (it showed as dark stripes);
  - "Quién soy" kicker without the stray "00";
  - CI panel shows a running count (n/15); on phones it is a sticky strip of
    marks under the dock, so the ticking happens on screen;
  - phones: seats chapter compacted (hall, cart, surfaces, card) so the cart
    stays visible; map result card drops the redundant bars; hero ring lower;
  - reduced motion: chapters keep the page gutter, no scrim;
  - spike type errors fixed: `astro check` 0 errors, 0 warnings.

### Iteration 10 (2026-10-26) — two transitions

- **Quién soy → mapa: the C shrinks away.** "Quién soy" ends by lifting its
  content off, leaving bare violet. The map chapter opens with ITS C scaled
  26x around a point inside the body — the same violet — and shrinks it back
  (`uncover()` in `peak.ts`, the exact reverse of the intro's `cover()`), then
  a quarter turn and a fade. The map is underneath the whole time. The old
  dive-through-the-hole and its clip-path are gone.
- **Mapa → asientos: aerial descent.** The map's last beat drops a marker on
  one point; the camera tips to 62° and dives at it until only the marker is
  left. The seats chapter's hall takes the marker's exact place as a speck
  seen from straight above, grows while tipping into perspective (58°) as the
  seats fill in, then levels out and glides to its resting place. Driven by a
  proxy progress + measured offset, so a resize only re-measures.
- **No seams: chapters overlap.** `overlap()` in `main.ts` pulls the map and
  seats sections up by one screen (`-innerHeight` px, re-applied on every
  refresh) and stacks their stages above the previous one. A pinned chapter
  is covered from below during its pin's last screen, so the intro and the
  map each end on a 1-screen HOLD whose frame equals the next chapter's
  first frame (bare violet; dark + marker). The seats stage is transparent so
  the marker shows through until the hall replaces it.
- Iteration 10b: the C no longer turns-and-fades at the center. It shrinks
  and ROLLS OFF TO THE LEFT (moving left while turning counter-clockwise),
  the exit overlapping the end of the shrink so it never parks at the center.
- Iteration 10c (author): **no marker.** The pulsing dot read as a bug and
  is gone. Instead, while the map fades, a COPY of the seats chapter's hall
  (`ghostHall()` in `peak.ts`: cloned, data-* hooks stripped) appears at the
  center in perspective (`GHOST` pose: scale 1.1, rotateX 55°), seats
  filling in. When the seats chapter pins, the real hall takes that exact
  pose and glides right into its place, leveling out. During the overlap the
  seats stage is transparent so the copy shows through.
- Iteration 10d (author, reviewed live in Chrome): the map no longer goes
  flat at the result beat — it keeps its perspective. The descent is now a
  MORPH: the map tips into the hall's exact pose (rotateX 55°, centered on the
  MAP's center, which sits right of the screen's by half the map's margin —
  `ghostCenter()`), the hall copy appears on that same plane and its seats
  fill in row by row while the map dissolves and through the hold; the real
  hall then starts from the identical pose and glides right. Bug found live:
  `fromTo` only applies what is in its "to", so the copy was never tilted —
  the pose jumped at the swap. Fixed.
- Iteration 11 (author: "revisá los bugs visuales"). Full top-to-bottom pass
  in Chrome at 1368x804, then fixed:
  - ~1.5 screens of static violet between "Quién soy" and the map: the
    content now lifts off DURING the hand-off screen (the map chapter rises
    over it as a violet curtain), and the uncover uses `power3.in` so the C
    stops covering the screen sooner. Residual violet ≈ 0.4 screen.
  - the map ran off the right edge from beat 2 on: `.peak__tilt` 82vw /
    1100px max, beat scales 1.0 / 1.04 instead of 1.1 / 1.18;
  - the seats lane ran under the beat text: `.seats__visual` 48vw / 680px;
  - queued AsyncPile tokens overlapped into one pill: 13% slots.
- Iteration 12 (author: "se ve ese seatmap, desaparece y aparece otro"):
  the copy is GONE. There were two halls — a copy in the map chapter and the
  real one in the seats chapter — each driven by its own lagged scrub, so on
  a real wheel they desynced: the copy vanished before the real one arrived,
  and the real one arrived already glided right. Now there is ONE hall: while
  the seats section slides up over the map's last screen, a scrub-free
  ScrollTrigger (`top bottom` → `top top`) holds it still at the map's center
  by counter-shifting its y by the stage's remaining offset, fades it in and
  fills its seats; the map dissolves underneath on that same screen. Once
  pinned, the same element levels out and glides right. The seats stage is
  `overflow: visible` for this, and its text scrim fades in only after the
  pin (`--scrim`), or its top edge cut the map as a hard line.
- Known: those two holds are ~1 screen each with nothing moving — the cost of
  the seamless overlap. Candidates to fill them if they feel dead.
Known rough edges: on phones the seats chapter's beat card covers the cart and
the surfaces; the about stack still crowds the manifesto on small screens.

## 10. Open questions

- (to fill as they come up)

### Map chapter polish (2026-10-28)

- **Every beat starts at the same height** on desktop: `.beats`/`.beat`
  anchored by their top (`clamp(96px, 26vh, 280px)`), not centered — centered,
  the beat with bars sat higher and the kicker jumped. Phones keep their
  bottom-anchored panel.
- **Artifacts twitch less**: each random offset is held ~70 ms instead of
  re-rolled every frame, amplitude halved (5 px / 2 px), flicker 0.7–1.
- **The sweep comes back**: after the index sweep (left → right, stops the
  artifacts) a second sweep runs right → left (`MapState.heal`) and paints the
  no-data cells with the ramp color of their neighbours' mean (Delaunay
  neighbours) — the white patches go and the map reads whole. The "clean"
  layer is drawn only where the return sweep has not passed: once the map
  dims both layers are translucent and the white showed through. Beat 04
  got 1.5 screens; the later beats moved +1.0 in timeline units.
- **Bars carry their numbers** (`~3-5 s`, `~500 ms`), from a new
  `formatMetricEnds()` in `content/schema/format-metric.ts` so the "~" keeps
  one home (rule 4; test added in `format.test.ts`). Bars animate `width`
  through `--w`, not `scaleX`: a scaled pill squashes its round ends, which is
  why the short one looked square. Ratio still 0.125 (500 ms over the 4 s
  midpoint of 3-5 s).
- **"~5 s", not "~3-5 s" (author, 2026-10-28):** the "~" already says
  "approximate", and the worst case against the best is not a lie. Changed in
  the DATASET, both locales, everywhere the figure appears (`metric.before`
  "5 s", `summary.long`, the achievement's `long`, the decision's `context`),
  `updatedAt` bumped, `i18n:lock` and `og:local` re-run; the PDFs still fit 2
  pages. The short bar is now a tenth of the long one.
- **Map cut off, again.** Two causes. (1) The map was sized by the viewport
  alone: on a 1366×720 laptop it ran under the beat text and off the right
  edge. Now `.peak__tilt` is sized by the free space right of the beats
  (`100vw − gutter − 30rem − 140px`, capped at 940px and 120vh, floored at
  40vw) and its margin centers it there. Checked at 1366×720, 1920×1080 and
  2560×1271, every beat plus the hand-off to the hall. (2) `build()` sized the
  canvas from `getBoundingClientRect()`, the TRANSFORMED box: a rebuild
  mid-tilt (resize) got a squashed height and cut the bottom. Now it reads
  `clientWidth`/`clientHeight`.
- **…and the coastline itself was cut (the real "lateral derecho
  cortado").** `shore()` reaches 1.22× its radius to the east: at RX 700
  around the center the coast ran to x 1651 in a 1600-wide world, so the
  canvas edge sliced the east lobe straight. Now RX 640 / RY 380, centered
  60 west and 55 south: the coast spans x 94–1518, y 89–910 — ~90 units of
  sea on every side.
- Note: `test:js` and `test:bundle` fail on `/v2` (inline module, Lenis
  listens for wheel). Expected for the spike — the real build has to add the
  page to `PAGES_WITH_JS` and revisit the no-wheel rule on purpose.

### Map → seats hand-off: districts become seats (2026-10-28)

Brainstormed five options with the author (cells → seats morph, dive into one
district, card flip, lights out, the scanner printing the hall); the author
took the recommendation: **the morph, with the lights**.

- `src/scripts/v2/morph.ts`. During the screen where the seats chapter slides
  over the map (the hall held at the map's center, in its pose), one district
  per seat (156, seeded, from the body of the map: `map.sites(n)`) shows as a
  point of light on the map, lifts off on an arc and lands on its seat. Each
  seat lights up in the accent as it lands, with a ring opening, and dims
  back to an ordinary seat by the end — row by row from the stage, like house
  lights. Paired by x so the flights run side by side instead of crossing.
- A pure function of the hand-off's progress, so it scrubs both ways. Both
  ends are measured from the DOM every frame — zero-size probes inside the
  tilted map (`.peak__probe`, read with `getBoundingClientRect`, which
  includes the 3D projection) and the seat circles — so the points start and
  land exactly on what is on screen, even with the map's pin lagging the
  scroll. One fixed canvas over both chapters (`.morph`, z 15, under the
  dock).
- The map now fades in place (no scale-up) and a beat later, so the points
  are seen to leave it. The hall's seats no longer pop in; they stay hidden
  until their district lands.
- **Flicker when dragging the scrollbar (author, 2026-10-28) — fixed.**
  Reproduced by measurement: after a native scroll of 60 px the hall moved
  60 px with the page and only came back on the next frame. The hall was
  "held still" by a JS counter-shift against the scroll; the wheel goes
  through Lenis (scroll and update in the same task) so it never showed, but
  a dragged scrollbar is scrolled by the compositor before JS runs, so that
  one-frame-late position got painted. Now the hall is reparented into a
  layer fixed to the screen (`.handoff`, same perspective as the stage) from
  the start of the hand-off to the end of the seats pin, at the exact box it
  has inside the pinned stage; outside that range it goes home and scrolls
  with its stage. No counter-shift is left, and the seats stage no longer
  needs `overflow: visible`. Same measurement after: 0 px of movement.
- Found on the way: the points' canvas only redrew on scroll events, but
  both ends follow the scroll with the pins' 0.7 s scrub — once the scroll
  stopped, the points froze while the hall kept easing. It now redraws every
  frame while the hand-off is under way.

### Seats chapter: scenes instead of scrub (2026-10-28)

- **Overlap fixed.** The cart and lane sat under the hall: since the hall
  moved into the fixed `.handoff` layer it had left its column, and the grid
  closed the gap. A spacer of the hall's height now holds its place while it
  is away.
- **Beats are scenes that play, not scrub (author: scrubbed, the message
  did not read).** The pin still measures where the reader is; reaching a
  beat swaps the text and PLAYS that beat's scene in time (2–4 s). Each
  scene opens by setting its own starting state, so it plays the same from
  either direction. The beat switch is decided once a frame on the ticker,
  never mid-refresh: the pin renders its timeline at several times while it
  refreshes, and acting on each one stormed scenes and left all four beat
  texts on screen.
- **The seats act out the flow** (new `.seat--pending`, breathing outline;
  `.seat--error`, red):
  1. El encargo — four seats picked one by one; each travels the Store API
     lane to the cart; map and cart agree, 4/4.
  2. Lo que se rompía — four quick clicks, four seats pending at once, four
     requests in flight; one loses the nonce and falls; that seat turns RED
     on the map, the cart has a hole where F·10 should be, 4/3 in red.
  3. La decisión — the same four pending seats, queued in AsyncPile ("uno
     por vez"); each is confirmed on the map only when its line lands in the
     cart.
  4. El resultado — reload, minicart and checkout appear one by one, and the
     four seats on the map pulse with each.
- Every beat's kicker sits at the same height (292 px at 2560×1271, checked
  per beat). Fits at 1366×720 too.

### DeltaDictum as the second hook (2026-10-28)

Brainstormed with the author. Transition: "starts like the switch-off, then
the page intercepts the reader" (B → A); content: the recommended sequence
(manifesto → race → annotated session). What the reader must leave with,
in the author's words: I build my own products, I improve my own working
environment while I work, and I understand how AI works — "de la mejor
manera que creas". My call: one idea carries all three — the page does to
the READER what DD does to an agent, then shows an agent with and without
the context it lacked.

- **The switch-off** (seats.ts, scrubbed): after the last seats beat, black
  bars close in to a hot line, the line to a dot (`.crt`, fixed, outside
  `<main>` so no pinned ancestor traps it). New token `--void`.
- **The interception** (seats.ts, PLAYS in time): on that black the dot flies
  to become a cursor and the page types, in DD's own format, `⏺
  Scroll(DeltaDictum)` → `PreToolUse:Scroll hook additional context` → a
  `[DECISION]` memory for the reader. The first time through it holds the
  scroll (Lenis stop/start via `scroller` in util.ts) until it has said it;
  later passes replay without holding. Its last screen is the one DD rises
  under, invisible (DD added to `overlap()`).
  The memory copy (`ddHook` in v2.astro) is PROVISIONAL — the author has to
  confirm the wording.
- **Act 1, the name** (scrubbed): "DeltaDictum." at up to 14rem, chars rise;
  the claim lights word by word; the lede.
- **Act 2, the race** (PLAYS when reached): the same prompt typed into two
  Claude Code sessions. Without DD the agent edits without `t.after`, an
  assertion fails, `close()` never runs and `node --test` hangs — a big red
  "Colgado · 0:0N" clock that keeps counting. With DD the PreToolUse hook
  delivers the `[TRAP]` first (the session glows), the edit uses `t.after`,
  big green "Terminó". Labelled "ilustrativo": DD's benchmarks are not
  public, so the race claims no numbers.
- **Act 3, the notes** (PLAYS): the left session goes, the right one slides
  into its place, and three notes (evidence + hash, rules not search +
  local, on time + shared by git) appear wired by dashed curves to the exact
  lines they explain, which light up.
- **After the pin**: "Un producto mío, hecho para la forma en que trabajo con
  agentes de código." + harnesses, checks, GitHub / docs, the four facts.
- Gotchas met: (1) a ScrollTrigger refresh renders the pins' timelines at
  their end — acting on it ran the interception at page load and held the
  scroll. Scene decisions now wait out refreshes (`refreshing` in util.ts,
  read on the ticker). (2) The slide in act 3 is measured from layout
  (`offsetLeft`), not rects: the left session is already moving.
- Phones: one column, notes under the session without their body text. Not
  reviewed on a device yet — part of the mobile pass.
- **Held, automatic scenes (author, 2026-10-28).** Two stretches now play on
  their own with the scroll HELD until they invite the reader on:
  1. The switch-off + interception: reaching the end of the seats chapter
     sets off the whole sequence in time (bars → line → dot, the dot glows,
     becomes the cursor, the command, the hook, the memory) and lets go when
     it says "Seguí bajando ↓" (~9.5 s). No longer scrubbed.
  2. The DD race + notes as ONE scene: the hung clock runs 3 real seconds,
     then races (power4.in) to 10:00 in 3 more; while it gets there the hung
     session leaves, the other slides over, the three notes come in, and
     "Seguí bajando ↓" lets go (~13.5 s).
  Holding (`holdScroll`/`releaseScroll` in util.ts): Lenis stopped (wheel,
  touch), wheel/touchmove/keys prevented, and `html.is-held` hides the
  overflow so a dragged scrollbar or a finger cannot move it either;
  `scrollbar-gutter: stable` keeps the layout from shifting. Played only
  going DOWN and only while that chapter's pin is on screen: coming back up,
  or jumping past it (scrollbar, link), the scene is shown finished and
  nothing is held. Verified in Chrome: scroll requests ignored for the
  length of each scene, honoured right after. Not yet tried on a real phone.

### Polish round (2026-10-28, author's review)

- **No dot left behind.** The blinking cursor now appears ON the switch-off's
  dot (bigger than it, covering it), the dot goes out underneath, and the
  cursor carries on to the command. The command's own `⏺` was dropped: it
  read as a second dot.
- **Less scroll to DD's title.** The stretch after the switch-off went from
  1 screen to 0.35, and DD's name now rises in its first 0.45 screens (the
  claim and lede after). ~0.5 screens from "Seguí bajando" to the title.
  This needed DD's stage to be see-through until it pins (`.is-lit`, set by
  a ScrollTrigger from its pin on): with a shorter last seats screen it now
  rises over the end of the last seats beat, which must stay visible.
- **The hung clock speeds up steadily**: s(t) = (e^(1.08·t) − 1) / 1.08 over
  6 s — 0:01, 0:06, 0:22, 1:09, 3:25, 10:00 — instead of 3 real seconds and
  then a jump. The hung session starts leaving around 1:00 and is gone by
  ~5 min; the notes and "Seguí bajando" come a second earlier (~12 s total).
- **Journey toolbox chips = the "Quién soy" chips** (icon + name pill), one
  size up. The icon is now one component, `src/components/v2/SkillIcon.astro`
  (simple-icons marks + the drawn ones), used by both lists; the journey's
  `fresh` skills carry their ids.
- **Close: the aura is whole.** It was the stage's background, so the
  stage's top edge cut it straight. Now a `::before` layer reaching 50vh above
  the stage, behind the previous section (z -1; that section has no
  background), with the stage clipped sideways only. No space added.
- **Close: the CV buttons play, not scrub.** The C turns in, the two halves
  pop out of its hole and the copy rises, in time, once the section is 40%
  up the screen; it rewinds if the reader scrolls back above it.
- **DD's title peeked in at the bottom** when the reader's scroll ran on into
  the switch-off: DD's stage rises see-through over the last seats beat, and
  its dimmed claim showed. Now the whole stage is `visibility: hidden` until
  it pins — on the stage itself, because GSAP leaves its children an inline
  `visibility: inherit` that beats a rule on the children.
- **The map → seats points missed their seats.** Measured: the seats' rects
  were right (red markers sat dead centre in the painted seats). The bug was
  the canvas: `scrollbar-gutter: stable` makes the fixed canvas 2545 px wide
  while its backing store was sized from `innerWidth` (2560), squeezing every
  point left — more the further right. Now sized from its own box
  (`clientWidth`). The landing glow is also drawn as the seat's projected
  ellipse, not a circle (a flattened seat under a round glow read as "next
  to it"). Same gutter fix for screen-centre maths (`ghostCenter`, the
  cursor taking the dot's place): `documentElement.clientWidth`.
- **The switch-off dot stuck out beside the cursor**: it now shrinks to the
  cursor's size and loses its glow first, and goes out in the same frame the
  cursor appears on it.
- **A jump and a flicker going from the interception to DD.** The black
  (`.crt`) was cut with `display: none` in the very frame the seats pin let
  go, DD's pin took hold and DD's stage turned visible — three switches in
  one frame, any of them a frame off showed. Now the black stays over that
  hand-off and dissolves, scrubbed, over DD's first 0.3 screens as the name
  rises (dd.ts); the seats-side `is-gone` toggling is gone. Measured per
  frame: DD lights up at crt opacity 1.00, then the black fades 1 → 0.
- The interception text sits at 40% of the screen, not centred: it grows
  downward as its lines come in and ended up low.
- The race's verdicts are footers: each session is a flex column with the
  screen taking the slack, so "Colgado" and "Terminó" sit at the same height
  at the bottom of both (measured: same top and bottom), whatever each
  printed above.

### "Descargar CV" from anywhere (2026-10-28)

The dock's and the hero's "Descargar CV" open an overlay (`cvmodal.ts`): a
dark, blurred scrim, and the close's C with its ESP / EN halves pulled up
into the middle of the screen. If the close is on screen, the C leaves its
own place (the original hides while it is away); from anywhere else it rises
from below the screen — the direction of the last section — turning into
place, and the halves pop out of its hole. Esc, a click on the scrim or ×
send it back the way it came. The scroll is held while it is open, the focus
goes to ESP and stays inside (Tab cycles ESP → EN → ×), and returns to the
button on close. A half downloads its PDF (its own href + download) and the
C goes back. The C is a copy of the close's, made once at init with its
data-* hooks and inline styles stripped. Without JS, the buttons still
download the Spanish PDF directly. Verified in Chrome from the top of the
page and from the close; Esc and scrim-click close it and release the scroll.
