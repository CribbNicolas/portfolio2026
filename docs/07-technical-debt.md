# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost.

**15 of 18 entries are closed.** The open ones keep their original numbers: a
renumbered list breaks every reference from a commit message or another doc.

What does **not** go here: product and data pending items, which live in
[00-index](./00-index.md) and [06-next-session](./06-next-session.md). This is
only code and infrastructure debt.

---

## Resolved

Kept as a one-line record. The reasoning is in the commit that closed each one.

| # | What it was | Closed by |
|---|---|---|
| 1 | Soft 404: a non-existent route returned `200 text/html`, so crawlers treated broken URLs as valid pages | `src/pages/404.astro` + the check in `single-landing.check.ts` |
| 2 | Vite warned that a chunk exceeded 500 kB on every build. The warning described the intended design, and a warning that is always there is one nobody reads | `chunkSizeWarningLimit: 600` in `astro.config.mjs`, with the comment saying the real ceiling is `bundle-budget.check.ts` |
| 3 | Three dead symbols in `graph-3d.ts`. `ORBIT` was the bad one: a configuration constant with a believable name that did nothing | Deleted, and the two genuinely ignored values marked as such |
| 4 | Three `<script>` tags carrying the `astro(4000)` hint | Explicit `is:inline`. Typecheck went from 7 hints to 0 |
| 5 | A merge into `main` left no CI run of its own, which reads as if the merge skipped validation | Accepted and closed. The check that counts comes from the `pull_request` event and always runs; the per-branch run adds nothing |
| 8 | `/cv.json` and `/llms.txt`, the two surfaces agents consume, had no gate at all. A real `formatRoleTitle` bug had already got through into one of them | `scripts/endpoints.check.ts`, in `content-validation.yml` with the other checks that read `dist/` |
| 9 | The skill grouping lived in two places and had diverged: the CV printed `Lenguajes:` in editorial order, `/llms.txt` printed `- language:` in insertion order | `content/schema/skill-groups.ts`, imported by both |
| 10 | Nothing verified the fonts were embedded. The PDF would look right on a machine with Manrope installed and wrong on every other one | A test in `pdf-output.check.ts` reading the font descriptors, which runs against the published PDF too |
| 11 | `pnpm audit` reported a high through `astro > sharp <0.35.0`, so `audit:deps` failed on every run | An `overrides` entry in `pnpm-workspace.yaml` — pnpm 11 no longer reads `pnpm.overrides` from package.json |
| 12 | Three acceptance criteria lived in an old plan as commands to paste into a terminal | Two were already covered (`no-client-js.check.ts` is stricter than criterion 3's grep; `jsonld.test.ts` covers criterion 4). The third — invariant 1 — is now `scripts/invariants.test.ts` |
| 14 | `smoke-deploy.yml` never ran: it listened for `deployment_status`, and Pages publishes a *check run*, not a GitHub Deployment. The gate went weeks without firing once | Rewritten around `check_run` + `/build.json` to wait for the published commit |
| 15 | The checks read `dist/`, so anything injected after the build — Web Analytics enabled from the dashboard — was invisible | `served.check.ts`, the only one verifying the served response |
| 16 | The smoke treated a 429 from Browser Rendering as a broken PDF. It is the quota, not a failure | The smoke warms the PDF tolerating the 429; `pdf-output.check.ts` tells the two apart in its message |
| 17 | The `<head>` had seven tags: no Open Graph, no Twitter Card, favicon 404, sitemap 404 | `Base.astro` with opt-in `shareable`, `favicon.svg`, `robots.txt.ts`, `@astrojs/sitemap` |
| 18 | No social image existed, so the card had nothing to show | `build-og.ts` + `og.lock.json` + `og-output.check.ts` |

---

## 6. The Function cannot be tested end to end locally

**Severity: low. It is a limitation, not a defect — noted so it is not
rediscovered.**

`pnpm dlx wrangler pages dev dist` serves `/cv.pdf` and is enough to verify
routing, caching and the error paths. What it **cannot** verify is the render:
the Function asks Browser Rendering to print `http://localhost:8788/cv`, and that
URL does not resolve from Cloudflare's cloud.

So the render is only tested by deploying. That is covered today by
`smoke-deploy.yml`, which runs `test:pdf` against every successful deploy —
previews included — so the cycle is "push to `staging` and watch the smoke", not
"push to production and pray".

**Way out, if it ever becomes annoying:** a tunnel (`cloudflared tunnel`)
exposing the local `wrangler pages dev` on a public URL. That is infrastructure
for a problem solved today by waiting a minute for a preview. It does not look
worth it.

---

## 7. The public API publishes internal fields

**Severity: medium.** It is a contract with third parties, and the repo is now
public.

`/cv.json` serves the `public-api` surface, but `resolveView` only filters
`phone` and `streetAddress`. Everything else passes through whole. Measured on
`dist/cv.json` from the 2026-08-25 build:

```
publishPhoneOn exposed: true
"priority"  keys in the output: 40
"visibility" keys in the output: 40
```

`visibility` and `priority` are **internal editorial decisions**: they say which
achievement you consider first-tier and which third-tier, and on which surfaces
you decided not to show something. A recruiter opening the JSON sees the ranking
you made of your own work. `publishPhoneOn` also describes a privacy policy
nobody outside cares about.

**Why it was not fixed here.** Touching `resolveView` is touching the file rule 8
depends on, and doing that in the middle of a deploy change is asking for it.

**Fix.** In `resolveView`, for the `public-api` surface, map `Achievement` and
`Skill` to a shape without `visibility` or `publishPhoneOn`. It is a projection,
not a filter: the output type would have to be different from the internal
surfaces', and that is where the real work is.

---

## 13. Two things were never looked at by eye

**Severity: not measurable, which is why it is here.**

- **The card ↔ map cross-hover.** It is verified that the DOM ids match the
  `:has()` rules 3/3 and that there are no orphans. That proves the CSS points at
  something, not that it looks right.
- **The pill's inertia.** Simulated before committing — it drags 19.9 px, crosses
  zero 200 ms after stopping, bounces back 3.5 px — and switched off under
  `prefers-reduced-motion`. The numbers are correct; the feel has to be felt.
- **The PDF in a real viewer**, not only passing the ten tests.

Ten minutes with `pnpm run dev` and `pnpm run pdf:local`. It is the only entry on
this list that nobody but the author can close.
