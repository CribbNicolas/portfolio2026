# Hiring psychology for web developers: how recruiters, hiring managers and freelance clients evaluate a portfolio

Scope note: researched 2026-10-26. Evidence quality varies a lot. The research base is thin and much of what circulates is recycled. Below, each finding is labelled **[Study]** (peer-reviewed or methodologically described research), **[Survey]** (industry or vendor survey with a stated sample), **[Vendor]** (marketing content from a company with a commercial interest), or **[Opinion]** (practitioner writing or forum comments). Pre-2022 classics are marked **(classic, YEAR)**.

Warning to the report writer: several widely repeated statistics could NOT be traced to a primary source and should not be used. Examples are "73% of hiring managers value a portfolio over a resume (Stack Overflow 2024)" and "84% want live demos". See the Gaps under Q2.

---

## Q1. Eye-tracking and time-on-page: how long do reviewers spend, and what do they look at first?

### Takeaway
Judgments happen in two stages. First a near-instant aesthetic and trust verdict (50–100 ms). Then a short skim of a few seconds, which decides whether a real read happens at all. The first 10 seconds on a web page carry the highest risk of the visitor leaving. A visitor who stays about 30 seconds usually stays much longer. No study measures recruiter time on *portfolio sites* specifically. The figures available come from résumé studies and general web-page studies.

### Cited Findings
- **[Study] (classic, 2006)** Lindgaard et al., *Behaviour & Information Technology* 25(2), showed homepages to participants for 50 ms. Their visual-appeal ratings agreed well with ratings made after longer viewing. Visitors form an impression of a web page in about 50 ms. — [Nature news, 2006](https://www.nature.com/news/2006/060109/full/news060109-13.html). Note: I had access only to secondary coverage, not the paper, so sample size and effect sizes are unverified.
- **[Study] (classic, 2006)** Willis & Todorov, *Psychological Science*: five experiments showed faces for 100, 500 or 1,000 ms. Trait judgments after 100 ms (attractiveness, likeability, **trustworthiness, competence**, aggressiveness) correlated highly with judgments made with unlimited time. Longer exposure mostly raised **confidence**, not accuracy. In the authors' reading, extra time "bolsters" first impressions rather than revising them. — [PubMed 16866745](https://pubmed.ncbi.nlm.nih.gov/16866745/); [Princeton news](https://princeton.edu/news/2006/08/22/snap-judgments-decide-faces-character-psychologist-finds). The strongest correlation was for trustworthiness — [BPS Research Digest](https://bps.org.uk/research-digest/your-trustworthiness-judged-tenth-second-or-less). Relevance: this bears directly on whether to put a profile photo in the hero.
- **[Study] (classic, 2010/2011)** Liu, White & Dumais (Microsoft Research, SIGIR 2010) studied 205,873 pages and more than 2 billion dwell times from a browser plug-in. Dwell time follows a Weibull distribution with "negative aging" on 99% of pages: the risk of leaving is highest at the start and drops the longer someone stays. NN/g summary: "Users often leave Web pages in 10–20 seconds"; "the first 10 seconds of the page visit are critical"; a page that holds attention for about 30 seconds often keeps the visitor 2+ minutes. The advice is to state the value proposition within 10 seconds. — [NN/g, Nielsen 2011](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/)
- **[Survey/industry study] (classic, 2012 → 2018)** Ladders résumé eye-tracking: recruiters' initial screen averaged **7.4 s** in 2018, up from about 6 s in 2012. The method had two stages: an untimed-aware screening stage, then lab eye-tracking. Résumés that held attention had simple layouts, clear sections and headings, an F/E-pattern reading order, bold titles and bulleted accomplishments. Poor performers had clutter, little white space, **multiple columns** and long sentences. — [HR Dive](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/). Caveats: HR Dive reports no sample size or participant profile, Ladders is a job-board company, and the study is not peer-reviewed.
- **[Opinion] Critique of Ladders:** the 7.4 s is a *filter* time, not the time spent evaluating qualifications. One talent-acquisition commentator reads the report as essentially a résumé-readability how-to. — [ERE, "Is the 6-second resume scan a myth?"](https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth)
- **[Opinion]** A self-described hiring voice on Hacker News says the portfolio "will mostly get barely glanced at" and that researching the employer matters more. — [Ask HN: What projects do hiring managers like to see?](https://hn.svelte.dev/item/43134745) (~2025, gregjor)

### Inferences
- The hero must pass two tests: a sub-second aesthetic and trust test, then a roughly 10-second "what is this person and why should I care" test. Value proposition, role, seniority and proof of work belong above the fold.
- The Ladders layout findings (clear headings, single column, bulleted accomplishments, white space) match the project's existing single-column `cv.css` rule. The single-column CV is supported by evidence, not just by ATS parsing.
- Because more time mostly raises *confidence* in the first impression (Willis & Todorov), a later section rarely overturns a weak hero. It mostly confirms whatever the hero set up.
- In the current hiring climate, a reviewer probably opens the site after a résumé, LinkedIn profile or referral has already earned a click. The site's job is then to *confirm and deepen* that impression, not to be found cold. This is an inference: no study measured it.

### Gaps
- I found no eye-tracking or time-on-page study of recruiters or hiring managers on **developer portfolio websites**. All the timing data comes from résumés (Ladders) or generic web pages (Liu et al.).
- I could not verify the Lindgaard paper's sample size or effect sizes directly.
- I could not open NN/g's own first-impression or scanning-pattern articles. Only the 2011 dwell-time article was fetched.

---

## Q2. Which competence signals do engineering hiring managers trust, and which backfire?

### Takeaway
The signals that are trusted are verifiable and specific: shipped, working products; one project sustained over time; clear writing and documentation; meaningful commit history; growth over time; and framing work in terms of business problems. The signals that backfire are tutorial clones, a messy public repository (worse than none), vague commits, buzzword lists and anything that reads as generic. Hard survey data is scarce and much of the circulating "statistics" is unsourced.

### Cited Findings
- **[Survey]** HackerRank 2025 Developer Skills Report: survey of 13,732 developers, managers, recruiters, executives and students in 102 countries, Q4 2024 to early 2025, plus platform data. The framing is "real ability, not resume keywords" and "Resume filters block strong candidates," because AI-generated résumés are flooding applications. Developers: 66% prefer evaluation on real-world skills, 78% say assessments don't match real tasks. Hiring activity grew 22% year over year for lead developers and 19% for senior, against 9% for junior and about 7% for entry-level. 74% of developers say getting a job is hard, and 78% of tech leaders say finding skilled candidates is just as hard. Open-source contributions, community engagement and hackathons are cited as the strongest credibility builders. — [HackerRank 2025 report](https://www.hackerrank.com/reports/developer-skills-report-2025). Caveat: HackerRank sells assessments, so the framing serves its product.
- **[Survey] (classic, 2017)** HackerRank: 84.1% of surveyed CEOs, CTOs and founders said GitHub project work indicates on-the-job skills. — [ITPro Today](https://itprotoday.com/it-management/developers-show-your-github-project-to-attract-job-offers)
- **[Survey, secondary]** Profy.dev surveyed 60+ hiring managers. 93% would look at a portfolio site if one was provided, but 51% said a candidate's chances would *not* be lower without one. — reported by [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired). Caveat: I could not reach the primary profy.dev page (DNS failure). The audience was mainly junior-focused.
- **[Survey]** Hover surveyed 121 hiring professionals, not developer-specific: 71% agreed that portfolio quality influences hiring decisions. — reported via [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired) (secondary).
- **[Opinion]** A strong signal is one project developed over 3, 6 or 12 months, with technology changes, refactoring and a release. Meaningful commit messages, clean git history and contributions to established open source also count. Commits like "Updated stuff" are a negative signal (purvesta). Portfolios that look like university assignments or tutorials (to-do apps) are discounted, and growth plus business-problem focus count for more than a framework list (gregjor). — [Ask HN thread](https://hn.svelte.dev/item/43134745)
- **[Opinion]** The "portfolio paradox": a messy or careless public portfolio "actively proves your incompetence", worse than having none. Named concerns are no tests, poor docs, unstructured commits, and a history where everything was committed in one day. — [Lyrid](https://lyrid.io/post/5-critical-software-engineer-portfolio-mistakes-that-junior-developers-are-making); [Underdog.io](https://underdog.io/blog/why-github-wont-help-you-with-hiring)
- **[Opinion]** Hiring managers "can spot a tutorial clone in seconds"; a few polished projects beat many basic ones. — [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired) (education vendor)
- **[Opinion]** Shallow knowledge across many topics without depth is a red flag. The firm looks "beyond resumes and flashy portfolios" for signals of how a candidate works. — [CodeLink](https://codelink.io/blog/post/the-cost-of-bad-hires-in-engineering-how-to-spot-red-flags-before-making-an-expensive-mistake)
- **[Opinion]** Engineering managers prefer watching how a candidate thinks through an app design, and value curiosity, over a 30-minute coding test (Paul Rowe). — [Built In](https://builtin.com/software-engineering-perspectives/hire-software-engineers). A red flag is achievements described with no mention of the team. — [Pitch n Hire](https://www.pitchnhire.com/how-to-hire/engineering-manager)
- **[Vendor]** "Resumes lie, or at minimum, they overstate"; job boards are full of polished portfolios whose delivery skills are untested. This is why nearshore buyers run their own vetting. — [Revelo](https://www.revelo.com/blog/latam-vs-eastern-europe-vs-asia-why-latin-america-wins-for-us-remote-engineering-teams-in-2026)

### Inferences
- Because AI makes polished text and code cheap (97% of developers use AI assistants and about 29% of code is AI-generated, per [HackerRank 2025](https://www.hackerrank.com/reports/developer-skills-report-2025)), polish by itself is losing value as a signal. **Specificity** is what stays costly to fake: named employers, real dates, explicit `TODO` instead of invented numbers, measured versus estimated metrics, and the decision trade-offs behind a project. This supports the project's existing invariants 4 and 5 ("never invent metrics"; "~" for estimates) as a *trust* feature, not only a data-hygiene rule.
- Skill bars and self-rated percentages: no study found, but they run against every trusted signal above. They are unverifiable and self-assessed, and they invite the "shallow breadth" red flag. Listing skills *with evidence links* (as rule 3 does: a `core` skill needs evidence) is the defensible version.
- A heavy, slow 3D map gimmick risks the first-10-seconds test and the "flashy portfolio" skepticism. It works for the candidate only if it loads off the critical path and visibly *demonstrates* the claimed specialty (geospatial/visualization). The project's existing capability probe and budget checks match this.
- Since 51% of surveyed hiring managers would not penalize a missing portfolio, the site is a tie-breaker and depth amplifier for employment, not a gate. For freelance clients it is closer to a gate (Q3).

### Gaps
- The often-cited "73% of hiring managers value a strong portfolio over a perfect resume (Stack Overflow Developer Survey 2024)" has **no primary source**. The Stack Overflow survey is of developers, not hiring managers. Do not use it. The same goes for "84% want live demos".
- I found no quantitative study comparing specific portfolio elements (case studies vs live demos vs code samples vs writing) for experienced (5+ year) developers. Most material targets juniors.
- I did not fetch the LinkedIn Future of Recruiting 2025 primary report. Secondary coverage only says it emphasizes skills-based hiring and quality of hire — [Arctic Shores summary](https://www.arcticshores.com/insights/linkedins-new-future-of-recruiting-2025-report).

---

## Q3. How do recruiters, technical hiring managers and freelance clients differ?

### Takeaway
- **Recruiters** filter fast, on surface legibility: title, seniority, stack keywords, location and time zone, and a clean layout. Evidence: Ladders, HackerRank's "resume filters".
- **Technical hiring managers** look for depth and judgment: how someone thinks, project longevity, code and commit hygiene, trade-offs, team framing.
- **Freelance clients** (small-business owners) decide mostly on trust and social proof (referrals, reviews, portfolio) and on whether the provider "gets" their vision. Price is rarely decisive, and technical depth is assumed rather than inspected.

### Cited Findings
- **[Survey]** GoDaddy, April 2022. Phase 1 was 18 hour-long interviews; phase 2 was an online survey of 204 US small-business owners who had hired a web designer or developer.
  - Reviews and a portfolio were top priorities for 71%.
  - 59% would pick a personal acquaintance over anyone else, with or without a portfolio. Providers with a personal relationship were 2.5× more likely to be hired than those found on an online platform.
  - 24% would choose a provider with both online recommendations and a portfolio; **0%** would choose one with neither.
  - Discovery channels: 60% used recommendations from other professionals, 51% Google, 46% friends, 37% social media, 34% marketplaces (Fiverr/Upwork). Overall, 73% find providers via recommendations.
  - 71% look for *trends* in reviews rather than a perfect 5-star score. 64% are suspicious of a provider with no reviews.
  - Low price or discounts were not the deciding factor for any interviewee. Clients want someone who understands their vision and brand, shows emotional intelligence and is technically capable. Trust was the second most valued attribute. "Value" meant being able to focus on the business instead of the website.
  - — [GoDaddy, "What clients want"](https://www.godaddy.com/resources/news/what-clients-want). Caveat: vendor research promoting GoDaddy Pro; small sample; US only.
- **[Opinion]** For freelance clients "it really just comes down to one thing: trust". — [freeCodeCamp essay](https://www.freecodecamp.org/news/the-single-biggest-factor-in-a-clients-decision-to-give-you-a-project-3a9b3defac15/)
- **[Opinion]** Technical evaluators value business-problem orientation and asking about the company's challenges over framework lists. — [Ask HN](https://hn.svelte.dev/item/43134745). They also value soft skills and harder-to-teach experience over familiarity with a specific stack — [Textio quoting EM Josh Clow](https://textio.com/blog/strategies-for-hiring-managers-in-2019-part-2) (classic, 2019).
- **[Survey]** Recruiter and screening reality: tech leaders rank "assessment relevance" as their top hiring concern, and screening filters are keyword-driven. — [HackerRank 2025](https://www.hackerrank.com/reports/developer-skills-report-2025)

### Inferences
- One site, three reading paths:
  - The recruiter needs a scannable header: role, seniority (derived, not hand-written), stack, location, time zone, languages and a downloadable CV, all within 10 seconds.
  - The hiring manager needs one or two deep case studies covering problem, constraints, decisions, trade-offs, outcome (measured or "~" estimated) and links to code or a live demo.
  - The freelance client needs outcomes in business language, testimonials or named clients, a clear "what I can do for you" with a contact path, and evidence the developer listens.
- For freelance, the `testimonials` collection (empty on purpose in the dataset) is the single highest-leverage missing element per the GoDaddy data: 0% would hire with neither portfolio nor recommendations, and 64% distrust zero reviews. It should be filled only with real ones, never placeholders.
- Referrals dominate freelance discovery (73%). The site is therefore more often a *verification* destination after a recommendation than a discovery channel. The site should make the referrer look good for having recommended the developer.

### Gaps
- No found data on **agencies** as clients (white-label or subcontracting) and their criteria.
- No found data on LatAm small-business clients specifically. GoDaddy is US-only.
- No study measuring how much recruiters versus engineering managers actually open portfolio links. The roles differ in opinion pieces only.

---

## Q4. The psychology of desirability: halo, aesthetic-usability, social proof, authority, liking, scarcity, peak-end

### Takeaway
Good research shows that visual design drives perceived credibility and perceived competence (halo / aesthetic-usability), and that first impressions harden rather than get revised. Social proof is empirically the strongest lever for freelance clients. Peak-end suggests designing a memorable high point and a strong ending (the last thing seen, the CTA or contact). Scarcity is the riskiest lever for an individual and was not validated in any source found.

### Cited Findings
- **[Study] (classic, 1995)** Aesthetic-usability effect: Kurosu & Kashimura (Hitachi) tested 26 ATM layouts with 252 participants. Aesthetic appeal correlated more strongly with *perceived* ease of use than with actual ease of use. NN/g's limits: beauty makes users forgive *minor* problems but not large ones, and it can mask usability problems in testing. — [NN/g](https://www.nngroup.com/articles/aesthetic-usability-effect/)
- **[Study] (classic, 2002/2003)** Stanford Web Credibility (Fogg et al., with Consumer WebWatch): 2,684 consumers evaluated 100 live sites. "Design look" was the most frequently mentioned credibility factor at **46.1%**. Caveat: this appears to be a share of *comments*, not of participants; sources conflict on this point. The "design" category was broad and included font size and usability. — [ClickZ / InternetNews coverage](https://clickz.com/study-for-site-cred-looks-matter/56564/); [Design for Hackers summary](https://designforhackers.com/?p=413)
- **[Study] (classic, 2006)** First impressions from 50–100 ms exposures predict longer-exposure judgments, and more time mainly adds confidence. — [Nature news on Lindgaard](https://www.nature.com/news/2006/060109/full/news060109-13.html); [Willis & Todorov, PubMed](https://pubmed.ncbi.nlm.nih.gov/16866745/)
- **[Study] (classic, 1993)** Peak-end rule (Kahneman et al., cold-water experiment): experiences are remembered by their most intense moment and their end, and duration has extremely slight effect on retrospective evaluation (duration neglect). UX advice is to fix the worst moments and strengthen the ending. One caveat is that designing *only* the ending can amount to gaming perception. — [Laws of UX](https://lawsofux.com/peak-end-rule/); [Wikipedia summary](https://wikipedia.com/wiki/Peak_end_rule)
- **[Survey]** Social proof in practice: 0% of small-business owners would hire a provider with no portfolio and no recommendations, and 64% are suspicious of zero reviews. Providers with a personal relationship were 2.5× more likely to be hired. — [GoDaddy 2022](https://www.godaddy.com/resources/news/what-clients-want)
- **[Survey]** Authority via community: open source, community engagement and hackathons are cited as the most effective credibility builders. — [HackerRank 2025](https://www.hackerrank.com/reports/developer-skills-report-2025)

### Inferences
- **Halo:** craft details (typography, spacing, dark mode, speed, accessibility, a PDF that prints perfectly) are not decoration on a developer's site. For a web developer they *are* the work sample, and the aesthetic-usability effect transfers that perceived quality to the person. They work only if nothing is broken: NN/g says big problems are not forgiven, so a janky 3D map or layout shift would create a negative halo.
- **Authority** (Cialdini), applied subtly: named employers and clients, specific domain (maps/geospatial), measured metrics, public writing and case studies, open-source links. Show authority through evidence, never by claiming it ("expert", "senior ninja").
- **Liking:** a real photo (trustworthiness is judged in about 100 ms from a face), a human voice in copy (matches `docs/02-branding.md` voice rules), shared context (LatAm and Spanish for local clients). Inferred, not tested for portfolios.
- **Social proof:** testimonials, named companies, "worked with X". This is the most evidence-backed lever for freelance work (GoDaddy).
- **Scarcity:** "Currently accepting 1 new project for Q1" can create demand, but if it is false it violates the project's no-invention principle and is easily seen through. Use it only when true. No evidence was found on its effect for individual developers.
- **Peak-end:** the end of the page and the CV should not trail off into a skills dump. End with a strong, concrete project or result plus a clear contact path or CTA. The "peak" can be the interactive map, if it delights rather than frustrates.
- First impressions carry into interviews: interviewers who arrive with a confident positive impression likely interpret ambiguous answers charitably (confirmation, per Willis & Todorov's "more time bolsters"). This is inference: no study found links portfolio impressions to interview outcomes.

### Gaps
- No study found testing Cialdini's principles specifically on personal or developer portfolio sites, or in hiring contexts. Applications above are inferred.
- No study found directly linking portfolio-site impressions to interview evaluations or offer rates.
- Did not fetch the NN/g peak-end article directly (https://www.nngroup.com/articles/peak-end-rule/). The citations above are secondary summaries.

---

## Q5. LatAm developers: Spanish-speaking markets and remote or nearshore roles for US/EU companies

### Takeaway
US buyers choose LatAm for time-zone overlap (0–3 h from US Eastern), cost (30–50% below US) and cultural proximity. Their objections are communication friction and English, overstated seniority ("resumes lie"), reliability and retention, and legal/contractor classification. Argentina has the region's best English proficiency on EF's 2025 index and a reputation for senior engineers. Almost all of the nearshore evidence comes from staffing vendors with a commercial interest.

### Cited Findings
- **[Vendor]** LATAM is 0–3 h from US Eastern versus 6–8 h for Eastern Europe. Communication friction is "one of the most underreported costs of global hiring". Seniority mismatch is a key worry ("Resumes lie, or at minimum, they overstate"), answered by rigorous vetting. Turnover is "often a culture failure". Contractor misclassification creates "retroactive liability". Senior LATAM engineers cost $75k–$110k, a 30–50% saving. Argentina "has historically produced some of the strongest senior engineers in Latin America" (fintech, SaaS architecture, enterprise). — [Revelo blog 2026](https://www.revelo.com/blog/latam-vs-eastern-europe-vs-asia-why-latin-america-wins-for-us-remote-engineering-teams-in-2026). Caveat: Revelo is a LatAm staffing platform, and several figures are unsourced or self-reported.
- **[Vendor]** Other nearshore content: Mexico has the closest US Pacific overlap and Colombia aligns with ET. English is strongest in Mexico, Colombia and Argentina, and more variable in Brazil outside big cities. — [Revelo nearshore costs 2026](https://www.revelo.com/blog/nearshore-software-development-in-latin-america-countries-costs-and-what-to-expect-in-2026); [ANSR roadmap](https://ansr.com/blog/hire-nearshore-developers-roadmap/)
- **[Opinion/podcast]** Time-zone alignment, delivery speed, English fluency and retention drive the shift from offshore to nearshore. — [Nearshore Cafe, late 2025](https://nearshorecafepodcast.buzzsprout.com/2417050/episodes/18498335-discover-how-nearshore-hiring-is-evolving-in-2026)
- **[Survey/index]** EF English Proficiency Index 2025: Argentina ranked 26th of 123 countries (score 575, +13) and first in Latin America in Argentine coverage. Buenos Aires ranked 23rd among world capitals. A Brazilian outlet lists Suriname first and Argentina second when counting 21 LatAm and Caribbean countries. The 2025 edition used 2.2 million test takers and added speaking and writing for the first time. — [Mercado](https://mercado.com.ar/noticias/argentina-alcanza-el-puesto-26-en-el-indice-de-proficiencia-en-ingles-de-ef-education-first); [Diario de Cuyo](https://www.diariodecuyo.com.ar/argentina/argentina-es-el-pais-con-mejor-nivel-de-ingles-de-la-region-1802634.html); [Mercado & Eventos (BR)](https://www.mercadoeeventos.com.br/noticias/servicos/brasil-cai-no-ranking-de-ingles-na-america-latina-e-aparece-entre-os-piores/). Caveat: EF's test takers are self-selected.
- **[Survey]** Remote preference: 79% of developers prefer hybrid or remote. — [HackerRank 2025](https://www.hackerrank.com/reports/developer-skills-report-2025)

### Inferences
- **Pre-empt the objections on the page itself** for the English-language `/en/` audience:
  - State time zone and hours of overlap with US ET/PT and EU explicitly. Argentina is UTC-3: 1–2 h ahead of US Eastern depending on DST, and about 3–4 h behind CET.
  - Show history of remote or async work with foreign teams if real.
  - State the contract arrangement (contractor or EOR) to defuse the compliance worry.
  - Show tenure and continuity to defuse the reliability and retention worry.
- **English level is a real tension here.** The dataset records English as **A2** (CLAUDE.md, confirmed 2026-08-31). Against US-remote buyers whose top objection is communication friction, that is a material gap. Honesty principle: do not inflate it. Options are to (a) target Spanish-speaking clients and Spanish-speaking teams in the US/EU first; (b) present English honestly with evidence of working written English (docs, async writing), if true; (c) treat English improvement as a career investment. Do not claim "fluent".
- Argentina's national reputation (EF ranking, senior-engineer stereotype in vendor content) is a halo the developer can borrow via location, but it does not substitute for personal evidence.
- For the Spanish-speaking local market, the GoDaddy-style trust dynamics (referrals, testimonials, portfolio) likely apply more strongly than technical depth. This is inference: no LatAm SMB data was found.

### Gaps
- No independent (non-vendor) study found on what US/EU employers look for in LatAm developers, or on actual objection frequencies. Revelo's 2024 LatAm Tech Talent Report (185,000+ developers, 12 countries) is gated: [Revelo report page](https://revelo.com/latin-america-tech-talent-report-2024/).
- BairesDev, Terminal and Deel reports were not reached in this session.
- No data found on hiring criteria of employers *within* Argentina or other Spanish-speaking LatAm markets for web developers.
- No data on how buyers treat A2/B1 English in practice (hard cutoff versus negotiable for async-heavy roles).

---

## Q6. Concrete do's and don'ts from hiring managers' own writing and surveys (2022–2026)

### Takeaway
Do: show real, live, original, sustained work with specifics, business framing and visible thinking; keep it fast and scannable. Don't: tutorial clones, sloppy public repos, vague claims, buzzword and keyword soup, or unsupported statistics. The primary-source base is thin and mostly opinion. Treat the list as convergent practitioner consensus, not measured effect.

### Cited Findings
- **DO** show one project sustained over months, including refactors and a release; write meaningful commits; contribute to established open source. — [Ask HN, purvesta](https://hn.svelte.dev/item/43134745)
- **DO** frame work around business problems and show growth and accomplishments over time. **DON'T** show university- or tutorial-style apps (to-do lists). — [Ask HN, gregjor](https://hn.svelte.dev/item/43134745)
- **DO** prefer a few polished, original projects with live demos. **DON'T** ship tutorial clones (spotted "in seconds"). — [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired)
- **DON'T** publish messy, untested, undocumented repos: worse than none. — [Lyrid](https://lyrid.io/post/5-critical-software-engineer-portfolio-mistakes-that-junior-developers-are-making)
- **DON'T** show breadth without depth. — [CodeLink](https://codelink.io/blog/post/the-cost-of-bad-hires-in-engineering-how-to-spot-red-flags-before-making-an-expensive-mistake)
- **DON'T** describe achievements with no mention of the team. — [Pitch n Hire](https://www.pitchnhire.com/how-to-hire/engineering-manager)
- **DO** use a simple layout with clear headings, bulleted accomplishments and white space. **DON'T** use clutter, multiple columns or long sentences. — [HR Dive on Ladders 2018](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/)
- **DO** state the value proposition within the first 10 seconds. — [NN/g](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/)
- **DO** (freelance) have reviews, testimonials and a portfolio. Any reviews beat none, and clients look for trends, not perfection. **DON'T** compete on price. — [GoDaddy 2022](https://www.godaddy.com/resources/news/what-clients-want)
- **DO** emphasize real-world skill over keywords, since keyword filters and AI-generated résumés are degrading the résumé signal. — [HackerRank 2025](https://www.hackerrank.com/reports/developer-skills-report-2025)

### Inferences
- Mapped to this project:
  - Single-column CV: aligned with the evidence.
  - No invented metrics, and "~" for estimates: a trust differentiator in an AI-polished market.
  - Skills tied to evidence: counters the "skill bars" anti-pattern.
  - Zero-JS CV and a budgeted, off-critical-path 3D map: protects the 10-second window.
  - Empty testimonials: the biggest freelance gap.
  - A2 English: the biggest nearshore gap.
- Missing for hiring managers: long-form case studies (already planned for the next slice) are the format that best carries the trusted signals of thinking, trade-offs, longevity and outcomes.

### Gaps
- Stack Overflow Developer Survey 2024/2025 hiring-related questions were not fetched. It surveys developers, not hiring managers, so it cannot back hiring-manager preference claims.
- Few hiring-manager blog posts specific to *experienced* frontend or geospatial developers' portfolios were found. Most do's and don'ts target juniors.
- No evidence found on "skill bars" specifically (practitioner consensus is negative, but no citable source was retrieved in this session).
