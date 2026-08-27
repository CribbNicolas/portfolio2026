# 01 — Selection filters: how they work and what to do

Research from August 2026. Split into what has a primary source and what is
repeated folklore.

---

## 1. The real funnel: three layers, not one

What is generically called "the ATS" is in fact three different filters that
reward different things. Understanding this resolves the contradictions you read
elsewhere.

### Layer 1 — Parser + keywords

The classic ATS parses the CV into structured fields and matches it against the
job description. **If parsing fails, nothing that follows matters.** It is the
dumbest layer and the most lethal, and it runs first.

What breaks it:
- Two columns, sidebars, tables, text boxes
- Headers and footers
- Icons and graphics with text inside
- PDFs exported as an image

What satisfies it: one column, sections with standard names, selectable text.

### Layer 2 — An LLM that summarises and ranks

It sits on top of the parser, over the already extracted text. It summarises,
scores and sometimes produces a ranking. It is the layer that grew fastest in the
last two years and the one introducing new behaviours — among them the bias in
section 2.

What satisfies it: clear structure, domain vocabulary, semantic density,
coherence between sections (it cross-checks dates, titles and skills against each
other).

### Layer 3 — The human

Reads for 10 to 30 seconds. Looks for reasons to discard, not to advance.

What makes them discard: generic prose, absence of numbers, things that sound
like a template.

**The key point: layers 2 and 3 reward almost opposite things.** The whole
strategy comes from there.

---

## 2. The AI paradox, resolved

Two claims circulate that look contradictory. Both are true, at different layers.

### For writing "AI style": the self-preference bias

A controlled experiment ([Xu, Li & Jiang,
arXiv:2509.00462](https://arxiv.org/abs/2509.00462)) found that LLMs prefer
LLM-generated CVs over human-written ones, controlling for content quality, with
a bias of between **67% and 82%**. Simulating real pipelines across 24
occupations, a candidate using the same model as the evaluator has between
**23% and 60% more chance** of being shortlisted.

### Against: the human filter

- **49%** of hiring managers discard what they identify as AI-generated.
- **62%** specifically reject what has no personalisation.
- Around **20%** reject any AI-assisted application, with no nuance.

### What reconciles the two

When hiring managers were asked to identify letters written by ChatGPT, **only
18% got all three right**. An 82% failure rate.

**They are not detecting AI. They are detecting generic text.** And because
generic text and AI text tend to be the same thing, they mistake one for the
other.

The MIT/NBER randomised controlled trial ([WP
30886](https://www.nber.org/papers/w30886)), with 480,948 job seekers, measured
**+7.8% in hires** when AI edits human prose — with the largest effect among
non-native English writers. That study measures **AI as an editor**, not as an
author generating from scratch.

### The operating rule

> **The AI supplies the skeleton and the vocabulary. You supply the facts nobody
> else could write.**

A product name, a number, a technical decision with its trade-off. That passes
all three layers at once: layer 2 sees structure and density, layer 3 sees
something that could not have come out of a template.

### A specific risk for Spanish speakers

Stanford HAI's analysis of more than 10,000 samples showed that AI detectors have
**over 20% false positives with non-native English writers**. If an English
version is ever made, a correct but neutral text is doubly exposed. The antidote
is the same: verifiable specificity.

---

## 3. Myths to remove from the operating system

| Myth | Reality |
|---|---|
| "The ATS automatically rejects 75%" | No primary source. It comes from a 2012 sales pitch by Preptel, a startup that shut down in 2013. It has been repeated ever since. |
| "The ATS auto-rejects on formatting" | In a survey of US recruiters, **92%** confirmed their ATS does not auto-reject. Only 8% configure auto-rejection, typically by threshold (under 75% match, or fewer than 7 of 10 required skills). |
| "You have to hide keywords in white text" | Modern ATSs flag hidden text as manipulation. It is a direct discard. |
| "The more times the keyword repeats, the better" | In semantic matchers (Eightfold, Phenom), repeating a term **lowers** the score. |
| "Design breaks parsing" | Workday, iCIMS, Greenhouse and Lever parse formatted PDFs correctly, as long as there are no tables, text boxes, headers/footers or multiple columns. The problem is the structure, not the aesthetics. |

**The real enemy is not the filter: it is the volume.** Workday's customers
processed 173 million applications in the first half of 2024, +31% year over
year, while openings grew only 7%. You are not discarded by an evil algorithm;
you are diluted by a pile.

---

## 4. What raises the score, by surface

### CV
- One column, standard sections (`Perfil`, `Habilidades técnicas`,
  `Experiencia`, `Educación`), a PDF with selectable text.
- **Literal** keywords where they are proper tool names (if the posting says
  "Vue.js", write "Vue.js"), and by synonym where layer 2 already reasons.
- Coherence between sections: the dates, the titles and the skills have to agree
  with each other and with LinkedIn.
- One adapted version per job family. See [03-cv.md](./03-cv.md).

### LinkedIn
- Recruiter search ranks by **semantic relevance**, not only literal matching.
- Endorsement weight per skill affects the ranking: **10-20 relevant skills
  perform better than 50 generic ones**.
- Inactive profiles rank below equivalent active ones. Two or three substantive
  interventions a week is enough.
- The headline is the heaviest field and appears in every search, comment and
  message.

### Portfolio
- For the human: **problem → decision → outcome** format, with 3-5 projects with
  a live demo and an explicit stack.
- For the agent (more and more recruiters paste the URL into an LLM):
  server-rendered JSON-LD `Person`, semantic HTML, `/llms.txt`, `/cv` in HTML
  alongside the PDF. See [04-portfolio.md](./04-portfolio.md).

---

## 5. What this means for the content system

These conclusions are encoded in the schema, not only written here:

| Conclusion | How it is enforced |
|---|---|
| Coherence between sections | A single `careerStart`, derived durations (rule 1) |
| No unexplained overlapping full-time roles | Rule 2, validated in CI |
| Do not claim skills without evidence | Rule 3, validated in CI |
| Honest numbers | `Metric.confidence`, rendered with "~" when estimated |
| Literal keywords per posting | `Skill.aliases` |
| Brand vs. search | `brandTitle` / `searchTitle` |
| Parseable output | The `cv-ats` surface, one column |

---

## 6. Sources

**Primary (reliable):**
- Xu, Li & Jiang — *self-preference bias in LLM screening*,
  [arXiv:2509.00462](https://arxiv.org/abs/2509.00462)
- MIT/NBER Working Paper 30886 — RCT on AI assistance in applications,
  [nber.org/papers/w30886](https://www.nber.org/papers/w30886)
- Stanford HAI — bias of AI detectors against non-native writers
- Harvard Business School, *Hidden Workers: Untapped Talent* (2021)

**Secondary (industry surveys, handle with more care):**
- Recruiter surveys on rejecting AI-generated material (StandOut-CV /
  TopResume, Enhancv)
- Workday volume data

**To distrust:** any article titled "ATS in 2026" published by a company selling
CV templates or optimisation services. Almost all of them cite Preptel's 75%.
