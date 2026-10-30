---
name: linkedin-copy
description: Use when the author asks for LinkedIn text — headline, "Acerca de"/About, skills to list or pin, a post, an experience entry, or profile tweaks — or for any copy meant for LinkedIn rather than the site.
---

# LinkedIn copy

## Overview

LinkedIn text is a derived view of the dataset, like the CV: generated on
request, never stored in the repo. Facts come only from
`content/data/content.es.json` (English: `content.en.json`); the voice rules are
CLAUDE.md invariant 6. Output is Spanish unless asked otherwise, ready to paste.

## Sources

| Need | Where |
|---|---|
| Titles | `identity.searchTitle`, `identity.brandTitle`, `identity.titleAliases` |
| About | `identity.tagline`, `identity.summary.long`, achievements with `priority` 1–2 |
| Numbers | `metrics` only, through the same "~" rule as the site (estimated → "~") |
| Skills | `skills` with `level` core/working; skip ones with `visibility.only: []` |
| Confidentiality | DeltaDictum `content/confidentiality` — no Hogarth client, no Adsmovil product names, no freelance clients |

Never write years of experience: they derive from `careerStart` and a fixed
number goes stale (CLAUDE.md invariant 2). Never invent a number (invariant 3);
if a bullet needs one and the dataset has none, write it without.

## Headline (≤220 characters)

Search title FIRST — recruiters in LatAm type "Desarrollador Full Stack", never
"Product Engineer". Then the brand, then stack, then the differentiator or an
availability signal. Technical terms in English. No word repeated: repeating a
keyword lowers the score in semantic matchers.

`Desarrollador Full Stack (Product Engineer) | React · Next.js · TypeScript · Node.js | <differentiator> | <signal>`

## About

- The first ~220 characters show without "ver más" and weigh most: open with the
  tagline, then who and where.
- 2–4 bullets: project → what it solved → number if the dataset has one.
- One stack paragraph for keyword density.
- AI as owned verification ("lo que entra al repo lo reviso yo"), never the
  headline.
- Close with what the author is looking for (last paragraph of `summary.long`)
  and contact (email + `https://cribbnicolas.pages.dev`).

## Skills

15–20, not 50. Pin React · TypeScript · Next.js unless the author says
otherwise. Suggest asking 3–5 former colleagues for endorsements on the pinned
three: an endorsed skill ranks above the same skill without them.

## Posts

Short, one idea, first line carries it. Name a concrete project or decision. A
link post: remind the author to check the card in LinkedIn's Post Inspector
first.

## Profile checklist (offer when asked for a review)

Custom URL; professional photo; banner with the value proposition as text;
Featured: portfolio, main case study, GitHub; same dates, titles and skills as
the CV — parsers cross-check sections.

## Common mistakes

- Brand title first in the headline.
- A number that is not in the dataset, or years of experience.
- Naming a confidential client or product.
- Banned words (CLAUDE.md invariant 6) — run the voice test on every line.
