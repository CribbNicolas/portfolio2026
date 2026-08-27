# 07 — Technical debt

Opened 2026-08-25, while moving the PDF to runtime (see
[05](./05-deploy-and-analytics.md)).

Things found while working on something else. **None of them were fixed on the
spot, on purpose:** putting unrelated fixes into a deploy PR makes the diff stop
telling one story, and dilutes the review of what actually mattered.

This file exists so they do not get lost. Each entry says what it is, **how to
check it** — so the next session does not have to take my word for it — and what
fixing it would cost. Ordered by impact, not by effort.

What does **not** go here: product and data pending items, which live in
[00-index](./00-index.md) and [06-next-session](./06-next-session.md). This is
only code and infrastructure debt.

---

## Resolved

Kept as a one-line record. The reasoning is in the commit that closed each one.

| # | What it was | Closed by |
|---|---|---|
| 1 | Soft 404: a non-existent route returned `200 text/html`, so crawlers treated broken URLs as valid pages | `src/pages/404.astro` + the check in `single-landing.check.ts` |
| 14 | `smoke-deploy.yml` never ran: it listened for `deployment_status`, and Pages publishes a *check run*, not a GitHub Deployment. The gate went weeks without firing once | Rewritten around `check_run` + `/build.json` to wait for the published commit |
| 15 | The checks read `dist/`, so anything injected after the build — Web Analytics enabled from the dashboard — was invisible | `served.check.ts`, the only one verifying the served response |
| 16 | The smoke treated a 429 from Browser Rendering as a broken PDF. It is the quota, not a failure | The smoke warms the PDF tolerating the 429; `pdf-output.check.ts` tells the two apart in its message |
| 17 | The `<head>` had seven tags: no Open Graph, no Twitter Card, favicon 404, sitemap 404 | `Base.astro` with opt-in `shareable`, `favicon.svg`, `robots.txt.ts`, `@astrojs/sitemap` |
| 18 | No social image existed, so the card had nothing to show | `build-og.ts` + `og.lock.json` + `og-output.check.ts` |

---

## 2. Vite warns that a chunk exceeds 500 kB

**Severity: low, but the noise covers things.**

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Measured on the 2026-08-25 build:

| Chunk | Raw | gzip |
|---|---|---|
| `graph-3d.<hash>.js` | 509 KB | **129 KB** |
| everything else together | ~12 KB | ~6 KB |

It is `three`, and **it is where it is supposed to be**. The map invariant
(`CLAUDE.md` §Map frontend, rule 2) is that `three` has one importer and is
loaded with a dynamic `import()`, off the critical path.
`bundle-budget.check.ts` verifies it with a 4 KB ceiling for the critical
chunks, and it passes. In other words: **the warning describes exactly the
intended design, and Vite has no way of knowing that.**

**Why it is debt anyway.** A warning that is always there is a warning nobody
reads. The day a critical chunk goes past 500 kB, the line will look identical
to today's and will go unnoticed.

**Two possible fixes, and they are not equivalent:**

- **Raise `build.chunkSizeWarningLimit`** above 509 KB in `astro.config.mjs`,
  with a comment saying why and that the real ceiling is set by
  `bundle-budget.check.ts`. Honest: it acknowledges that our own gate is stricter
  and better informed than the generic one. One line.
- **Split `three` into several chunks** with `manualChunks`. It sounds like an
  improvement but does not change a byte of what the visitor downloads: the same
  modules spread over more requests. It only makes sense if some day *part* of
  `three` is loaded in one case and part in another.

The first is recommended. Neither was done because touching `astro.config.mjs`
in a deploy PR is exactly the kind of unrelated change worth not mixing in.

---

## 3. Three dead symbols in `graph-3d.ts`

**Severity: low.** Nothing breaks. They are `astro check` hints, not errors, so
CI passes.

```
src/scripts/lab/graph-3d.ts  'ORBIT' is declared but its value is never read
src/scripts/lab/graph-3d.ts  'neighbourhood' is declared but its value is never read
src/scripts/lab/graph-3d.ts  'id' is declared but its value is never read
```

All three are leftovers from earlier iterations of the 3D map.

**Why it is not only tidiness.** `ORBIT = 0.14` is a configuration constant with
a name that sounds like it does something. Someone reading the file in six months
will assume the map's orbit is tuned there, and it is not. A dead constant with a
believable name misinforms more than the absence of a constant.

**Fix.** Delete `ORBIT`; on the other two, prefix with `_` the parameters and
destructured values deliberately ignored — the convention TypeScript understands
— or remove them if they are ignored by oversight rather than on purpose. It
requires reading the surrounding code to know which, which is why it was not
touched in passing.

---

## 4. Three `<script>` tags with the `astro(4000)` hint

**Severity: cosmetic.**

They are the `<script type="application/ld+json">` of the JSON-LD and the
`type="application/json"` carrying the graph data. Astro warns that, having a
`type` attribute, it does not process them and leaves them inline — which is
exactly what is wanted: they are data, not code.

**Fix.** Add an explicit `is:inline` to all three. It silences the hint by
declaring the intent, without changing the output. Five characters per tag.

Worth it for the same reason as entry 2: constant noise covers new signal. The
seven hints of today are harmless, and that is why nobody will read the eighth.

---

## 5. The merge into `main` left no CI run of its own

**Severity: low. Noted because it is confusing, not because it is broken.**

The merge of PR #4 produced `afdbfe2`. Runs for that SHA:

```
afdbfe2 | content-validation | staging | push | success
```

One, attributed to `staging` — the one triggered by the push that synced the
branch to the same commit. The push to `main` from the merge produced no run of
its own.

**The tree is verified**: same SHA, same checks, green. But if someone filters
the Actions history by `main`, they will not find it, and the easy and wrong
conclusion is that the merge skipped validation.

**Why it was not investigated.** It does not change the real mechanism: with
`main` protected by the required `validate` check, the check that counts comes
from the `pull_request` event, and that one always runs.

If having a per-branch run ever matters, the suspicion to confirm is that GitHub
does not re-fire `push` for a SHA that already has a run of the same workflow.
Unverified.

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

## 8. `/cv.json` and `/llms.txt` have not one test

**Severity: medium.** They are the two surfaces agents consume, and the only two
with no gate.

`/cv` has ten tests over the PDF, the landing has three checks, the bundle has a
budget. These two endpoints have nothing. A real `formatRoleTitle` bug already
got through into `llms.txt` once (recorded in PR #1).

**Checking it:**

```bash
ls src/pages/*.test.ts        # there are none
grep -rl "cv.json" --include="*.check.ts" scripts/   # only single-landing, and in passing
```

**Fix.** An `endpoints.check.ts` that, over `dist/`, verifies `cv.json` parses,
that it carries the keys the contract promises, and that `llms.txt` has no empty
fields and no split role titles. It fits with the other checks that already read
`dist/`.

---

## 9. Skill grouping is duplicated, and has diverged

**Severity: low.** Nothing breaks; the CV and the JSON say the same thing
differently.

Two places group skills by category, sharing nothing:

| Where | How |
|---|---|
| `src/components/cv/SkillList.astro` | A `GRUPOS` array, Spanish labels and **editorial order** — what is searched for most in a job post comes first |
| `src/pages/llms.txt.ts` | Raw `Object.entries(view.skills)`: English keys, insertion order |

So the CV says `Lenguajes: ...` and `/llms.txt` says `- language: ...`, in a
different order. An agent comparing the two surfaces sees two taxonomies.

**Fix.** Move `GRUPOS` to `content/schema/` and have both import from there. It
is the same pattern already applied with `formatMetric` (rule 4) and with
`pdf-options.ts`: when two outputs have to say the same thing, the definition
lives in one place.

---

## 10. Nothing verifies the fonts are embedded in the PDF

**Severity: low, with a long tail.**

It was checked by hand once and they are embedded. But if they ever stopped
being, the PDF would look fine on your machine — which has Manrope installed —
and would come out in a fallback font on anyone else's. None of the ten PDF tests
looks at this: they all verify the extracted TEXT, which does not change.

**New risk since 2026-08-25:** the PDF is now printed by Browser Rendering,
another Chromium on another machine. It is exactly the change that could break
this with nothing warning.

**Fix.** `pdfjs` exposes the fonts of each page; a test asserting they are all
embedded fits in `pdf-output.check.ts`, and since that file already runs against
the published PDF (`PDF_SOURCE`), it would cover both paths at once.

---

## 11. `pnpm audit`: 5 transitive vulnerabilities, one high

**Severity: low in practice, high on paper.**

Measured 2026-08-25 — more than the 3 PR #1 recorded:

```
5 vulnerabilities found
Severity: 2 low | 2 moderate | 1 high
```

The high one is `sharp <0.35.0`, through the `. > astro > sharp` chain.

**Why the real exposure is small.** The output is static HTML: there is no
server-side runtime an attacker can reach. `sharp` runs at build time, over
images you put there.

**Why it is debt anyway.** `pnpm run audit:deps` is one of the repo's commands,
and today it always fails. A command that always fails stops being read — the
same problem as entry 2, wearing a different face.

**Fix.** The real fix is bumping Astro, which is a major. In the meantime,
`pnpm.overrides` to force `sharp >= 0.35.0` and see whether the tree takes it.

---

## 12. Three acceptance criteria live in a plan, not in CI

**Severity: low.**

The plan `docs/superpowers/plans/2026-08-13-cv-como-sistema.md` leaves three
criteria as loose commands to paste into a terminal. An acceptance criterion that
does not run on its own is an intention, which is exactly what
`docs/CONTRACT.md` §1 says we do not do.

One of the three, the one verifying the phone number did not reach `dist/`,
became moot on 2026-08-25: the dataset no longer carries a phone number. The
other two need reading, then a decision on whether they are worth a check or are
already covered by another.

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
