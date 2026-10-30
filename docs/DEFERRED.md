# Deferred

Analysed, not worth doing now; the idea is kept. Each item says why it waits
and, where there is one, what would bring it back. When one is picked up, it
moves to the TODO list in `docs/TODO.md`; delete it here only once it is done.

## Accessibility (audit of 2026-10-30)

axe-core 4.10 over 12 page/state combinations (landing desktop, phone,
reduced motion, no JS, CV dialog open; brief view, popover open; /cv, /en/cv;
404), plus keyboard, reflow at 320 px, 200 % zoom and Windows high contrast.
What was cheap and safe shipped with landing v2 (axe at 0 violations). These
wait because each one touches the chapters' mechanics or needs the author:

- **Keyboard never reaches the close, and screen readers miss the scenes.**
  The close (ESP/EN halves, mail, GitHub, LinkedIn) and, on a first pass,
  DeltaDictum's CTA stay `visibility: hidden` until the scroll reveals them,
  so Tab skips them (WCAG 2.1.1, A). The same cause keeps the map and seats
  beats, DD's notes and the work principles out of the accessibility tree
  until they are on screen (1.3.1, A); the CV chapter carries the facts.
  Fix: reveal on focus, or hide with opacity only (GSAP `autoAlpha` sets
  visibility). Touches every chapter; re-sweep the resolutions after.
- **200 % zoom on a 1366×768 laptop (683×384 CSS px).** The pinned stages are
  a fixed 100svh with `overflow: hidden`: the hero's buttons and DD's
  terminals are clipped (1.4.4/1.4.10, AA). Proposal: below ~450 px of
  height, show the reduced-motion static composition. The author decides.
- **Endless motion with no pause (2.2.2, A).** The turning C (close, CV
  dialog, brief view's background), DD's blinking caret, the CI spinner and
  the scroll cue run forever; only the OS's reduced-motion setting stops
  them. Options: stop after a few seconds, or a pause control. The author
  decides.
- **Small ones that need a test first.** A "Saltar al CV" skip link (check
  the jump under Lenis and the pins, and that it does not trigger DD's
  hold); `autofocus` on the popover's first half (check it never takes the
  focus on load); the CV dialog's × inside its `role="dialog"` (it needs
  `position: fixed` and `pointer-events: auto` there; re-test the dialog
  animated, reduced, backdrop click and Esc).
- **Smaller still.** With JS, "Descargar CV" keeps announcing the native
  popover's state ("collapsed") while the animated dialog is open:
  `aria-haspopup="dialog"`, and let cvmodal.ts drop `popovertarget`. The held
  scenes block the scroll keys for a few seconds: let Esc or Tab skip them.
  The dock is 34 px tall (passes 2.5.8's 24, under the 44 advised on
  phones); the brief view's project links are 23 px.
- **A real screen-reader pass (NVDA)** over the landing: the audit was
  automated plus code reading.

## Product and content

- Per-posting CV: a generator that emits the exact `Skill.aliases` variant a
  job post uses, and a JSON Resume mapper. Wait for a concrete need.
- Own domain, then update `SITE_URL`.
- Blog: never decided.
- JSON-LD `CreativeWork` per project: little value while case studies have no
  page of their own; today only `Person` is emitted.
- JWD Maderas: unpublished until the author finishes it; links, outcome and
  metric come with the launch.

## Technical

- Sanity (or any CMS): only if the local editor stops being enough. It costs
  `sanity-source.ts` plus one line in `content/source/index.ts`.
- zod 4: its own PR, gated by `editor/schema-adapter.ts`'s tests.
