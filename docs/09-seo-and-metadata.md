# 09 — SEO and social metadata

Written 2026-08-25 when phase 1.1 of [`06`](./06-next-session.md) closed.

This document exists for one thing: so the next person wondering *"is any SEO
missing?"* does not have to research it again. Below is what the site emits,
**what it deliberately does not and why**, and what would have to happen to
reconsider each omission.

The debt that does need fixing lives in [`07`](./07-technical-debt.md). What
goes here are decisions **not to do** something, which are different: debt gets
paid, a decision gets reviewed when the assumption holding it up changes.

---

## 1. What is emitted today

Measured over `dist/` on 2026-08-25.

| What | Where it is generated | Where it is enforced |
|---|---|---|
| `title`, `description`, `canonical`, `lang` (`es`/`en`, from the `locale` prop) | `Base.astro` | — |
| Open Graph: `type`, `title`, `description`, `url`, `locale` (`es_AR`/`en_US`, from the same `locale` prop) | `Base.astro`, behind the `shareable` prop | `og-output.check.ts` |
| `og:image` + `type`, `width`, `height`, `alt` | `Base.astro` over `public/og.jpg` | `og-output.check.ts` |
| Twitter Card `summary_large_image` + `title`, `description`, `image`, `image:alt` | `Base.astro` | `og-output.check.ts` |
| `hreflang` alternates (`es`, `en`, `x-default`), on the two indexable landings only | `Base.astro`, behind the `hreflang` prop — see §2.3 | `single-landing.check.ts` |
| JSON-LD `Person` (15 keys, with `sameAs`, `worksFor`, `alumniOf`, `knowsAbout`) | `src/lib/jsonld.ts` | — |
| `favicon.svg` | `public/`, geometry from `src/lib/brand.ts` | `og-output.check.ts` |
| `apple-touch-icon.png` 180×180 | `pnpm run og:local` | `og-output.check.ts` |
| `theme-color`, light and dark | `Base.astro` | `og-output.check.ts` |
| `robots.txt` with the `Sitemap:` line | `src/pages/robots.txt.ts` | — |
| `sitemap-index.xml`, with `/cv` and `/en/cv` excluded, `es`/`en` alternates via the `i18n` option | `@astrojs/sitemap` in `astro.config.mjs` | — |
| A real `404.html` | `src/pages/404.astro` | `single-landing.check.ts` |
| Two indexable landings (`/`, `/en/`); `/cv` and `/en/cv` with `noindex` and no incoming links | — | `single-landing.check.ts` |

**The social tags are opt-in**, not a default with exceptions: `/cv` and the 404
do not emit them because somebody remembered to switch them off, but because
`shareable` has to be asked for explicitly. Forgetting on a new page means not
emitting them, which is the safe side of the mistake. `hreflang` repeats the
same shape for the same reason — see §2.3.

---

## 2. What is NOT emitted, on purpose

Each one with the condition that would make it worth it. **None of them changes
whether the link previews correctly**: that already works.

### 2.1 `og:site_name`

**Why not.** The tag exists to distinguish a page from the site containing it
("this article" inside "Wikipedia"). Here the site *is* the person, and
`og:title` already starts with the full name. Slack and LinkedIn render it
stacked above the title, so emitting it would give:

```
Nicolás Agustín Cribb Barbaro
Nicolás Agustín Cribb Barbaro — Desarrollador Full Stack
```

The name twice in a row reads as a bug in the card, not as metadata.

**When to reconsider.** If the site takes on a brand name different from the
person's name, or if destination pages beyond the landing get added (case
studies, for example): that is when `og:site_name` starts doing the job it exists
for.

### 2.2 `profile:first_name` and `profile:last_name`

**Why not.** `og:type` is `profile`, so these properties apply. The problem is
that `identity` stores `fullName` as a single field, and splitting "Nicolás
Agustín Cribb Barbaro" into first and last name is **guessing** where two given
names and two surnames divide. A `split(" ")` would give
`first_name: "Nicolás"` and `last_name: "Agustín"`, which is simply wrong.

Inventing a datum to fill a field goes against invariant 4, and no known consumer
uses these two properties to render the card.

**When to reconsider.** If the schema gains `givenName` / `familyName` fields —
which schema.org's `Person` would also make use of — they come for free and with
no guessing. That is phase 2 editor work, not this document's.

### 2.3 `hreflang`

**Emitted since 2026-09-03**, on the two indexable landings only: `es` → `/`,
`en` → `/en/`, `x-default` → `/`. `x-default` is Spanish, not a guess at the
visitor's browser language, because the market this CV is written for is
LatAm.

This entry keeps its number and its place under "what is NOT emitted", even
though the tag itself now is: `docs/00-index.md`, `docs/10-i18n.md` and three
code comments (`Base.astro`, `src/pages/index.astro`,
`single-landing.check.ts`) all point readers at "docs/09 §2.3" for this
reasoning. Moving the text into §1's table on the day the absence closed would
turn every one of those into a pointer at nothing — the anchor staying put is
worth more than the section header being literally true.

**Why it waited.** `content.en.json` existing was not enough on its own:
`hreflang` on a page tells crawlers "here is the equivalent of this URL in
another language", and `/cv` / `/en/cv` are both `noindex` — asking a crawler
to follow a language alternate into a page it is also told not to index is a
contradiction crawlers report as an error, not a courtesy they ignore. The
condition that closed it: `/` and `/en/` both existing as real, indexable
landings — see [`10-i18n.md`](./10-i18n.md) for the whole bilingual system.
Once that pair existed, `hreflang` stopped being a promise about a page nobody
should crawl and became a real annotation.

**Where it is enforced.**
- `Base.astro`'s `hreflang` prop — opt-in, the same shape as `shareable` and
  for the same reason: a new page that forgets to pass it emits nothing, which
  is the safe side of the mistake — renders the three `<link rel="alternate">`
  tags, reciprocally, on both landings.
- `@astrojs/sitemap`'s `i18n` option in `astro.config.mjs` makes the sitemap
  declare the same `es`/`en` relations, so the sitemap and the `<head>` cannot
  silently disagree — a sitemap that disagrees with the tags is worse than a
  sitemap that says nothing about locales. It carries no `x-default`: the
  underlying `sitemap` package links locales that share a URL after stripping
  the path segment, one `hreflang` per physical page, and there is no third
  page for `x-default` to point at. The `<head>` tag is where `x-default` is
  authoritative; Google's sitemap guidance treats the sitemap copy as
  optional.
- `single-landing.check.ts` asserts both halves over `dist/`: `es`/`en`/
  `x-default` present and reciprocal on both landings, and absent on `/cv` and
  `/en/cv`. It runs from `dist/`, not `served.check.ts`'s published response,
  because nothing between the build and the edge can alter a `<link>` tag the
  way an injected `<script>` can — the blind spot `served.check.ts` exists for
  does not apply here.
- Closed alongside [`07-technical-debt.md`](./07-technical-debt.md) #37: the
  bundle-budget check that had gone blind to the second landing.

### 2.4 `twitter:site` and `twitter:creator`

**Why not.** There is no Twitter account: `identity.links` has GitHub and
LinkedIn and nothing else. The card works anyway — `summary_large_image` does not
need an account; the only thing lost is the "via @user".

**When to reconsider.** If an account appears in `identity.links`. It is worth
deriving it from the dataset rather than writing it by hand, like everything else.

### 2.5 One social image per platform

**Why not.** It is the most common confusion on the topic, and the answer is that
**it is not needed**: Facebook, LinkedIn, WhatsApp, Slack, Discord and Twitter
read the SAME `og:image` tag. What differs between them is how they crop it, not
which file they ask for. One 1200×630 image covers them all.

The case that does stay uncovered is the square crop some messaging clients use
for the small thumbnail in the chat list: there the edge of the text is lost. It
is the least-seen variant of the card, and designing the main one to survive that
crop would make it worse on the six platforms where it is seen whole.

**When to reconsider.** If it is ever measured that traffic arrives mostly
through square thumbnails. Today there is no data suggesting that.

### 2.6 `favicon.ico`

**Why not.** The SVG is supported by every current browser. The ones that are not
— Safari before 15 — show **no** icon at all, which is exactly what happened
before the favicon existed. The `.ico` would be one more binary file in the repo
for a compatibility tail that shrinks on its own.

**When to reconsider.** If analytics show real traffic from old browsers. The
generator already exists: emitting it would be adding one more size to
`build-og.ts`.

### 2.7 `manifest.webmanifest` and PWA

**Why not.** A manifest is for installing an app. This is a single-page portfolio
visited once, from a link somebody sent. Nobody installs it. `apple-touch-icon`
covers the one real case — saving it to the home screen — without the rest of the
machinery.

**When to reconsider.** No, unless the site becomes something else.

### 2.8 More schema.org than `Person`

**Why not.** `BreadcrumbList` describes a navigation hierarchy, and the single
landing has no hierarchy: it is one page. `WebSite` + `SearchAction` declares an
internal search, and there is no search. Emitting structured data describing
something that does not exist is worse than not emitting it — Google flags it as
inconsistent.

**When to reconsider.** If the case studies appear as pages of their own, that is
when `BreadcrumbList` starts describing something real.

---

## 3. Still to be verified against a deploy

Neither can be checked from `dist/`. They get looked at on the `staging` preview.

1. **That `src/pages/robots.txt.ts` beats Cloudflare's managed `robots.txt`.**
   Cloudflare serves one today that is only comments, no directives. If the
   managed one wins, the sitemap has to be announced through Search Console and
   noted here as a limitation.
2. **How the card actually looks.** Paste the preview URL into a chat and into
   LinkedIn's validator.

What is confirmed: **`SITE_URL` is configured in Cloudflare Pages**. Production
emits the canonical with the real host and not the `portfolio.invalid` fallback,
so the absolute URLs of `og:image` and `og:url` come out right. If it were not
set, all the social metadata would point at a non-existent domain and nothing
would have given it away until someone shared the link.

---

## 4. The gate

`public/og.jpg` and `public/apple-touch-icon.png` are **committed** artifacts:
they are generated with `pnpm run og:local` and not in the build, because
rasterizing needs Chromium and the Cloudflare builder does not have it (the same
reason that took the PDF out of the build).

A committed artifact drifts out of sync silently. That is why `og.lock.json`
stores the fingerprint of **everything** visible in them — the dataset texts, the
photo, the template source and `src/lib/brand.ts` — and `pnpm run test:og` fails
when they stop matching.

`brand.ts` is in the fingerprint for a concrete reason: without it, adjusting a
curve of the logo left the card and the iOS icon drawing the old brand with
nothing failing.

The same check covers two things that are not the card but are the same class of
silent bug: that `favicon.svg` still draws the ring from `brand.ts` — it cannot
import it, being a static file — and that its comments parse as XML, which is
what left it not rendering for three commits.
