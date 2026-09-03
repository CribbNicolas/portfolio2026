# Close remaining technical debt

> **For agentic workers:** execute one wave at a time. Do not mix waves in a single PR. Each PR into `develop` must raise `package.json.version` (`docs/08-branches-and-versioning.md`). After each wave, move the closed numbers into the Resolved table of `docs/07-technical-debt.md` and keep the original numbers — never renumber.

**Goal:** `docs/07-technical-debt.md` has zero open entries, the leftover bilingual commit is on `develop`, and the four Spanish-only leftovers named in `docs/00-index.md` (`/en/llms.txt`, `/en/cv.json`, English OG card, bilingual 404) plus a voice pass on `content.en.json` are done.

**Architecture:** five independent waves, each a `feature/*` branch off current `develop` (`af7c4ea`, `0.20.0`). Waves share no code except Wave 4 consuming `LOCALE_PATHS` from Wave 2. Close-by-accepting (#6, #28) is a docs move, not a tunnel or an eviction Map.

**Tech Stack:** Astro static, Zod 3.25, local editor (`editor/`), `messages.ts` + `translation.lock.json`, Cloudflare Pages Functions for PDFs only.

**Spec:** `docs/07-technical-debt.md` (entries 6, 19–23, 25–28, 31, 33, 34, 38–42) plus the bilingual leftovers in `docs/00-index.md` / `docs/10-i18n.md` §6. The leftover commit `d0476c1` on `feature/cv-en-pdf` is the source of entries #40–#42 and those 00-index bullets — it never landed in the #25 merge.

## Global Constraints

- Spanish is edited first; English is a translation. Invariant 4: never invent metrics, dates, clients or a fake `Service` in the committed datasets. Synthetic fixtures in tests are allowed.
- Identifiers, comments, docs, commit messages in English. User-visible strings stay in that surface's language.
- Frontend never filters by `visibility` and never computes durations (invariants 1 and 3).
- `/cv` and `/en/cv` stay at zero JS. 404 stays at zero JS. `PAGES_WITH_JS` is only `/` and `/en/`.
- Zod mirrors interfaces 1:1, `.strict()`, same commit.
- Do not push to `develop`/`staging`/`main`. PR + version bump.
- Full gate before calling a wave done: `pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run test:i18n && pnpm run test:editor && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:endpoints && pnpm run test:og && pnpm run audit:todos`. Skip `test:editor` / `pdf` / `og` only when that wave cannot have touched them, and say so.

## Decisions already locked

| Decision | Choice | Why |
|---|---|---|
| #6 Function not testable E2E locally | **Accept and close.** No `cloudflared` tunnel. | The smoke already prints the published PDF. A tunnel is infra for a one-minute preview. |
| #28 write-queue Map never evicts | **Accept and close.** | The process writes one path. Eviction is more machinery than the leak. |
| #21 `periods` in `INLINE_ELEMENT_ARRAYS` | **Keep, with a comment** that it is currently unreachable because `skills` is already inline. | Deleting it would be undone the day `periods` appears outside `Skill`. |
| #42 chrome copy without accents | **Allowlist of keys that MAY be identical** across `MESSAGES.es` / `MESSAGES.en`. Every other key must differ. `downloadCvOtherLocale` stays the existing other-locale exception. | Today the only legitimate identical is `emailLabel: "Email"`. |
| #38 four types without `id` | Add `id` to `Link`, `Media`, `TechnicalDecision`. For `LanguageSkill`, **do not add a second identifier** — `arrayKey` falls back to `code`, and `code` joins `NOT_TEXT`. | `code` already exists and is unique (`es`/`en`). Decisions **are** populated (RPPL 3, Woo 3, Muse 2, JWD 1) — the 07 text saying they are empty is stale. |
| #39 `Service.name` | Override in `i18n-fields.ts` + unit test on a **synthetic** service. Datasets stay empty. | Invariant 4. |
| #22 serializer coverage | Synthetic fixture in `editor/serialize.test.ts`. No fake metrics in `content.es.json`. | Same. |
| #19 `_def` open bag | Discriminated union **now**, not waiting for zod 4. | Zero open entries. Zod 4 will still reopen this file; the union just makes today's typos a compile error. |
| 404 | **Bilingual in one page.** Spanish block first, English below. Links to both landings via `ANCHORS` + `LOCALE_PATHS`. | Cloudflare Pages only serves root `404.html`. A per-prefix 404 needs a Function; 404 must stay zero JS. |
| OG | Two committed images: `public/og.jpg` (es) and `public/og.en.jpg`. `Base.astro` picks by `locale`. | One fingerprint per image in `og.lock.json`. |
| English copy | I rewrite; you review voice (`docs/02-branding.md`) before merge of Wave 4. | Lock detects stale, not bad. |
| Wave 4 translations | I write them. Headings that move into `messages.ts` get both locales in the same commit. | You said so. |

Out of this campaign (product/data, not 07): LinkedIn blocks, case studies, first real `Service`, remaining metrics, `Skill.periods` history, designed CV-A, promoting `develop` → `staging`.

---

## Catalog

| # | Severity | Close by | Wave |
|---|---|---|---|
| 6 | low | Accept (smoke is the test) | 0 |
| 19 | low | Discriminated `ZodDef` union | 3 |
| 20 | very low | `describeObject()` helper, drop the cast | 1 |
| 21 | very low | Comment on `periods` in the inline table | 1 |
| 22 | low | Synthetic serializer fixture | 3 |
| 23 | low | Inject serializer; one `SerializationError` test | 1 |
| 25 | low | Structural `DatasetApi` interface | 1 |
| 26 | **medium** | `unhandledRejection` / `uncaughtException` in `scripts/editor.ts` | 1 |
| 27 | very low | Case-fold queue key on `win32` | 1 |
| 28 | negligible | Accept | 0 |
| 31 | low | Update the one nav button on `id`/`code`/`name` change | 1 |
| 33 | low | Shared `tempDir()` that `rm`s in `test.after` | 1 |
| 34 | low | `reference` hint must sit on a string | 1 |
| 38 | low | `id` on Link/Media/TechnicalDecision; `code` as array key | 3 |
| 39 | low | `isServiceName` override + synthetic test | 3 |
| 40 | low → medium | `LOCALE_PATHS` next to `ANCHORS` | 2 |
| 41 | low | Scroll-margin emitted from `ANCHORS` | 2 |
| 42 | low | Identical-keys allowlist in `messages.test.ts` | 2 |
| — | leftover commit `d0476c1` | Cherry-pick onto develop via Wave 0 | 0 |
| — | `06` still lists #7 as open | Rewrite phase 3 | 0 |
| — | `/en/llms.txt` + `/en/cv.json` | Factory + `messages.ts` headings | 4 |
| — | OG card Spanish on `/en/` | Second image | 4 |
| — | 404 Spanish for both | Bilingual one-pager | 4 |
| — | English dataset reads translated | Voice pass | 4 |

Starting version: **0.20.0**. Waves bump 0.21 → 0.22 → 0.23 → 0.24 → 0.25.

---

## Wave 0 — Inventory on `develop`

**Closes:** leftover `d0476c1`, #6, #28, stale phase 3 in `06`.
**Version:** 0.20.0 → **0.21.0**
**Branch:** `feature/debt-inventory`

### Why first

`develop` does not contain #40–#42. Planning against `07` as it sits on `develop` would drop three entries. Phase 3 in `06` still claims #7 is open; it is in the Resolved table.

### Files

- Cherry-pick: `d0476c1` (`docs/00-index.md`, `docs/07-technical-debt.md`)
- Modify: `docs/06-next-session.md` (phase 3: #7 gone, #6 accepted, recount)
- Modify: `docs/07-technical-debt.md` — move #6 and #28 to Resolved with the acceptance reason; keep #40–#42 open until Wave 2
- Modify: `package.json` version

### Steps

1. `git checkout develop` (already at `af7c4ea`). `git checkout -b feature/debt-inventory`.
2. `git cherry-pick d0476c1`. If it applies clean, keep the original message. If not, replay the two file hunks by hand.
3. In `06` §3, replace the #7 bullet with “closed (`Viewed<T>`, 0.20.0)”. Replace the #6 bullet with “accepted: the smoke is the E2E; a tunnel is not worth it”. Update §6 “State at close” recount: open list is whatever Wave 0 leaves (everything except 6 and 28, plus 40–42 now visible).
4. In `07` Resolved table, add rows 6 and 28. Delete (or collapse to a one-line “accepted, see Resolved”) the long #6 and #28 sections so they cannot be rediscovered as open work.
5. Bump version. Commit. PR into `develop`.

### Done when

- `gh pr view` of this branch shows #40–#42 in `07` on the PR diff.
- `06` no longer tells the next session to do #7.
- `bump` gate is green (`0.21.0`).

---

## Wave 1 — Editor nets

**Closes:** #20, #21, #23, #25, #26, #27, #31, #33, #34
**Version:** 0.21.0 → **0.22.0**
**Branch:** `feature/debt-editor`
**Depends on:** Wave 0 merged (so `07` numbers exist). Independent of Waves 2–4.

Highest remaining severity is **#26** (medium). Clustered because every file lives under `editor/` + `scripts/editor.ts` + `scripts/editor-page.check.ts`.

### 1.1 `#33` shared `tempDir()`

**Files:** create `editor/temp-dir.ts`; modify `editor/static.test.ts`, `editor/api.test.ts`, `editor/store.test.ts`, `scripts/editor-page.check.ts`.

```ts
// editor/temp-dir.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

const pending = new Set<string>();

after(async () => {
  for (const dir of pending) await rm(dir, { recursive: true, force: true });
  pending.clear();
});

export async function tempDir(prefix = "editor-"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  pending.add(dir);
  return dir;
}
```

One `after` for the process, not per test — that is what avoids deleting a directory another still-running test is reading (the reason this was deferred).

**Test:** run `pnpm test` twice; `%TEMP%\editor-*` count from this suite does not grow. `scripts/editor-page.check.ts` uses the same helper for its dataset copy.

### 1.2 `#25` structural store + `#23` injectable serializer

**Files:** `editor/store.ts`, `editor/api.ts`, `editor/store.test.ts`, `editor/api.test.ts`.

```ts
export interface DatasetApi {
  read(): Promise<DatasetSnapshot>;
  write(input: unknown, expectedEtag: string): Promise<DatasetSnapshot>;
}

export type SerializeDataset = (data: ContentDataset) => string;

export class DatasetStore implements DatasetApi {
  constructor(
    private readonly file: string = DATASET_FILE,
    private readonly serialize: SerializeDataset = serializeDataset,
  ) {}
}
```

`handleApi(request, store: DatasetApi)`. `writeExclusive` calls `this.serialize` instead of `serializeDataset`.

**Tests:**
- `store.test.ts`: construct with `() => "{}"` (or any text that parses to something other than the input); `write()` rejects with `SerializationError`; file unchanged.
- `api.test.ts`: pass `{ read: async () => { throw new Error("boom") }, write: async () => { throw new Error("boom") } }` and assert the 500 path (or whatever `server.ts` already maps). `tsc` must accept the object.

### 1.3 `#20` `describeObject()`

**Files:** `editor/schema-adapter.ts`, `editor/schema-adapter.test.ts`.

```ts
export function describeObject(schema: ZodTypeAny): ObjectDescriptor {
  const described = describe(schema);
  if (described.kind !== "object") {
    throw new UnsupportedSchemaError(
      `dataset schema is ${described.kind}, not object`,
    );
  }
  return described;
}

export const datasetDescriptor = describeObject(datasetSchema);
```

**Test:** `describeObject(z.string())` throws `UnsupportedSchemaError`. Existing import-time tests keep passing.

### 1.4 `#34` `reference` on a string

**Files:** `editor/hints.test.ts` only.

Mirror the textarea test:

```ts
test("a reference hint only ever sits on a string", () => {
  for (const [path, hint] of Object.entries(HINTS)) {
    if (hint.widget !== "reference") continue;
    assert.equal(descriptorAt(path)?.kind, "string", `${path} is not a string`);
  }
});
```

How to check it (from 07): pointing `"achievements[].skillIds"` at `{ widget: "reference", source: "skills" }` must fail this test.

### 1.5 `#21` comment on `periods`

**Files:** `editor/serialize.ts` — one comment on the `periods` entry of `INLINE_ELEMENT_ARRAYS`: currently unreachable because every `Skill` is itself an element of the already-inline `skills` array; kept so a future `periods` outside `Skill` prints the same way.

### 1.6 `#27` Windows queue key

**Files:** `editor/store.ts`, `editor/store.test.ts`.

```ts
function queueKey(file: string): string {
  const resolved = resolve(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
```

`write()` uses `queueKey(this.file)` instead of `resolve(this.file)`.

**Test (win32 only, or both with a mocked key):** two stores over the same file, one path with `C:\` and one with `c:\`; overlapping writes; the second sees `StaleEtagError` or serializes behind the first — both must not fulfil as success overwriting each other. Skip on non-win32 with `test.skip`.

### 1.7 `#26` process safety net

**Files:** `scripts/editor.ts`.

```ts
const die = (kind: string, err: unknown) => {
  console.error(kind, err);
  process.exit(1);
};
process.on("unhandledRejection", (err) => die("unhandledRejection", err));
process.on("uncaughtException", (err) => die("uncaughtException", err));
```

Place next to the existing `EADDRINUSE` handler. Do not swallow: log and exit non-zero. This process holds write access to the dataset.

**Check:** `grep unhandledRejection scripts/editor.ts` matches. No unit test required (process-level). `pnpm run test:editor` still boots.

### 1.8 `#31` sidebar label follows `id`/`code`/`name`

**Files:** `editor/public/app.js` (`onChange`, `navButton`, `labelFor`).

Keep a `Map` from `${collection}:${index}` to the button. In `onChange`, if the path's last segment is `id`, `code`, or `name`, update that button's text via `labelFor` — do **not** call `renderNav()` on every keystroke (that fights focus, which is why this was deferred).

`onAdd` / `onRemove` keep calling `renderNav()` (they change the set of buttons).

**Verify:** `pnpm run test:editor` (Chromium). Manually in the editor: open a skill, change `id`, sidebar row updates without losing the input focus. If `test:editor` cannot type into a field, add a step there rather than a screenshot-only check.

### Wave 1 done when

- `pnpm test` + `pnpm run typecheck` + `pnpm run test:editor` green.
- `07` moves 20, 21, 23, 25, 26, 27, 31, 33, 34 to Resolved.
- PR `0.22.0`.

---

## Wave 2 — Locale table and chrome copy

**Closes:** #40, #41, #42
**Version:** 0.22.0 → **0.23.0**
**Branch:** `feature/debt-locale-paths`
**Depends on:** Wave 0. Wave 4 depends on this.

### 2.1 `#40` one `LOCALE_PATHS` table

**Files:**
- Modify: `src/lib/anchors.ts` (table lives next to `ANCHORS`)
- Modify: `src/components/HomeDocument.astro` (delete `PDF_HREF`)
- Modify: `src/components/LocaleSwitch.astro` (delete `other === "es" ? "/" : "/en/"`)
- Modify: `src/layouts/Base.astro` (derive `ALTERNATE_LOCALES` from the table + `x-default` → Spanish home)
- Modify: `functions/_pdf.ts` (delete the ternary `sourcePath`)
- Modify: `functions/_pdf.test.ts`, `scripts/pdf-check-locales.ts` (they import `sourcePath`)

```ts
// src/lib/anchors.ts
export interface LocalePaths {
  home: string;
  cv: string;
  pdf: string;
}

export const LOCALE_PATHS: Record<Locale, LocalePaths> = {
  es: { home: "/", cv: "/cv", pdf: "/cv.pdf" },
  en: { home: "/en/", cv: "/en/cv", pdf: "/en/cv.pdf" },
};

export function sourcePath(locale: Locale): string {
  return LOCALE_PATHS[locale].cv;
}
```

`functions/_pdf.ts` currently cannot use the `@content` alias and `anchors.ts` already uses a relative `import type`. Either:
- re-export `sourcePath` from `anchors.ts` and import it relatively from `functions/_pdf.ts` (`../src/lib/anchors.ts`), **or**
- keep a one-line wrapper in `_pdf.ts` that reads `LOCALE_PATHS`.

Prefer importing from `anchors.ts` so a third locale is a compile error in **one** `Record<Locale, …>`. `LocaleSwitch.astro` and `_pdf.ts` become table lookups; adding `"pt"` to `Locale` fails `typecheck` in both.

**How to check it (from 07):** add `"pt"` to `Locale` in a throwaway; `typecheck` fails on `LOCALE_PATHS` (and `ANCHORS`). Revert. The two ternaries must be gone: `grep -n "=== \\"es\\"" src/components/LocaleSwitch.astro functions/_pdf.ts` → no path-mapping hits.

### 2.2 `#41` scroll-margin from `ANCHORS`

**Files:** `src/lib/anchors.ts`, `src/components/HomeDocument.astro`, `src/styles/home.css`, `src/pages/en/index.astro`, `scripts/single-landing.check.ts`.

```ts
export function anchorScrollSelector(): string {
  const ids = new Set(
    (Object.values(ANCHORS) as LandingAnchors[]).flatMap((a) => [a.map, a.projects, a.cv]),
  );
  return [...ids].map((id) => `#${id}`).join(", ");
}
```

`HomeDocument.astro` emits the rule (same pattern as `lab-hover-css.ts`):

```astro
<style is:inline set:html={`${anchorScrollSelector()} { scroll-margin-top: calc(var(--space) * 9); }`}></style>
```

Delete `#mapa, #proyectos, #cv { … }` from `home.css`. Delete the page-scoped `:global(#map), :global(#projects)` block in `src/pages/en/index.astro`.

**Gate:** `single-landing.check.ts` already knows `ANCHORS`. Add: every `ANCHORS.*.map|projects|cv` id appears in the built landing HTML as `scroll-margin-top` (or in the emitted style). Renaming `ANCHORS.en.map` then fails the check instead of shipping a jump that hides the heading under the pill.

`is:inline` is required on `/` (already in `PAGES_WITH_JS`); it is a style tag, not a script — `no-client-js.check.ts` must stay green on `/cv`. `HomeDocument` is used by both landings **and not** by `/cv`. Confirm `/cv` does not import it.

### 2.3 `#42` identical-keys allowlist

**Files:** `content/schema/messages.test.ts`.

Keep the accent regex (it still catches pasted `Años`). Add:

```ts
const MAY_BE_IDENTICAL = new Set(["emailLabel"]);
const OTHER_LOCALE_ON_PURPOSE = new Set(["downloadCvOtherLocale"]);

test("English chrome copy is not a silent paste of the Spanish", () => {
  for (const key of Object.keys(MESSAGES.es) as (keyof Messages)[]) {
    if (MAY_BE_IDENTICAL.has(key) || OTHER_LOCALE_ON_PURPOSE.has(key)) continue;
    const es = MESSAGES.es[key];
    const en = MESSAGES.en[key];
    const esText = typeof es === "function" ? es(1, 1) : es;
    const enText = typeof en === "function" ? en(1, 1) : en;
    assert.notEqual(enText, esText, `MESSAGES.en.${key} is still the Spanish string`);
  }
});
```

A new key copied into both blocks fails until it is translated **or** explicitly allowlisted. Adding to the allowlist is the reviewable decision.

### Wave 2 done when

- `pnpm run typecheck && pnpm test && pnpm run build && pnpm run test:landing && pnpm run test:js` green.
- Click `#map` and `#projects` on `/en/` — heading sits below the pill, not under it. (Browser verify: both landings, desktop and a narrow viewport.)
- `07` moves 40, 41, 42 to Resolved.
- PR `0.23.0`.

---

## Wave 3 — Schema, walker, serializer, zod adapter

**Closes:** #19, #22, #38, #39
**Version:** 0.23.0 → **0.24.0**
**Branch:** `feature/debt-schema-i18n`
**Depends on:** Wave 0. Independent of Wave 2. Do not mix with Wave 4.

This is the schema-touching wave. One PR so the Zod mirror, both JSON files, the lock and the walker move together.

### 3.1 `#38` stable paths for arrays without `id`

**Files:** `content/schema/content-schema.ts`, `content/schema/validation.ts`, `content/data/content.es.json`, `content/data/content.en.json`, `content/data/translation.lock.json`, `scripts/i18n-fields.ts`, plus a focused test (new cases in `scripts/i18n.check.ts` or a small `scripts/i18n-fields` test if one exists — prefer adding to whatever already imports `translatableFields`).

**Schema (same commit as Zod):**

```ts
export interface Link {
  id: string;
  label: string;
  url: string;
  kind: "github" | "linkedin" | "website" | "demo" | "repo" | "article" | "other";
}

export interface Media {
  id: string;
  kind: "image" | "gif" | "video";
  url: string;
  alt: string;
  caption?: string;
}

export interface TechnicalDecision {
  id: string;
  decision: string;
  context: string;
  rationale: string;
  tradeoff: string;
  alternatives?: string[];
}
```

`LanguageSkill` keeps `code` only. Walker:

```ts
function arrayKey(item: unknown, index: number): string {
  const rec = item as { id?: unknown; code?: unknown };
  if (typeof rec?.id === "string") return rec.id;
  if (typeof rec?.code === "string") return rec.code;
  return String(index);
}
```

Add `"code"` to `NOT_TEXT` (it is currently hashed as `languages.0.code`, which is an identifier, not prose).

**Dataset ids (identical in es and en — they are structure):**

- `identity.links`: `github`, `linkedin`
- `projects.jwd-maderas.decisions`: `next-sanity-not-wp`
- `projects.mapas-distritos.decisions`: `hash-index-worker`, `mapbox-color-expression`, `flyto-largest-polygon`
- `projects.wp-plugins.decisions`: `embed-muse-renderer`, `async-pile-cart`, `session-owner-not-cart-key`
- `projects.muse-admin` / seat map decisions: `turbo-monorepo`, `konva-not-svg`
- `projects.muse-api-algolia.decisions`: `index-vs-index`, `no-massive-update-worker`

Empty `media: []` and empty `links: []` need no rows. After editing, `pnpm run format:data` then `pnpm run i18n:lock` (paths change: `identity.links.0.label` → `identity.links.github.label`, `languages.0.name` → `languages.es.name`, `projects.mapas-distritos.decisions.0.decision` → `projects.mapas-distritos.decisions.hash-index-worker.decision`).

**Test:** swap `identity.links` order in a fixture; `translatableFields` paths stay `identity.links.github.label`. Today that swap reports stale — after this, it must not.

### 3.2 `#39` `Service.name` override

**Files:** `scripts/i18n-fields.ts`, a unit test next to the walker.

```ts
const isServiceName = key === "name" && /^services\.[^.]+$/.test(path);
```

Add it to the existing `isProjectName` / `isLanguageName` exception list.

**Test:** a synthetic dataset with `services: [{ id: "panel", name: "Custom dashboard", ...minimal valid fields }]` — `translatableFields` includes `services.panel.name`. Do **not** add a Service to `content.es.json`.

### 3.3 `#22` serializer fixture for legal-but-absent shapes

**Files:** `editor/serialize.test.ts`.

Build one in-memory `ContentDataset` (clone the committed es file, then attach):
- one `Achievement.metric` (already present on RPPL — if the committed data now has metrics, assert those paths; still add **empty-collection** shapes that remain unused: `certifications`, `services`, `testimonials`, a `media` array with one item, a `metric` on an achievement that does not have one if any remain).
- Confirm 2026-09-03: RPPL achievements **do** carry `metric`. Remaining holes: `certifications: []`, `services: []`, `testimonials: []`, `media: []`. The fixture fills those four plus a `media` element and a `certifications` element so `INLINE_ELEMENT_ARRAYS` for `certifications` and `media` is asserted.

The fixture must `validateDataset` (or `inspectDataset`) clean, `serializeDataset` round-trip, and be idempotent (`serialize(parse(serialize(x))) === serialize(x)`). `media` and `certifications` render as one inline object per line.

No committed JSON change for this test.

### 3.4 `#19` discriminated `ZodDef`

**Files:** `editor/schema-adapter.ts`, existing `editor/schema-adapter.test.ts` (22 tests stay the gate).

Replace the index signature with a union on `typeName`:

```ts
type ZodDef =
  | { typeName: "ZodOptional" | "ZodNullable"; innerType: ZodTypeAny }
  | { typeName: "ZodString"; checks?: StringCheck[] }
  | { typeName: "ZodNumber" }
  | { typeName: "ZodBoolean" }
  | { typeName: "ZodEnum"; values: unknown[] }
  | { typeName: "ZodLiteral"; value: unknown }
  | { typeName: "ZodUnion"; options: ZodTypeAny[] }
  | { typeName: "ZodArray"; type: ZodTypeAny }
  | { typeName: "ZodObject"; unknownKeys: string; shape: () => Record<string, ZodTypeAny> }
  | { typeName: string };
```

`defOf` still casts through `unknown` (zod's `_def` is untyped). After `switch (def.typeName)`, `def.innerType` is a compile error outside the Optional/Nullable cases. The default branch still throws `UnsupportedSchemaError`.

**How to check it (from 07):** rename `def.innerType` to `def.innterType` inside the Optional branch; `pnpm run typecheck` **fails**. Today it passes.

Do not bump zod in this wave.

### Wave 3 done when

- `pnpm run typecheck && pnpm run validate && pnpm test && pnpm run test:format && pnpm run test:i18n` green.
- Swapping `identity.links` in a copy of the dataset does not fail `test:i18n`.
- `07` moves 19, 22, 38, 39 to Resolved.
- PR `0.24.0`.

---

## Wave 4 — Bilingual leftovers (00-index, not 07)

**Closes:** `/en/llms.txt`, `/en/cv.json`, English OG, bilingual 404, English voice pass. Updates `docs/10-i18n.md` §6 and `docs/00-index.md` checkboxes.
**Version:** 0.24.0 → **0.25.0**
**Branch:** `feature/debt-bilingual-leftovers`
**Depends on:** Wave 2 (`LOCALE_PATHS`). Wave 3 optional but merge order should be 3 then 4 so schema ids are in the JSON the endpoints emit.

These were deferred on purpose in `10-i18n.md` §6. Closing them is the “when to reconsider” those paragraphs already named. After this wave that section reads “bilingual today” for all four.

### 4.1 Agent endpoints in English

**Problem:** `src/pages/llms.txt.ts` and `src/pages/cv.json.ts` pin `"es"`. English-reading agents are exactly who those surfaces exist for. `llms.txt` headings (`## Contacto`, `## Experiencia`, …) are still literals, not `messages.ts`.

**Files:**
- Modify: `content/schema/messages.ts` — add heading keys used by llms (e.g. `llmsContact`, `llmsStack`, `llmsExperience`, `llmsProjects`, `llmsHtmlCv`, `llmsPdfCv`, `llmsJson`, `llmsCase`). Both locales. Compile error if `en` is missing.
- Create: `src/lib/llms-txt.ts` — `renderLlmsTxt(view, locale, base: string): string`. The current body of `llms.txt.ts`, but headings from `MESSAGES[locale]`, CV/PDF/JSON URLs from `LOCALE_PATHS[locale]`.
- Modify: `src/pages/llms.txt.ts` — `getView("public-api", "es")` + `renderLlmsTxt`.
- Create: `src/pages/en/llms.txt.ts` — same with `"en"`.
- Modify: `src/pages/cv.json.ts` — keep Spanish.
- Create: `src/pages/en/cv.json.ts` — `getView("public-api", "en")`.
- Modify: `scripts/endpoints.check.ts` — read `dist/en/llms.txt` and `dist/en/cv.json` too; assert `locale === "en"` on the JSON; assert English headings present and Spanish `## Experiencia` absent from the English file; rule 8 on both JSON files.
- Modify: `src/pages/robots.txt.ts` — comment both pairs of URLs.

Do not content-negotiate on `Accept-Language`. Two URLs, like the PDFs.

### 4.2 English OG card

**Files:** `scripts/og-data.ts`, `scripts/build-og.ts`, `scripts/og-output.check.ts`, `src/layouts/Base.astro`, `og.lock.json`, `public/og.en.jpg` (generated, committed).

- `ogTexts(locale: Locale)` — today it hardcodes `"es"`. English uses `getView("portfolio", "en")` and `formatSeniority(..., "en")`.
- `IMAGE` becomes per-locale: `public/og.jpg` / `public/og.en.jpg`.
- Fingerprint both. `og.lock.json` holds two hashes or a `Record<Locale, string>`.
- `Base.astro`: `new URL(locale === "es" ? "/og.jpg" : "/og.en.jpg", Astro.site)`. After Wave 2 this can be `LOCALE_PATHS`-adjacent (`OG_IMAGE: Record<Locale, string>` next to the paths, or a field on `LocalePaths` — **do not** overload `LocalePaths` with an image; a sibling `OG_IMAGE_PATH` is enough).
- `pnpm run og:local` regenerates both; commit artifacts. WhatsApp ceiling (`OG_MAX_BYTES`) applies to **both** files.

### 4.3 Bilingual 404

**Files:** `src/pages/404.astro`, `scripts/single-landing.check.ts` (404 exists, still noindex, still does not link to `/cv` or `/en/cv`).

One page, zero JS, Spanish first (market / `x-default`), English below. Destinations:

- ES: `LOCALE_PATHS.es.home` + `ANCHORS.es` (mapa / proyectos / cv)
- EN: `LOCALE_PATHS.en.home` + `ANCHORS.en` (map / projects / cv)

`<html lang>`: keep `lang="es"` on the document (one lang per page is honest; mark the English block `lang="en"`). Title can stay Spanish or become `Esta página no existe / This page doesn't exist` — prefer a single Spanish title plus English `h1` in the second block, so the tab matches `x-default`.

Copy goes in `messages.ts` (`errorTitle`, `errorText`, `errorBack`, `errorDestMap`, `errorDestProjects`, `errorDestCv`, `errorNavLabel`) so a third language does not reopen this file as literals.

### 4.4 English voice pass

**Files:** `content/data/content.en.json`, `content/data/translation.lock.json` only if Spanish also moves (it should not).

Start with what `00-index` names: `identity.summary.long`, the Hogarth `context.short`, `Metric.label`s. Then a full pass of `content.en.json` against `docs/02-branding.md` (banned words, “could someone else with my stack have written this exact sentence?”).

Hedges, numbers, clients, dates must match the Spanish. This is a rewrite of cadence, not of facts. After the rewrite: `pnpm run test:i18n` still green (Spanish hashes unchanged). If a Spanish sentence is itself weak and you are tempted to “fix” it: stop, that is a Spanish-first edit and a different commit.

**Stop and ask you to read** `identity.summary.long` and the Hogarth block before merging Wave 4.

### 4.5 Docs

- `docs/10-i18n.md` §6: move the four items into “bilingual today”; delete the “when to reconsider” paragraphs that this wave executed.
- `docs/00-index.md`: check the four boxes.
- `docs/06-next-session.md` §6 recount: technical debt **42 / 42 resolved** (or 24+18). Phase 3 closed.
- `docs/09-seo-and-metadata.md` if it still says one OG image for both locales.
- `CLAUDE.md` file map: `en/llms.txt.ts`, `en/cv.json.ts`, `og.en.jpg`, `LOCALE_PATHS` in `anchors.ts`.

### Wave 4 done when

- Full gate green, including `test:endpoints` on **both** locales and `test:og` on **both** images.
- `curl` of `dist/en/llms.txt` has English headings and English prose.
- Sharing `/en/` (or inspecting `dist/en/index.html`) points `og:image` at `/og.en.jpg`.
- A fake `/en/nope` in `astro preview` shows both languages and does not link `/cv`.
- You have signed off the English summary voice.
- PR `0.25.0`.

---

## Execution order

```
Wave 0  ──►  Wave 1 (editor)
         └─►  Wave 2 (locale table)  ──►  Wave 4 (bilingual leftovers)
         └─►  Wave 3 (schema / i18n)
```

- 1, 2, 3 are parallel after 0. If only one agent: 0 → 1 → 2 → 3 → 4 (2 before 4 is the only hard edge; 3 before 4 avoids emitting index-keyed decision paths in `/en/cv.json` for one release).
- Do not open a wave until the previous merged wave's `07` Resolved table is the baseline — otherwise two PRs fight over the same markdown rows.
- Promote `develop` → `staging` **after Wave 4**, not per wave (`08`: `develop` does not deploy). The smoke then covers `/en/cv.pdf` plus the new `/en/llms.txt` on a real preview.

## What I need from you (only these)

1. **Voice sign-off** on the English rewrite in Wave 4 (`identity.summary.long`, Hogarth, metric labels). I will draft; you say if it sounds like you.
2. **Decision ids** — I will mint the kebab ids listed in 3.1. Object if you want different slugs.
3. Nothing else. No metrics, no first Service, no tunnel, no invented clients.

## Per-wave commit shape

Each wave is several commits on one branch, one PR:

- tests / types first where the wave is a net (Wave 1, #42, #34, #23)
- implementation
- `docs/07` Resolved rows + version bump as the last commit (`chore: 0.2x.0`), matching previous editor/bilingual PRs

Do not put Wave 4 copy and Wave 3 schema in the same PR: a reviewer cannot see the English cadence change next to a lock-file path rewrite.
