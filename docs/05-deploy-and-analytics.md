# 05 — Deploy and analytics

Decided 2026-08-24, revised 2026-08-25 when the build moved from GitHub Actions
to Cloudflare Pages and the PDF from build time to runtime. Rewritten 2026-08-26:
the setup checklist that filled half this file is done, so it is now a reference
of what is configured and where, not a step-by-step.

The whole stack is free except the domain.

| Layer | Service | Cost |
|---|---|---|
| Hosting **and build** | Cloudflare Pages | Free (500 builds/month) |
| PDF on demand | Cloudflare Browser Rendering | Free (10 browser minutes/day) |
| Quality gates | GitHub Actions | Free and **with no minute cap**: the repo is public |
| Heatmaps and sessions | Microsoft Clarity | Free, unlimited |
| Traffic and Web Vitals | Cloudflare Web Analytics | Free |
| Domain | To be decided | ~10-15 USD/year |

---

## 1. Why this stack

**Cloudflare Pages and not Azure Static Web Apps or GitHub Pages.** Pages gives
unlimited bandwidth and requests on the free tier, 500 builds a month and custom
domains with no cap. Azure Free stops at 100 GB of bandwidth and 2 domains.
GitHub Pages has no Functions, and the on-demand PDF needs one.

Side effect of the repo going public on 2026-08-25 (done to use rulesets, see
[08](./08-branches-and-versioning.md)): **Actions lost its minute cap.** The
2,000 monthly minutes apply to private repos.

**The build runs on Cloudflare.** It used to be impossible: `pnpm run build`
started Playwright and Chromium to print `dist/cv.pdf`, and no host builder ships
a browser. The answer then was to build in Actions and upload a finished `dist/`
to Pages. That worked but tied together two things that need not be:
**generating the site** and **generating the PDF**.

They were untied. `pnpm run build` is `astro build` and nothing else. The PDF
moved to `functions/cv.pdf.ts`, which prints it on demand. Two consequences, and
the second is the one that matters long term:

1. The build runs anywhere. Pages included, with no Chromium.
2. **The PDF stops being a build artifact.** The day the data comes from an API
   instead of `content.es.json`, the CV PDF is up to date with nobody
   regenerating a file. The only thing that has to be up to date is `/cv`.

**The PDF is printed with Browser Rendering, not with a PDF library.** Building
the PDF with `pdf-lib` or similar would mean writing the layout twice — once in
CSS for `/cv`, once in coordinates for the PDF — and those two copies drift.
`src/pages/cv.astro` promises HTML and PDF cannot diverge because there is one
layout. Browser Rendering keeps that promise: it prints exactly the page that
already exists.

**The REST API is used, not the binding.** Pages Functions support a subset of
bindings (KV, D1, R2, Durable Objects, Queues, Workers AI, service bindings) and
Browser Rendering is **not** in that subset. The REST API is an ordinary `fetch`
with a token. If full Puppeteer is ever needed, the way out is migrating from
Pages to Workers with static assets, where the binding does exist.

**The budget is not a problem at this scale.** The free plan gives 10 browser
minutes a day and 3 concurrent browsers. A `/cv` render takes 3-5 s. With the
one-hour edge cache TTL, the real cost is on the order of one render per deploy —
a couple a week. If it ever ran out, the Function propagates the 429 with its
`Retry-After` instead of returning a broken PDF.

**Clarity and not only Cloudflare Web Analytics.** They are not alternatives: CWA
does not do heatmaps. It gives pageviews, referrers, country, browser and Core
Web Vitals. The question worth answering — which parts of the CV get read and
which do not — is answered by Clarity with click, scroll and area heatmaps, plus
session recordings. Both are free and measure different things, so both are in.

**Clarity goes on the landing, not on `/cv`.** Since 2026-08-24 the full CV lives
at the home's `#cv`, and `/cv` carries `noindex` with no incoming links. Putting
the script on `/cv` would be useless and would violate the zero-JS invariant of
that page — and that invariant **got more expensive** with this change: a script
slipping in used to break your local build, now it breaks the PDF in production,
because Browser Rendering prints the published page.
`scripts/no-client-js.check.ts` still catches it in CI.

---

## 2. Where each thing runs

```
push to any branch (feature/* · develop · staging · main)
      |
      +--> GitHub Actions · content-validation.yml       <- QUALITY GATE
      |      typecheck · validate · test · build
      |      pdf:local (Playwright) · test:pdf           <- the PDF passes the ATS
      |      test:js · test:bundle · test:landing · test:og
      |      audit:todos (does not block)
      |
      +--> Cloudflare Pages · automatic build            <- PUBLISHES
             staging and main only. develop and feature/* do NOT deploy
             pnpm run build -> dist/
             staging -> preview URL
             main    -> production
                   |
                   +--> GitHub Actions · smoke-deploy.yml  <- POST-DEPLOY GATE
                          waits for /build.json == this commit
                          test:pdf over the published PDF
                          test:served: /cv with no JS, a real 404  <- what dist/ cannot say
```

**Why the gate runs twice.** `pdf:local` prints with Playwright on the runner;
production prints with Browser Rendering. Two different Chromiums over the same
layout. The first blocks the merge without depending on anybody's network; the
second is the only thing proving what people download actually parses. The
assertions are the same — `scripts/pdf-output.check.ts` — and the only thing that
changes is where the bytes come from (`PDF_SOURCE`).

**And the smoke is the only thing that sees what is SERVED.** The other checks
read `dist/`, so they cannot see anything happening after the build — an edge
injection, a transform rule. `scripts/served.check.ts` requests the real URLs.

**How it knows the deploy is up.** It waits for `/build.json` to return the
commit just pushed. That endpoint carries `CF_PAGES_COMMIT_SHA` and exists only
for this. Sleeping a fixed while would be fragile: it would verify the previous
deploy every time the build ran long, and pass green.

**Actions no longer deploys.** There is no Cloudflare token in GitHub, and
therefore nothing to rotate if a log leaks. Pages builds the repo on its own.

---

## 3. What is configured in Cloudflare

Done on 2026-08-25. Kept as a reference of what exists and where to change it.

**Project** (Workers & Pages → Pages): repo `CribbNicolas/portfolio2026`,
production branch `main`, framework preset **None**, build command
`pnpm run build`, output `dist`.

**Build variables** (Settings → Variables and Secrets → Production **and**
Preview):

| Name | Value | Why |
|---|---|---|
| `NODE_VERSION` | `24` | The v3 build image starts at Node 18.17.1. `package.json` asks for `>=22.12` and `astro sync` does not start on 18. |
| `PNPM_VERSION` | `11.1.3` | v3 ships pnpm 10.11.1. `packageManager` declares `pnpm@11.1.3`. |
| `SITE_URL` | the site URL | Without it the JSON-LD and the canonical point at `https://portfolio.invalid` (`astro.config.mjs`). |

**Runtime variables** (the ones the Function reads):

| Name | Type | Value |
|---|---|---|
| `BROWSER_RENDERING_ACCOUNT_ID` | Plaintext | The Cloudflare Account ID |
| `BROWSER_RENDERING_TOKEN` | **Secret** | A token with ONE permission: Developer Platform → Browser Run → Edit |
| `PDF_REFRESH_TOKEN` | **Secret** | Any long random string. Enables `GET /cv.pdf?refresh=<token>`, the manual re-render. **Unset, the manual path simply does not exist** — which is the safe default, because a render is billable. |

**Analytics variables**, Production only, so a preview does not pollute the data:
`PUBLIC_CF_BEACON_TOKEN` and `PUBLIC_CLARITY_ID`. Both are public — they travel
in the HTML of every visit — and they are read from variables so they can be
rotated or switched off without touching code. Undefined, neither script renders.

**Which branches deploy.** Settings → Builds & deployments → Configure Preview
deployments → **Custom branches**, Include: `staging`. NOT "All non-Production
branches": that would deploy `develop` and every `feature/*`, each one a build
against the 500/month quota and a public URL nobody asked for.

> **Cloudflare Web Analytics is enabled BY HAND in `index.astro`, not from the
> Pages dashboard.** Enabling it from the dashboard injects the beacon into the
> WHOLE site on the next deploy — `/cv` included — and no check would see it,
> because they all read `dist/`. That is what `served.check.ts` exists to catch,
> and the reason it exists at all.

### The PDF cache, and how to bust it by hand

The edge keeps a rendered PDF for **thirty days**; the visitor's browser keeps
it for **one hour** (`s-maxage` and `max-age` in the same header — shared caches
read the first, browsers the second).

That asymmetry is the whole design. The edge key carries the **deployed commit**,
read from our own `/build.json`, so a dataset edit ships as a deploy, the deploy
is a new commit, and the first request after it renders again with nobody
remembering to purge anything. A browser cache cannot be keyed that way —
`/cv.pdf` is always `/cv.pdf` — so the browser's hour is what stops a returning
visitor from holding a superseded CV.

It went from one hour to thirty days because one hour was expensive: every
expiry hands the next visitor a render, and on 2026-09-04, during a day of
deploys, production `/cv.pdf` answered **429** — the day's Browser Rendering
budget, gone. The visitor gets `pdfQuotaExceeded` instead of a CV.

**To force a re-render:**

```bash
pnpm run pdf:refresh                     # production
pnpm run pdf:refresh https://staging.…   # anywhere else
```

It reads `PDF_REFRESH_TOKEN` from `.env` (never committed) and hits
`?refresh=` on both locales. It skips the cache **read**, not the write: the
fresh bytes land under the same key, so the purge serves the next visitor too
and not only whoever asked.

Two things the script does that a bare `curl` does not, both learned on
2026-09-04:

- **It spaces the two locales apart.** Browser Rendering rate-limits bursts (3
  concurrent browsers, a new instance every 20 s). Firing both at once answers
  429 for the second, and a 429 arrives fast enough to look like success to
  anything that only checks for a 200.
- **It tells a real re-render from a silent no-op.** A token that does not
  match the one in the Pages project is ignored exactly like `utm_source` — by
  design, so a probe cannot tell the parameter exists — which means it answers
  **200 from cache**. Fast and 200 is the failure here, not the success, and it
  is the one a person cannot see. The script times the response: under 1.5 s it
  was a cache hit, and it says so and exits non-zero.

Each call costs one render per locale. It is a repair tool, not something to
put on a schedule — the deploy already busts the cache on its own.

---

## 4. Testing the Function locally

Not needed to work on the CV: `pnpm run dev` serves `/cv` in HTML and
`pnpm run pdf:local` prints the PDF with Playwright, neither touching the cloud.
This is only for `functions/cv.pdf.ts`.

```bash
cp .dev.vars.example .dev.vars   # and fill in the two values
pnpm run build
pnpm dlx wrangler pages dev dist   # dlx: wrangler is not a repo dependency
# -> http://localhost:8788/cv.pdf
```

Browser Rendering will try to print `http://localhost:8788/cv`, which does not
resolve from Cloudflare's cloud. So locally the Function verifies routing,
caching and error handling, **not** the render. The render is tested on the
`staging` preview. Accepted as [07](./07-technical-debt.md) resolved #6: the
smoke is the E2E; a tunnel is not worth it.

---

## 4b. Response headers (`public/_headers`)

Added 2026-09-04, after measuring the published site with Lighthouse.

**The caching half fixes something that was wrong.** Pages was serving
`/_astro/*` — file names that carry a content hash — as
`public, max-age=0, must-revalidate`: a revalidation request per asset per
visit, for files that cannot change without changing name. They now go out
`immutable` for a year.

**The security half does not stop an attack this site can suffer.** It is
static, has no forms, no session and no credentials. What the headers do is
bound what the two scripts that are NOT ours (Clarity and the Cloudflare
beacon, both third-party, both without SRI) are allowed to reach, and answer
the scanner a client runs before hiring somebody to build their site.

Two directives are looser than they look, and both are honest costs of a
decision made elsewhere:

- `style-src 'unsafe-inline'` — `inlineStylesheets: "always"` puts every
  stylesheet in the HTML as a `<style>` element, and `anchors.ts` emits one
  more. CSP cannot tell those from an injected one without per-build hashes
  Astro does not emit.
- `font-src data:` — Vite inlines assets under 4 KB, so the small Manrope
  subsets land in the CSS as base64. Without it Chrome refuses six font files
  and the page silently drops to the system stack. That one was found by
  loading the built site under the real headers, not by reading them.

**Where it is verified:** `served.check.ts`, which runs from the smoke against
the published response. It is the only place that can — `_headers` is inert
text in `dist/` and becomes behaviour only when Pages parses it, so a wrong
indent fails nothing locally.

---

## 5. Privacy

**Clarity starts on the visitor's first interaction, not on load** (scroll,
pointer, key or touch — `src/scripts/analytics.ts`). The reason is measured:
the tag pulls ~26 KB and writes eight third-party cookies, `MUID` and `MR` on
`bing.com` among them, and those cookies are the entire distance between the
landing's Lighthouse Best Practices (79) and the 100 that `/cv`, which carries
no analytics, already scores. Behind an interaction the cost lands only on
visits that turned into something, and the recordings still cover every session
where anything happened — a visitor who never scrolls has nothing to record.

It is **not** a consent banner and does not pretend to be one: it changes when
the measurement starts, not what it collects.

Clarity uses cookies and records sessions; CWA uses none. The site has no forms
and Clarity masks inputs by default, so the real risk is low — but if EU traffic
arrives, consent is technically required. The least that is reasonable is a line
in the footer saying page usage is measured with Clarity, linking to its policy.
That line is in `index.astro` and not in `Base.astro`, for the same reason the
script is: if the analytics are removed, the line goes with them instead of being
orphaned on `/cv`.

---

## 6. Expectations about the data

**A heatmap with 30 visits a month is noise.** It takes several hundred sessions
for the hot spots to mean anything. In the first weeks what will be useful are
the **session recordings** — five real sessions say more than a heatmap with
twenty clicks — and the **scroll depth**, which needs far less volume to be
readable.

The three questions worth looking at:

1. **Do they reach the CV?** If the scroll dies at the map, the landing is pretty
   and does not convert.
2. **Do they download the PDF?** Clicks on the floating button versus the hero's.
   If the floating one is not used, it is surplus.
3. **Which CV section retains?** That is what says which achievements are written
   well and which are not.

---

## 7. Status

- [x] Pages project created and connected — `cribbnicolas.pages.dev`
- [x] Build variables loaded (`NODE_VERSION`, `PNPM_VERSION`, `SITE_URL`)
- [x] Browser Run token created and `BROWSER_RENDERING_*` loaded in Production
- [x] `/cv.pdf` verified in production — 10/10, tagged included
- [x] `smoke-deploy.yml` firing on every deploy
- [x] Rulesets per branch (`main`, `staging`, `develop`) with required checks
- [x] Custom 404 page
- [x] Web Analytics and Clarity, landing only, with the privacy line
- [x] `public/_headers`: `immutable` for the hashed assets, CSP and the rest of
      the security headers, verified from `served.check.ts`
- [x] `BROWSER_RENDERING_*` loaded in **Preview** too — verified 2026-09-04:
      `staging.cribbnicolas.pages.dev/cv.pdf` answered 200 with a full PDF, so
      the 503 this line used to warn about no longer applies
- [ ] `PDF_REFRESH_TOKEN` set in Production, so the manual re-render exists
- [ ] Domain bought, pointed, and `SITE_URL` updated
