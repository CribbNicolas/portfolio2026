# The CV PDF in English, and the name it is saved under

**Date:** 2026-09-02
**Slice:** 1 of 2. The rest of the English site — landing, agent endpoints, OG
card, language switcher — is [the second spec](./2026-09-02-en-site-design.md).

## 1. What this delivers

A reader can download the CV in English. Concretely:

- `content/data/content.en.json` exists and is a complete, valid dataset.
- `/en/cv` renders the same layout as `/cv`, in English, at zero JavaScript.
- `/en/cv.pdf` prints it, through the same Browser Rendering path `/cv.pdf`
  already uses.
- Both PDFs are saved under `Cribb_Nicolas_CV_<updatedAt>.pdf`
  (`_EN_` for the English one), and the date is the dataset's, not the clock's.
- `pnpm run test:i18n` says which Spanish fields changed since the English text
  was last written.

What this slice does NOT deliver: the English landing, `/en/cv.json`,
`/en/llms.txt`, an English OG card, `hreflang`, and a visible language
switcher. `/cv` is `noindex` and has no incoming links; `/en/cv` inherits both,
so none of that is needed for the PDF to work. It is spec 2.

## 2. Decisions taken

| Decision | Why |
|---|---|
| One dataset file per locale | The schema already declares it: `Locale`, `getDataset(locale)`, and the `DATASETS` map in `json-source.ts` with a comment saying "add content.en.json here once it exists". Adding a third language is one more file |
| Staleness through a lockfile of per-field hashes | An `updatedAt` per file says the whole translation is old the moment a date changes in Spanish. A hash per field says WHICH text drifted. Same pattern as `og.lock.json`, which already works |
| UI copy in a typed dictionary, not in the dataset | Section titles and "Download CV" are chrome, not atomic facts. A `Record<Locale, Messages>` makes a missing key a compile error, so no new gate is needed |
| Spanish at the root, English under `/en/` | No shared link breaks. The market is LatAm; Spanish stays canonical |
| The filename carries the dataset's `updatedAt` | Whoever holds two copies knows which is newer without opening them. And because each dataset carries its own, the English PDF's name shows on its face when the translation is behind |

This reverses a dated decision in `docs/00-index.md` ("No English dataset for
now — translating a CV produces translated English, which is worse than written
English"). The reversal is the author's call, made 2026-09-02. The mitigation is
that the English text is written and reviewed by the author, not machine-emitted
and shipped: this spec produces a draft, and the draft is content until a human
has read it. `docs/00-index.md` gets the new row.

## 3. Architecture

### 3.1 The data

```
content/data/
  content.es.json        The source. Always edited first.
  content.en.json        Same shape, same ids, English prose.
  translation.lock.json  path → hash of the Spanish text it was translated from.
```

`content.en.json` is a full dataset, not an overlay: it passes `datasetSchema`
and `checkRules` exactly like the Spanish one, which is what keeps `resolveView`,
the editor, `validate` and `format:data` unchanged. `locale: "en"` at the root.

Structural fields — ids, dates, `skillIds`, `visibility`, `confidence`,
`employmentType` — are IDENTICAL in both files. Only human text differs. That is
what `i18n.check.ts` enforces; it is not a convention.

`json-source.ts` changes by one line: `en: datasetEn` in the `DATASETS` map. The
`throw` for an unsupported locale stays, because a third language must fail loudly
rather than silently serve Spanish.

### 3.2 What is translated, and what is not

Every human string is translated and tracked. That includes three fields that no
page renders — `Metric.label`, `Metric.source` and `LanguageSkill.note` — and the
reason is `/cv.json`: it serializes the whole resolved view, so anything the view
carries is published to whoever reads that endpoint, rendered or not. "Not on the
CV" is not the same as "not published", and the lock follows what ships.

So: `Prose.short`, `Prose.long`, `headline`, `Role.title`, `Role.displayTitle`,
`Role.clientDescription`, `Project.name`, `Project.client`, `Metric.label`,
`Metric.source`, `Decision.*`, `LanguageSkill.note`.

If `Metric.source` should be internal — it is the author's evidence note, and one
of the two carries an API URL — the fix is `resolveView` dropping it from the
`public-api` surface, not leaving it untranslated. That is a separate decision
about rule 8's list, and this slice does not take it.

Proper nouns are not translated: company names, project client names,
technology names. They are the same string in both files, so their hash matches
and the lock stays quiet.

### 3.3 The staleness lock

```json
{
  "version": 1,
  "fields": {
    "identity.headline.short": "9f2a1c4e",
    "achievements.dinkum-mapbox.text.long": "3b71e0aa",
    "roles.dinkum.summary.short": "77c2d915"
  }
}
```

The key is a stable path built from **ids, not array indices**: reordering the
Spanish achievements must not invalidate every translation. The value is a hash
of the Spanish string at the moment the English one was written.

Two scripts, one shared walker:

- `pnpm run test:i18n` (`scripts/i18n.check.ts`) — **blocking, in CI.** Reports
  three separate failures, because they have three different fixes:
  1. **Structure drift** — an id, date, `skillId` or `visibility` that differs
     between the two files. Fix: correct the English dataset.
  2. **Missing translation** — a tracked path present in Spanish, absent or
     still holding the Spanish string in English. Fix: write the English text.
  3. **Stale translation** — the Spanish text's hash no longer matches the lock.
     Fix: update the English text, then re-stamp.
- `pnpm run i18n:lock` (`scripts/i18n-lock.ts`) — rewrites the lock from the
  current Spanish file. This is the "I have finished translating" command. It is
  the fix path the failing check points at, exactly as `format:data` is for
  `test:format`.

The check is blocking on purpose. A non-blocking report is a report nobody
reads, and the whole point of the lock is that "Spanish moved and English did
not" stops being invisible.

**The known cost:** `i18n:lock` stamps every path, so running it without
actually translating declares the work done. Nothing can detect that from the
outside — the same is true of `format:data` and of `og:local`. The gate catches
forgetting, not lying.

### 3.4 The filename

```ts
// content/schema/pdf-filename.ts
export function pdfFilename(locale: Locale, updatedAt: string): string
```

Pure, no I/O, one export. `updatedAt` is the dataset's ISO timestamp; only the
date part reaches the name.

```
es → Cribb_Nicolas_CV_2026-09-02.pdf
en → Cribb_Nicolas_CV_EN_2026-09-02.pdf
```

Underscores and not spaces: a space becomes `%20` in a URL and gets mangled by
some mail clients. The date is ISO so a folder with several copies sorts by age.

It lives in `content/schema/` and not in `functions/` or `scripts/` because it
derives display text from a dataset field — that is what `format.ts` and
`format-metric.ts` do — and because `src/`, `functions/` and `scripts/` all need
it. Four call sites, one definition:

| Call site | Uses it for |
|---|---|
| `src/pages/index.astro` | the `download=` attribute, which is what actually names the file on a click |
| `functions/_pdf.ts` | the `content-disposition` header, for a direct hit on the URL |
| `scripts/build-pdf.ts` | nothing user-facing; the local file stays `dist/cv.pdf` |
| `scripts/single-landing.check.ts` | asserting the two agree |

The Worker reads `updatedAt` by importing the dataset JSON directly
(37 KB per locale, no zod, no validation — it is one field). The alternative,
an environment variable, drifts the day somebody edits content and forgets
Cloudflare's dashboard. `PDF_FILENAME` stays supported as an override, because
it already exists and costs one `??`.

**`docs/03-cv.md` §2 currently fixes the filename as
`Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf` and files it under ATS. That
justification does not hold, and `docs/03` gets corrected along with the name.**

An ATS does not read the file name. It extracts the document's text — that is
what `pdf-output.check.ts` layer 1 tests, and it is why the fonts and the
one-column layout matter. What the name actually does is show up in the ATS's
list and in the recruiter's mail client, both of which truncate around 30-35
visible characters. At 47, the old name spent its length on words the parser
never reads and got cut exactly where the role was.

The new name is 31 characters, 34 in English. It fits whole, and the date gives
a folder holding several copies an order. The visible trade is that the reader
sees the date too: a timestamp from a few months back can read as neglect even
when nothing needed changing. Recorded because it is a real cost, and because
`updatedAt` moving on every save is what makes it small.

### 3.5 The pages

`src/pages/cv.astro` stays as it is and becomes the Spanish instance of a shared
component; `src/pages/en/cv.astro` is the English one. Both call
`content.getView("cv-ats", locale)` and pass `locale` down. The layout, the CSS
and the components do not fork: a second copy of the layout is exactly how the
HTML and the PDF drift apart, which is the thing `docs/04` was written to
prevent.

`no-client-js.check.ts` walks all of `dist/`, so `/en/cv` is covered the moment
it exists — `PAGES_WITH_JS` is an allowlist and `en/cv/index.html` is not on it.
That is the intended behaviour, not a gap.

The landing gets a second link next to the download button:

```
[ ↓ Descargar CV ]  [ Download CV (English) ]
```

Without it, the English PDF exists at a URL nobody is given. It is one anchor
with a `download` attribute; the English landing that would house it properly is
spec 2.

### 3.6 The Function

`functions/en/cv.pdf.ts` — Pages routes by path, so the file's location IS the
route. Both handlers are the same code with a different source path and locale,
so `functions/_pdf.ts` grows a factory:

```ts
export function createPdfHandler(locale: Locale): (ctx: Context) => Promise<Response>
```

`requestBody(origin)` becomes `requestBody(origin, locale)` and builds
`/cv` or `/en/cv`. `cacheKey` needs no change: it keys on the request URL, and the
two URLs differ.

`_pdf.test.ts` already exists to guard that the served PDF asks for the same
options as the tested one. It gains: the English handler prints `/en/cv` and not
`/cv` (a copy-paste of the Spanish handler would silently serve the Spanish CV
under an English URL, and every existing test would still pass).

`astro.config.mjs`'s `localCvPdf` middleware learns `/en/cv.pdf`, mapping to
`public/en/cv.pdf`; `scripts/build-pdf.ts` prints both.

### 3.7 The UI copy

`content/schema/messages.ts`:

```ts
export interface Messages { experience: string; skills: string; /* … */ }
export const MESSAGES: Record<Locale, Messages> = { es: {…}, en: {…} };
```

A missing key does not compile, so no runtime check is needed. The Spanish values
are moved out of the components verbatim — this slice must not reword Spanish
copy while it is translating it, or the review cannot tell a translation from a
rewrite.

`format.ts` and `skill-groups.ts` take a `locale` parameter. They are the files
of rules 1 and 2 and the shared skill taxonomy; both currently return Spanish
strings, and both are consumed by the CV and by `/llms.txt`. Their signatures
change, which is why `invariants.test.ts` and `format.test.ts` are part of this
slice's work rather than an afterthought.

Anything `formatMetric` emits stays inside Manrope's `latin` subset in both
languages. That is already a test, added the day `→` reached the PDF.

## 4. Testing

New:

- `scripts/i18n.check.ts` (`test:i18n`) — structure parity, missing
  translations, stale translations. Blocking, in CI.
- `content/schema/pdf-filename.test.ts` — the name, the date extraction, the
  locale marker, and that the output has no character needing URL escaping.

Extended:

- `test:format` — `content.en.json` is committed in canonical form too.
- `test:pdf` — runs against both PDFs. `PDF_SOURCE` already parameterizes it.
- `test:landing` — `/en/cv` is `noindex`, and the two download links carry the
  filenames `pdfFilename` computes.
- `test:js` — no change needed; it walks `dist/` and the allowlist is unchanged.
- `smoke-deploy.yml` — verifies the published `/en/cv.pdf` as well as `/cv.pdf`.

Unchanged and deliberately so: `resolveView`, `checkRules`, the editor, and every
visibility test. Two full datasets of the same shape is precisely the choice that
buys that.

## 5. Order of work

1. `pdf-filename.ts` + its test. Rename the Spanish PDF, update `docs/03`. This
   ships value on its own and touches no i18n.
2. `messages.ts`, and `locale` through `format.ts` / `skill-groups.ts`. Spanish
   output byte-identical — the existing tests are the proof.
3. `content.en.json`, drafted from Spanish, plus `translation.lock.json`.
4. `i18n.check.ts` + `i18n-lock.ts`.
5. `/en/cv`, the second download link.
6. `functions/en/cv.pdf.ts` + the handler factory + `_pdf.test.ts`.
7. `astro.config.mjs` and `build-pdf.ts` for local parity; smoke for production.

Steps 1 and 2 are refactors with no behaviour change and can land first. Step 3
is the only one that is content rather than code, and it is the one that needs
the author's eyes.

## 6. Open question for the author

The English text of step 3 is a draft translation until reviewed. The three
places where a literal translation is most likely to read wrong, and which are
worth reading first:

- `identity.headline.long` — the personal register does not survive a literal
  pass.
- The Hogarth role, written to say a lot while naming nothing (NDA).
- `Metric.label` — "distritos escolares en el dataset" reads as a schema note in
  English unless it is rephrased.
