# portfolio2026

Content layer for a portfolio and a CV. Single source of truth: the data lives
in `content/data/`, and the CV, the portfolio and the LinkedIn blocks are
**views** derived from it. On top of that layer sits a static Astro site that is
**one navigable page per language**: `/` (Spanish) and `/en/` (English), each
with hero, map, projects and the full CV, an anchor index and a floating button
that downloads either PDF. `/cv` and `/en/cv` still exist but stopped being
destinations — they are the pages each PDF is printed from, and both carry
`noindex` with no incoming links. The site also publishes JSON-LD `Person`,
`/cv.json` and `/llms.txt` (Spanish only for now — see `docs/10-i18n.md` §6).

The heart of each landing is the **knowledge map**, which cross-references
achievements, roles, projects and technologies as a graph. Each technology's size
comes from its years of use times its connections; the jobs sit in the crust and
the technologies in the core. It is server-rendered as SVG and, if the device can
take it, the WebGL version is layered on top. Without JavaScript the map is still
complete, cross-hover included.

**Neither PDF is a build artifact.** `/cv.pdf` and `/en/cv.pdf` are generated on
demand by a Cloudflare Pages Function that asks Browser Rendering to print our
own `/cv` or `/en/cv`, and caches the result at the edge. That is why
`pnpm run build` is only `astro build` and runs anywhere. See
[`docs/05`](./docs/05-deploy-and-analytics.md).

> The site is **bilingual**: Spanish is canonical (`content.es.json`) and
> English (`content.en.json`) is a tracked translation of it, kept in sync by
> `pnpm run test:i18n` — see [`docs/10`](./docs/10-i18n.md). The code, the
> comments and these docs are in English regardless of which dataset they
> describe.

## Getting started

Requires **pnpm** (`corepack enable` is enough) and Node >= 22.12.

```bash
pnpm install
pnpm run dev          # astro dev
pnpm run build        # ONLY astro build. No Chromium: that is why it runs on Cloudflare
pnpm run pdf:local    # prints dist/cv.pdf AND dist/en/cv.pdf with Playwright. Local gate, not the deliverable
pnpm run editor       # local editor on 127.0.0.1:4322: the page, and the API it runs on
pnpm run format:data  # rewrites content.es.json AND content.en.json in canonical form via DatasetStore
pnpm run i18n:lock    # re-stamps translation.lock.json after translating whatever test:i18n named
```

Verification — **all of these have to pass**:

```bash
pnpm run test:workflows # the CI .yml files parse and declare jobs. Runs FIRST
pnpm run typecheck      # astro sync + tsc --noEmit + astro check
pnpm run validate       # Zod (shape) + hard rules (coherence)
pnpm test               # rules the schema does not validate (visibility, locale, graph, version, invariants)
pnpm run test:i18n      # content.en.json is a real, current translation of content.es.json — blocking, not advisory
pnpm run test:pdf       # both PDFs parse and pass the ATS. Needs pdf:local, or PDF_SOURCE=<url> (+ PDF_LOCALE)
pnpm run test:js        # no page other than the two landings ships JavaScript
pnpm run test:bundle    # both landings: three off the critical path and within budget, on each
pnpm run test:landing   # /cv and /en/cv isolated, each CV section in sync with its own PDF, real 404
pnpm run test:endpoints # /cv.json parses, /llms.txt has no empty fields
pnpm run test:og        # the social card has not gone stale against the dataset
pnpm run test:version   # the PR raises package.json.version. Needs: git fetch origin develop
pnpm run test:served    # verifies the PUBLISHED site. Needs SITE=https://…
pnpm run audit:todos    # lists published TODOs. Not blocking
pnpm run audit:deps     # pnpm audit --audit-level high
```

If `validate` fails, the message says which rule was violated and how to fix it.

## Limits and ceilings

**The code is the source of truth for every number**; this table is a summary of
what was measured on 2026-08-25.

### Site budget

| Resource | Ceiling | Today | Defined in |
|---|---|---|---|
| Landing HTML (each) | 30 KB gzip | 11.2 KB | `scripts/bundle-budget.check.ts` |
| Landing critical JS (each) | 4 KB gzip | 2.4 KB | idem |
| WebGL field chunk (each) | 8 KB gzip | 2.0 KB | idem |
| **Deferred 3D chunk** (`three`, shared) | 150 KB gzip | **129.8 KB** | idem |
| **PDF pages** (either locale) | 2 | **2** | `scripts/pdf-output.check.ts` |
| JS on any page other than the two landings | 0 | 0 | `scripts/no-client-js.check.ts` |
| **Social card** (`og.jpg`) | 300 KB | **61 KB** | `scripts/og-template.ts` |

The social card ceiling is not tidiness: **WhatsApp does not get as far as
showing the preview if the image is too heavy**, so going over means the link
stops showing a card in the channel where it is shared most. It is tuned with
`QUALITY` in `scripts/build-og.ts`; that is why the image is JPEG and not PNG.

**Two are at the limit, and it is worth knowing before hitting them:**

- **The PDF is at 2 of 2 pages.** Any achievement, role or section added to the
  dataset pushes it to 3 and `test:pdf` stops it. That is not a bug in the test:
  two pages is the rule from [`docs/03`](./docs/03-cv.md) §2. Adding content to
  the CV means removing something else.
- **The 3D chunk is at 87% of its ceiling.** Bumping `three` or importing one
  more module can push it over. The ceiling exists so that decision is explicit,
  not to block it.

### External services, all on free plans

| Service | Limit | Actual usage |
|---|---|---|
| Cloudflare Pages | 500 builds/month; unlimited bandwidth and requests | a few per week |
| Cloudflare Browser Rendering | 10 browser minutes/day · 3 concurrent · one new instance every 20 s | 3-5 s per render, 1 h edge cache |
| GitHub Actions | **unlimited** — the repo is public | — |
| Microsoft Clarity | free, no cap | — |
| Cloudflare Web Analytics | free | — |

**The limit that actually gets touched is Browser Rendering's**, and not the
daily one but the rate — and this branch made it worse on purpose: each deploy
now warms TWO pages (`/cv.pdf` and `/en/cv.pdf`, one after the other) instead
of one, so the `develop` → `staging` → `main` chain is two deploys back to
back asking for **four** cold renders in the same window, not two. It already
failed once at the old, smaller count — the smoke hit a 429 on a healthy site.
That is why `smoke-deploy.yml` warms both PDFs sequentially, tolerating a 429
on either, before running the tests — doubling the render count was the
cheapest way to ship two locales, and this is the limit that decision actually
leans on. Detail in [`docs/07`](./docs/07-technical-debt.md) §16.

## How work happens

`feature/*` → `develop` → `staging` → `main`. Every PR into `develop` **raises
the version** in `package.json`, and only the branch above enters `staging` and
`main` — both are enforced by CI, not by discipline. See
[`docs/08`](./docs/08-branches-and-versioning.md).

## Using it from the frontend

```ts
import { content } from "./content/source";

const cv = await content.getView("cv", "es");
const web = await content.getView("portfolio", "es");
```

The frontend **never** filters by `visibility` and never computes durations: it
receives lists already resolved by `getView()`.

## Where to go next

- **What gets done now and in what order:** [`docs/06`](./docs/06-next-session.md).
- **Technical debt, with how to check each entry:** [`docs/07`](./docs/07-technical-debt.md).
- **Status, decisions and what is missing:** [`docs/00-index.md`](./docs/00-index.md).
- **How to work in the repo (invariants, conventions, file map):**
  [`CLAUDE.md`](./CLAUDE.md).
