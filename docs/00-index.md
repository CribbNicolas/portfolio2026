# Documentation — portfolio2026

Everything we know and everything we decided. If it is not here, it does not
exist.

| Document | What it holds |
|---|---|
| [06-next-session.md](./06-next-session.md) | **The three-phase work plan**, with how to proceed on each task. Start here |
| [2026-09-03-close-technical-debt](./superpowers/plans/2026-09-03-close-technical-debt.md) | The four remaining waves that close `07` to zero, plus the bilingual leftovers |
| [CONTRACT.md](./CONTRACT.md) | Rules of the content system |
| [01-filters-and-selection.md](./01-filters-and-selection.md) | How the filters work today, what the evidence says, what raises the score |
| [02-branding.md](./02-branding.md) | Positioning, headline, About, voice, LinkedIn |
| [03-cv.md](./03-cv.md) | Format, content, bullets, per-application checklist |
| [04-portfolio.md](./04-portfolio.md) | Structure, case studies, machine-readable layer |
| [05-deploy-and-analytics.md](./05-deploy-and-analytics.md) | The free stack (Cloudflare Pages builds and hosts, Browser Rendering prints the PDF, Actions is the gate, Clarity measures) |
| [07-technical-debt.md](./07-technical-debt.md) | What was found while working on something else and NOT fixed on the spot. With how to check it and what it costs |
| [08-branches-and-versioning.md](./08-branches-and-versioning.md) | The four branches, which one deploys, and why the version rises on merge |
| [09-seo-and-metadata.md](./09-seo-and-metadata.md) | What the `<head>` emits and what it deliberately does NOT, with the condition that would make each omission worth reconsidering. Debt gets paid; a decision gets reviewed |
| [10-i18n.md](./10-i18n.md) | The bilingual workflow: Spanish first always, the lock loop, what is translated and what is not, what is bilingual today and what deliberately is not |

---

## Decisions taken

Dated, so we know what to revisit when the context changes.

| Date | Decision | Reason |
|---|---|---|
| 2026-08 | Market: **Argentina/LatAm in Spanish + own freelance clients** | Sets the language, format and keywords of all the material |
| 2026-08 | Positioning: **Product Engineer** (brand) / **Desarrollador Full Stack** (search) | The memorable identity and the searchable term are different things |
| 2026-08 | AI is **a visible pillar, not the axis** | In LatAm freelance, "AI-powered" in the headline moves you toward the noise; the differentiator is shipping product |
| 2026-08 | `careerStart = 2020-04` | Settles the three different seniority figures that were circulating |
| 2026-08-31 | Hogarth: `full-time` + `concurrent: true`, 2023-07 → 2024-01 | Confirmed: overlapped Adsmovil (both full-time). Adsmovil 2022-06 → 2024-09, then Dinkum |
| 2026-08 | Content as data, backend later (Phase 0 → JSON in the repo) | The data contract is what gives independence, not the backend |
| 2026-08 | No English dataset for now | Translating a CV produces translated English, which is worse than written English |
| 2026-08 | Frontend in **static Astro**, PDF printed from the same `/cv` page | One layout for HTML and PDF: they cannot drift apart |
| 2026-08 | Only `cv-ats` is rendered; the designed CV (CV-A) waits | One artifact = never wondering which to send. The surface machinery already supports adding the other |
| 2026-08 | `cv-ats` is out of `publishPhoneOn` | `/cv` HTML and the PDF share a surface: publishing it there put it on the open web |
| 2026-08 | The **knowledge map is the front page**; `/lab` was deleted | It was a separate route while the home was a placeholder. Two pages with the same hero was duplication with no reader |
| 2026-08 | The map came **before** the design research of [04 §6](./04-portfolio.md) | The map is the only surface showing the data graph; postponing it for typography was postponing what makes the site different. The research is still pending for the case studies |
| 2026-08 | The **home ships JavaScript**; `/cv` stays at zero | The map needs it. `/cv` is not negotiable: the PDF is printed from there and a script changes the render silently. Allowlist in `no-client-js.check.ts` |
| 2026-08 | Node size = **years of use × connections**, by square root | A fixed size per kind said nothing. The years derive from `Skill.periods` or from the dated evidence — never estimated |
| 2026-08-24 | The site is a **single landing**: hero, anchor index, map, projects and the full CV at `/` | A CV does not need navigation. Two pages split in half the one visit you are going to get |
| 2026-08-24 | `/cv` stops being a destination: `noindex`, no incoming links, only the PDF's print source | It is what it always was underneath. `single-landing.check.ts` holds it up, not good memory |
| 2026-08-24 | The landing's CV section uses `cv-ats`, not `portfolio` | The button promises "the CV": if the section showed more achievements than the PDF, the promise would be false. The test compares the counts |
| 2026-08-24 | The index and the floating button are anchors and an `<a download>`, no JS | The home's budget is for the map. Navigation that costs bytes is navigation done wrong |
| 2026-08-24 | The index, the contact and the download move into a **fixed bar** following the scroll; the hero loses its buttons | The two large buttons pushed the map off the first screen. Navigation and the page's single action have to be available throughout the scroll, not only at the top. Together and not in opposite corners: separating the CTA from the index turned it into a loose element |
| 2026-08-24 | Every section shares `--width` (45rem) | With different widths (hero 40, map 52, CV 45) the page read as four pages glued together. 45rem is the measure `/cv` was already using |
| 2026-08-25 | No backend. Keystatic discarded, Sanity postponed | With the data outside git, the content stops passing through the gates: `validate`, rules 7 and 8 and `test:pdf` run on push, not on a webhook. Detail in [06](./06-next-session.md) |
| 2026-08-26 | `Skill.periods` replaces `since`: a list of spans, years as the sum of the merged ones | A technology gets dropped and picked back up. An end-to-end span counted the gap as experience |
| 2026-08-26 | The repo migrates to **English**: identifiers, comments and docs | The chat stays in Spanish. The CV content stays in Spanish — it is what the reader reads |
| 2026-09-02 | The site is bilingual: Spanish at the root, English under `/en/` | The market is LatAm and Spanish stays canonical, but the CV is read by English-speaking recruiters and agents |
| 2026-09-02 | This REVERSES "No English dataset for now" (2026-08) | The mitigation stands: the English is written and reviewed, not machine-emitted and shipped |
| 2026-09-02 | Staleness through per-field hashes, not a per-file `updatedAt` | A file timestamp says the whole translation is old the moment a date changes. A hash per field says which text drifted |
| 2026-09-02 | Chrome copy in `messages.ts`, author's text in the dataset | The compiler covers one; the lock covers the other. Neither covers both |
| 2026-09-02 | The PDF is `Cribb_Nicolas_CV_<updatedAt>.pdf` | An ATS does not read the file name; the list that shows it truncates near 30-35 characters |

## Status

- [x] Schema and data contract
- [x] Validation (Zod + hard rules) — `pnpm run validate`
- [x] Tests of the rules the schema does not validate (visibility, locale) — `pnpm test`
- [x] Seed dataset with real data
- [x] Repo in git, on GitHub, with CI on every push
- [x] Output generators: CV PDF, `/cv` HTML, JSON-LD, `llms.txt`, `/cv.json`
- [x] Knowledge map on the home (server-rendered SVG + optional WebGL)
- [x] Single landing: anchor index, projects section and the full CV at `/`; `/cv` isolated with `noindex` and `test:landing`
- [x] Deploy on Cloudflare Pages, PDF on demand from a Function, post-deploy smoke
- [x] Analytics: Cloudflare Web Analytics + Clarity, landing only
- [x] Social metadata: Open Graph, Twitter Card, generated card, favicon, sitemap, robots
- [x] **RPPL map** (`mapas-distritos`) — live link, problem/outcome, FastIndex
      metric and ~13.000 districts. Loaded 2026-09-01. The other two projects
      still have `links: []`
- [ ] **Metrics** — two loaded on the RPPL map; the rest of the gap is in [03-cv.md](./03-cv.md)
- [x] Hogarth `full-time` + `concurrent` (2023-07 → 2024-01) and English **A2**, confirmed 2026-08-31
- [x] Phase 1 closed: 15 of the 18 debt entries, including the three gates that did not exist (invariants, endpoints, embedded fonts)
- [x] `pnpm run editor` — phase 2 of [06](./06-next-session.md), including the PR 4 affordances (remove, header, prune, 409 latch)
- [x] Bilingual site: `content.en.json`, `/en/` + `/en/cv`, both CV PDFs, an
      ES/EN switch on both landings. Workflow in [10-i18n.md](./10-i18n.md)
- [x] `hreflang` on both landings: `es` → `/`, `en` → `/en/`, `x-default` → `/`; absent from `/cv` and `/en/cv`
- [x] **`/en/llms.txt` and `/en/cv.json`** — same factory as the Spanish pair;
      headings in `messages.ts`
- [x] **OG card per locale** — `public/og.jpg` and `public/og.en.jpg`
- [x] **Bilingual 404** — one `404.html`, Spanish first, English below
- [x] **English voice pass** — `identity.summary.long`, Hogarth, metric labels.
      Author still to read the summary and Hogarth before treating the voice as
      signed off.
- [ ] LinkedIn text blocks
- [ ] Portfolio case studies — the research of [04 §6](./04-portfolio.md) comes first
- [x] Freelance 2020-04 → 2022-06 connected to WordPress, Docker, Vue, Quasar, SCSS (still one achievement; the stack is now on the map)

## A note on the sources

The data in the filters section comes from research done in August 2026. Much of
what circulates about "ATS 2026" is CV-tool marketing, so that document
explicitly separates what has a primary source from what is folklore. Once a few
months pass, revalidate before making decisions on that basis.
