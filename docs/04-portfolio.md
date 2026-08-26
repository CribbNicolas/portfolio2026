# 04 — Portfolio

Two goals at once: convince a hiring team and close freelance clients. And two
readers: the human and the agent.

---

## 1. Structure

Since 2026-08-24 the site is **one navigable page**:

```
┌─ Fixed bar     Mapa · Proyectos · CV · contact · [↓ CV]  (follows the scroll) [done]
├─ Hero          name, role, tagline. No buttons.                    [done]
├─ #mapa         Knowledge map. See §7.                              [done]
├─ #proyectos    Projects, with a public link                        [done]
└─ #cv           The full CV, cv-ats surface. The longest block, and the last [done]
```

Still pending:

```
Servicios       → what you can be hired to do (freelance side).      [pending]
Sobre mí        → a short story, with voice. Not a repeated CV.      [pending]
```

**"Cases" is done as a compact list, not in the case-study format of §2.** That
long version — problem → decision → outcome — is still pending because
`problem.short` and `outcome.short` carry a `TODO` in two of the three projects,
and filling them by eye violates invariant 4. All three `links` are also empty:
the component renders the link only when it exists, so loading them is editing
the dataset, not touching code.

Contact is neither in the hero nor in the footer: it lives in the pill, which
follows the whole scroll. On a single page, the footer sits behind the entire CV
— the longest block — and the hero is only seen by whoever has not scrolled yet.

Every section shares its width (`--width`, 45rem). It is one token: with
different widths the page reads as four pages glued together.

**The Stack is not a grid of logos.** See §7: it is a graph, and each
technology's size is derived data, not an opinion.

**Blog:** optional, but if it opens it has to be sustained. A blog with three old
posts subtracts more than it adds.

## 2. Case study format

```
[Name]  ·  [Role]  ·  [Year]

The problem     → 2 sentences about the business, not about the technology.
What I built    → 3 bullets.
Decisions       → 2 technical decisions with their why and their trade-off.
Outcome         → a number, or a qualitative before/after.
Stack           → a list.
Links           → live demo + repo if public.
Evidence        → a screenshot, a short GIF or a 20s video. Not an empty mockup.
```

**The decisions block is the differentiator.** Almost no portfolio has it, and it
is the only thing a technical hiring manager reads with real attention. In the
schema it is `TechnicalDecision`, and the `tradeoff` field is mandatory: with no
trade-off it was not a decision.

### The three cases

| Project | What it demonstrates |
|---|---|
| **JWD Maderas** | A complete product for a real business, with a measurable outcome. Next.js + Sanity. |
| **District maps** | Uncommon technical depth: geospatial data, Mapbox GL JS, solving rendering problems. |
| **WordPress plugins with modern tooling** | Working in legacy environments without breaking them. In freelance this sells enormously. |

All three are in the dataset with `featured: true` and their `slug`. The
`problem` and `outcome` of two of them are missing, and so is all the visual
material.

**Private projects:** they can be shown without links. `links: []` and
`clientDescription` instead of `client`. Worth it when the technical case is
strong.

## 3. Machine-readable layer

More and more recruiters paste the portfolio URL into an LLM and ask whether the
candidate is a fit. Whether the answer is good depends on this — and it doubles
as a demonstration of the skill being sold.

- **Server-rendered JSON-LD `Person`** in the `<head>`. Not injected by JS:
  crawlers do not execute it.
  - `name`, `jobTitle` (using `searchTitle`), `knowsAbout` with the stack,
    `sameAs` with LinkedIn and GitHub, a stable `@id`.
- **`schema.org/CreativeWork`** on each case study.
- **`/llms.txt`** at the root: a markdown summary of who you are, the stack and
  the projects, with links.
- **`/cv` in HTML** alongside the PDF. HTML parses perfectly; the PDF is for
  attaching.
- **`/cv.json`** with the dataset filtered by the `public-api` surface.
- Real semantics: a single `<h1>` with name and role, hierarchical headings, a
  descriptive `alt` on every image (contract rule 5 validates it).

All of this is generated from the same dataset. The `public-api` surface already
excludes the private contact data.

## 4. The freelance side

A client arriving at the portfolio looking to hire does not look at the
architecture: they look at whether you solved a problem like theirs. For that
visitor:

- **Services** (`Service` in the schema): what you do, for whom, what you
  deliver. The `idealFor` field filters bad leads before they write.
- **Price range**: publishing it filters enquiries; not publishing it generates
  more volume of worse quality. Still open.
- **Testimonials** (`Testimonial`): only with `approved: true`. Rule 6 validates
  it.
- **JWD Maderas is the main case for this audience**, not the maps.

## 5. A warning

A portfolio with its own backend does not impress by existing: there are
thousands. It impresses if the case study explains the decisions. And the backend
is invisible to the freelance client — what convinces them is the JWD Maderas
outcome.

That is why the order is: portfolio online first with JSON in the repo, backend
later. See [CONTRACT.md](./CONTRACT.md).

## 6. Still to research

A second piece of research on the patterns of reference portfolios is still open:
structure, typography and palettes, how they present projects, which mistakes
repeat in senior portfolios, how they fold AI into their brand.

**It was decided to move ahead without it** (2026-08). The original plan was to
research before touching the visual design; instead the knowledge map (§7) was
built first and put on the front page. The reason: the map is not an aesthetic
decision but the only surface showing the data graph, and postponing it for
typography research was postponing what makes the site different for what makes
it look like the others.

What the research **still** has to resolve, and is undecided today: typography
and palette beyond the current tokens, and how the case studies are presented.
Do it before writing §2, not after.

## 7. The knowledge map

It is the front page. It cross-references achievements, roles, projects and
technologies as a graph — the only view that takes advantage of `Achievement`s
living loose (CONTRACT §3) instead of nested inside each job.

**What the drawing says:**

- **A technology's size** = years of use × number of connections, by square root
  (the eye compares area, not radius). The years come from `Skill.periods` or,
  failing that, from the span of the dated evidence backing it. They are never
  estimated (invariant 4).
- **The position** = jobs in the crust, technologies in the core. Core = what I
  know, crust = where I used it.
- **Technologies without evidence** are drawn small and hollow, grouped at the
  centre. They are the ones you declare but that do not yet have an achievement
  demonstrating them. **The map shows the gap instead of covering it** — and that
  is on purpose: it is the same criterion as the warning in §5.

**Why this convinces and a grid of logos does not:** a grid asserts; the graph
shows the evidence. A large node is large because there are dated achievements
behind it, and it can be clicked to see which.

**Cost:** it is the only page on the site with JavaScript. The critical path is
4 KB gzip; `three` (127 KB) only downloads when the map enters the viewport, and
only if the device can take it. Without JavaScript the map is still complete in
SVG, cross-hover included. `/cv` stays at zero — the PDF comes from there.
