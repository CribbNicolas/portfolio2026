# The contract — rules of the content system

Companion to `content-schema.ts`. The schema defines the shape; this defines the
rules the shape cannot express on its own.

---

## 1. Hard rules (they should be tests, not good intentions)

These are validated in CI. If they fail, nothing deploys. Where each one is
enforced is in the table in `CLAUDE.md` — they do not all live in the same place.

| # | Rule | Why |
|---|------|-----|
| 1 | **No hand-written duration.** Everything derives from `careerStart`, `start` and `end`. | It is the root cause of the three different seniority figures you had. |
| 2 | **No two overlapping `full-time` roles** unless one has `concurrent: true`. | An automatic red flag in human review and in the AI layer. |
| 3 | **Every `Skill` with `level: "core"` needs ≥1 `Achievement` referencing it.** | If you cannot show where you used it, do not claim it. This forces you to be able to defend every line. |
| 4 | **Every `Metric` with `confidence: "estimated"` renders with "~" or "aprox."** | An invented number that collapses in the interview costs more than having no number. |
| 5 | **Every `Media` needs an `alt`.** | Accessibility, plus agents read the alt. |
| 6 | **`Testimonial.approved: false` is never rendered.** | Obvious, but exactly the kind of thing that leaks. |
| 7 | **`cv-short` cannot exceed N items.** It cuts by `priority`. | Forces the editorial decision into the data, not into the layout. |
| 8 | **`streetAddress` and `phone` only leave on the surfaces listed explicitly.** | Your street address has no reason to circulate in PDFs uploaded to job portals. |

---

## 2. How each surface consumes the data

| Surface | What it uses | What it ignores |
|---|---|---|
| `cv` | `summary.short`, roles with achievements at `priority ≤ 3`, `text.short`, active skills grouped | `decisions`, `services`, `testimonials`, `Prose.long` |
| `cv-short` | The same but `priority ≤ 2`, at most 3 bullets per role | Roles more than 8 years back |
| `cv-ats` | Same content as `cv`, no design, one column, no icons | Everything visual |
| `portfolio` | Everything. `Prose.long`, `decisions`, `media`, `services`, `testimonials` | Nothing, except `except: ["portfolio"]` |
| `linkedin` | Generated blocks: headline, About, one paragraph per role | The CV's bullet format (LinkedIn renders them differently) |
| `public-api` | Filtered dataset → `/cv.json`, JSON-LD `Person`, `llms.txt` | Private contact data |

**One place decides what gets in:** `resolveView`. The frontend never filters by
`visibility`; it receives already resolved lists.

---

## 3. The design decisions that matter

**`Prose` with `short` and `long` instead of one truncated text.** The CV bullet
and the portfolio paragraph are not the same sentence at two sizes: they are two
different registers. One is telegraphic and dense in keywords; the other breathes
and explains. A `truncate()` ruins both.

**`Achievement`s live loose, not nested inside `Role`.** That way you can query
them by skill ("everything I did with Mapbox"), by dimension ("show me my
architecture achievements") or by project. A typical CV can only list them
chronologically; your portfolio can cross-reference them. That is a feature
almost nobody has, and it falls out of the data model for free.

**`brandTitle` separate from `searchTitle`.** Product Engineer is who you are;
Desarrollador Full Stack is what gets typed into a search box. The system emits
whichever the surface calls for, without you having to remember.

**`Skill.aliases`.** The per-posting CV generator can emit the exact variant the
offer uses ("Vue.js" and not "Vue") without you editing anything. Old parsers
match literally; the LLM layer already reasons about synonyms, but the old one
runs first.

**`Skill.periods` is a list, and the years are the sum of the merged spans.** A
technology gets dropped and picked back up: React 2019–2021 and 2024–2025 is
three years, not the six an end-to-end span would report. Merging covers the
opposite case — using it in two jobs at once is not twice the same years.
Declared periods are UNIONed with what the roles and projects citing the skill
already imply: declaring adds what no achievement records, never overrides real
evidence. The calculation lives in `monthsFromPeriods` (`dates.ts`), because
rule 1 says every duration comes from there.

---

## 4. What the schema deliberately does NOT do

- **There is no `yearsOfExperience` field.** It is computed. As stored data it
  would drift.
- **There are no 1-to-5 skill levels.** Three values you can defend in an
  interview, and that is it. Progress bars are read by no parser and make
  technical readers suspicious.
- **There is no per-field i18n.** One dataset per language. Translating a CV
  field by field produces translated English, which is worse than written
  English.
- **There is no application tracking.** That is another domain. If you want it,
  it goes in another system.

---

## 5. Open questions

**Do private work repos go in as a `Project` with no links?** They can:
`links: []` and `clientDescription` instead of `client`. Worth it when the
technical case is strong.

`services` and `testimonials` stay empty on purpose — they are in the schema so
there is nothing to migrate later. The English dataset is decided against; the
reason is in [00](./00-index.md).
