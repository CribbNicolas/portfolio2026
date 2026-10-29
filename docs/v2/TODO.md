# Landing v2 — TODO (next session, from 2026-10-29)

What is left before `/v2` can ship. The history of every decision is in
`landing-v2-notes.md`; this file is only the list.

## 1. Author's review at the six resolutions

Check by eye how the page looks at the resolutions of the compatibility pass
(`landing-v2-notes.md`, "Compatibility pass"): 375×667 (iPhone SE/8),
390×844 (iPhone 12–15), 412×915 (Android), 768×1024 (iPad portrait),
1366×768 (laptop), 1920×1080 (desktop). Chrome DevTools device mode is
enough; scroll the whole page at each one.

- [ ] Also on a real phone at least once (iOS Safari and Android Chrome).
      Everything so far was emulated: held scroll (Lenis stop + `is-held`),
      `svh` heights and the touch cue have never run on real hardware.
- [ ] Check the reduced-motion path (the "still" page) once more after the
      layout changes.

## 2. English version of v2

- [ ] `/en/v2` (or wherever the English landing ends up) from the same page,
      the way `/en/` shares `HomeDocument` with `/`.
- [ ] The hard-coded Spanish strings in `v2.astro` and the chapter scripts
      (beats, seats scenes, interception, DD manifesto/race/notes, journey,
      CI, close) move to a per-locale table — `messages.ts` style, so a
      missing translation is a compile error.
- [ ] Data shown by v2 already comes from the dataset, so `content.en.json`
      covers it; check `formatMetricEnds` output in English.

## 3. v1 becomes the "simple version"

The current landing (`/`, `/en/`) stays as the light, no-guided-tour
version that the hero of v2 links to ("Ver la versión simple").

- [ ] It needs a few changes — the author has the details.
- [ ] A better name than "versión simple". Candidates: "versión clásica",
      "versión directa", "lectura rápida", "vista breve".
- [ ] Its URL once v2 takes `/` (today the link points at `paths.home`,
      which is v1 itself while both live side by side). `/cv` cannot be it:
      it is the PDF source and takes no incoming links.

## 4. Also pending (found along the way)

- [ ] **Confirm the provisional DeltaDictum copy**: the `[DECISION]` memory
      typed in the interception (`ddHook` in `v2.astro`) and the closing
      line "Un producto mío, hecho para la forma en que trabajo con agentes
      de código."
- [ ] **Data instead of hard-coding**: DeltaDictum (project) and Astro
      (skill) are written straight into `v2.astro`. They belong in
      `content.es.json` (then EN, `i18n:lock`, `og:local`) — invariant 4,
      nothing invented.
- [ ] Open from the research round (`landing-v2-notes.md` §7), check if still
      open: a hook sentence that passes the voice test, and whether the RPPL
      client allows showing the map's shape.
- [ ] **The gates.** `test:js` and `test:bundle` fail on `/v2` today:
      - the page is not in `PAGES_WITH_JS` (`scripts/pages-with-js.ts`);
      - Lenis registers a `wheel` listener and the held scenes block
        `wheel`/`touchmove`, which CLAUDE.md's map rule 5 forbids. That rule
        was written for the 3D map ("the browser arbitrates, not us"); v2's
        held scenes are a deliberate exception and need an explicit
        decision, written into CLAUDE.md and the check, not a silent
        allowlist;
      - the bundle budget needs a ceiling for v2's chunk (72 KB gzip today).
- [ ] Run the full sequence from CLAUDE.md, then Lighthouse again (last run
      before the compatibility pass: mobile 93–94, desktop 99, CLS 0).
- [ ] Branch flow (`docs/08`): the spike goes through `feature/*` →
      `develop` with a version bump.
