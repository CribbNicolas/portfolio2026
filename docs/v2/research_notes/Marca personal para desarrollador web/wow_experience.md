# The "wow" effect in immersive developer portfolios — and keeping it from costing the hire

Research notes, 2026-10-26. Scope: design and psychology of memorable scroll-driven / 3D / animated
portfolio experiences, concrete 2023–2026 examples, risks, hiring evidence, and how the experience
should culminate in a CV download / contact. Context of the reader: Astro static site, LatAm web
developer, bilingual ES/EN, CV PDF download as the terminal action.

Source-quality note for the report writer: Codrops (tympanus.net) returned HTTP 403 to direct fetches,
so every Codrops case study below is cited from search-result summaries of the article, not from a
full read. Awwwards' own award listings surfaced only as archive pages; no year-end "Portfolio of the
Year" page was retrievable. Hiring-side evidence is thin and mostly secondary (see section 6).

## 1. Which developer portfolios won awards / were featured 2023–2026, and what made them memorable? Which libraries?

### Takeaway
The recognisable pattern in 2025–2026 award-level developer portfolios is a single strong concept
(a world you drive through, a place you scroll into, or a deliberately minimal site with one motion
signature) built on a small, now-standard stack: GSAP + ScrollTrigger, Lenis smooth scroll, three.js
(increasingly WebGPU/TSL), Blender for assets, and — notably — Astro appears in at least one featured
build. The memorable ones are a *place* or a *concept*, not a pile of effects.

### Cited Findings
- **Bruno Simon (bruno-simon.com), rebuilt 2025, case study published on Awwwards in 2026.** He kept the
  2019 concept (drive a car through a three.js world) and rebuilt it; of the original he writes
  "Nothing groundbreaking. Yet it went viral and jump-started my career." — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Bruno Simon technique details: whole world authored in Blender with naming conventions driving behaviour
  (e.g. an object named `refLandingPhysicalFixed` becomes a fixed physics body exposed to JS as `landing`);
  shaders in TSL, "automatically runs on WebGPU when available"; ~78,400 single-triangle grass blades;
  shared weather (day/night, seasons, rain, snow, lightning); spatialised audio with three CC0 tracks;
  gamified achievements with unlockable vehicle skins; multiplayer touches (moderated "whispers", shared
  cookie counter, daily circuit leaderboard); content shown in-world as 3D UI rather than HTML; inputs:
  click, scroll, keyboard, touch, gamepad. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Bruno Simon set a hard release deadline (end of 2025) to avoid endless revision with "no client", and
  published a YouTube devlog of the build. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- The rebuild was explicitly tied to his teaching: he rebuilt the portfolio because teaching TSL meant
  building with it daily; he is a speaker at the first Three.js Conference (Paris, Sept 2026). —
  [Codrops, "Meet the Speakers of the First Three.js Conference" (2026-07-16)](https://tympanus.net/codrops/2026/07/16/meet-the-speakers-of-the-first-three-js-conference/)
- Code and Blender files reportedly on GitHub under MIT, music CC0 (secondary source, not verified on
  GitHub). — [GeekNews](https://news.hada.io/topic?id=24963)
- **Joseph Santamaria, "More Than a Portfolio: Building a Scroll-Driven 3D World with Something to Say"
  (Codrops, 2026-04-28):** scroll-driven 3D environment from scratch with three.js, GSAP, WebGL shaders and
  Blender; three months of focused work plus three weeks of polish plus unpublished earlier versions; the
  stated goal was for the site to "feel like a place rather than a document", each scene composed like a
  film frame. — [Codrops (search summary; full text 403)](https://tympanus.net/codrops/?p=114641)
- **Joffrey Spitzer portfolio (Codrops, 2026-02-18):** "A Minimalist Astro + GSAP Build with Reveals, Flip
  Transitions and Subtle Motion" — Astro + GSAP, Lenis for smooth scrolling ("it pairs really well with
  GSAP"), three.js for one WebGL element, Swup for page transitions. — [Codrops (search summary; full text 403)](https://tympanus.net/codrops/2026/02/18/joffrey-spitzer-portfolio-a-minimalist-astro-gsap-build-with-reveals-flip-transitions-and-subtle-motion/)
- **"From Shader Uniforms to Clip-Path Wipes: How GSAP Drives My Portfolio" (Codrops):** the author chose
  Lenis over native scroll because native scroll was "too brittle" for tightly coupled ScrollTrigger
  animations; shader-heavy WebGL build. — [Codrops (search summary)](https://tympanus.net/codrops/?p=114934)
- Other Codrops portfolio features in the period: Arnaud Rocca's portfolio (2026-03-31; reusable GSAP
  animations, custom text transitions, WebGL interactions); Roman Jean-Elie, "Letting the Creative Process
  Shape a WebGL Portfolio" (2025-11-27; tagged GSAP, React Three Fiber, three.js); "Sketching the Impossible:
  a 3D portfolio built without a single 3D model" (2026-06-11; a portfolio you walk through rather than
  scroll). — [Codrops 2026/03 archive](https://tympanus.net/codrops/2026/03/); [Codrops 2025/11 archive](https://tympanus.net/codrops/2025/11/); [Codrops "Sketching the Impossible"](https://tympanus.net/codrops/2026/06/11/sketching-the-impossible-a-3d-portfolio-built-without-a-single-3d-model/)
- **Jesse Zhou:** three.js + Blender fully interactive 3D portfolio; per his instructor bio it won several
  web design awards and "attracted multiple job offers"; he now works as Technical Product Lead for 3D at
  Moment. Also built "Jesse's Ramen", an immersive three.js ramen shop featured in Codrops Collective #701. —
  [Zero to Mastery bio](https://zerotomastery.io/about/instructor/jesse-zhou); [HostAdvice roundup](https://hostadvice.com/blog/website-design/javascript-website-examples/); [Codrops Collective #701](https://tympanus.net/codrops/collective/collective-701/)
- Awwwards 2025 portfolio-type recognitions visible in archive listings: Elliott Mangham — Portfolio Honors
  (Nov 2025) and Site of the Day (2025-12-02) with Developer Award; Form&Fun Studio — Portfolio Honors +
  Developer Award (Aug 2025). — [Awwwards archive listing](https://www.awwwards.com/websites/%23F8F6F0/?page=7); [Awwwards archive listing](https://www.awwwards.com/websites/%23D9DAD9/?page=6)
- **Library landscape fact:** since Webflow's acquisition, GSAP is 100% free for everyone, including the
  formerly paid Club plugins (SplitText, MorphSVG) and commercial use; SplitText was rewritten with ~50%
  smaller size and "baked-in accessibility for screen readers" plus easy masking for reveal effects. —
  [Webflow announcement](https://webflow.com/blog/gsap-becomes-free); [GSAP 3.15.0 README](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md); [Webflow forum](https://discourse.webflow.com/t/webflow-makes-gsap-100-free/319967)
- The GSAP README calls ScrollTrigger the standard for scroll-driven animation, with ScrollSmoother as
  companion. — [GSAP README](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md)
- Native alternative: CSS scroll-driven animations (`animation-timeline: scroll()/view()`) shipped in
  Chrome/Edge 115 (July 2023); Safari support cited from 26.0 (Sept 2025) in one source and 18.4 in another;
  Firefox status inconsistent across sources. `view()` suits reveal-on-enter; `scroll()` suits whole-page
  progress. A separate newer `animation-trigger` (scroll-*triggered*) is in Chrome/Edge 146+ (Mar 2026)
  only. — [ICS Media](https://ics.media/en/entry/230718/); [Chrome for Developers, scroll-triggered animations](https://developer.chrome.com/blog/scroll-triggered-animations); [codercops 2026](https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026) (sources conflict on Safari/Firefox — verify on MDN/caniuse)

### Inferences
- Award-level portfolios are multi-month projects (Santamaria: ~3.5 months; Simon: a year-scale rebuild
  with a public devlog). The craft *is* the claim. For a developer whose pitch is product/frontend work
  rather than creative WebGL, a full Simon-style world is a different career bet than the one a CV-led
  portfolio makes.
- The Joffrey Spitzer build (Astro + GSAP + Lenis + one three.js element + page transitions) is the closest
  published precedent to an Astro static site: "minimal + one motion signature" is a recognised, featured
  register, not a compromise.
- With GSAP free and CSS scroll-driven animations broadly shipped, the choice is no longer about cost:
  CSS `view()` timelines can carry simple reveals with zero JS (relevant to pages that must stay JS-free),
  while GSAP/ScrollTrigger is still the tool for pinned, choreographed sequences.
- Lenis is a recurring companion to ScrollTrigger in these builds, but it is a smooth-scroll layer — i.e.
  close to the scroll-control territory NN/g warns about (section 5). Builders adopt it for animation
  sync, not for the user.

### Gaps
- Could not retrieve primary write-ups for Robin Payot (folio-2019/2023), Lynn Fisher (annual redesigns),
  Olivier Larose, or a 2025 Awwwards "Portfolio of the Year" / FWA / CSS Design Awards winner list; no
  verified statements about their techniques are included.
- No source found naming Theatre.js or Rive in a 2023–2026 award-winning *developer* portfolio.
- Full text of the Codrops case studies (narrative chapters, mobile fallbacks, how they end) was blocked
  (403); only titles/summaries are cited.
- Bruno Simon's case study does not describe the loading strategy, accessibility, or a contact route.

## 2. Psychology of "wow": novelty, surprise, peak-end, aesthetic-usability, first impressions

### Takeaway
The research gives two levers and one warning: visual appeal is judged in ~50 ms and colours later
judgements (halo); memory of an experience is dominated by its most intense moment and its ending
(peak-end); and attractiveness buys forgiveness only for *minor* usability problems. So: one engineered
peak, a deliberate ending, and no large friction anywhere.

### Cited Findings
- Lindgaard et al. (2006, *Behaviour & Information Technology*, Carleton University): participants rated
  homepage visual appeal after 50 ms exposures; those ratings matched ratings after longer viewing. Trust
  and usability judgments also form quickly "but it takes a bit longer". Lindgaard cautioned the data
  "only speak to the speed with which people decide upon an image". — [Blogcritics summary](https://blogcritics.org/users-judge-websites-almost-instantly/); [Human Factors International newsletter](https://humanfactors.com/newsletters/an_exploration_of_relations_between_visual_appeal.asp)
- Commentators link the 50 ms impression to a halo effect on perceived credibility and usability (this is
  commentary, not the study's own finding). — [websiteoptimization.com](https://old.websiteoptimization.com/speed/tweak/blink)
- **Aesthetic-usability effect:** "users' tendency to perceive attractive products as more usable."
  Origin: Kurosu & Kashimura (Hitachi, 1995), 26 ATM interface variants, 252 participants; aesthetic
  ratings correlated more with *perceived* ease of use than actual. Caveat: "A pretty design can make users
  forgiving of minor usability problems, but not of large ones"; the effect is strongest when aesthetics
  support content and function. — [NN/g](https://www.nngroup.com/articles/aesthetic-usability-effect/)
- **Peak-end rule (Kahneman):** memory of an experience is not an average but is dominated by the most
  intense point and the conclusion. — [Yotpo CX blog](https://www.yotpo.com/blog/the-peak-end-rule-in-cx/)
- Axess Lab argues for a "flipped" design approach — invest in the peak and the ending rather than only the
  first screen (their 10-peak/6-end→8 example is illustrative, not measured). — [Axess Lab, "Last impressions first"](https://axesslab.com/flipped-web-design/)
- Negative peaks count too: confusion and slow loading become the remembered peak; examples of positive
  end-peaks: Mailchimp's high-five after sending, Readme.io's owl covering its eyes on password entry. —
  [Uxcel, peak-end rule](https://app.uxcel.com/lessons/ux-laws-999/peak-end-rule-6768); [SitePoint](https://www.sitepoint.com/design-highly-memorable-experiences/)
- Bruno Simon's own account: a single strong concept ("Nothing groundbreaking") went viral and launched his
  career — the memorability came from the concept, not from novelty of each technique. —
  [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)

### Inferences
- The first 50 ms is a *visual* verdict — composition, type, colour — and it is delivered by the first
  paint, not by an animation that has not loaded yet. A static, well-composed hero that is already
  beautiful before any JS runs captures the 50 ms judgement; the animated layer upgrades it.
- Peak-end suggests designing exactly one "peak" (the standout interactive moment) and treating the CV/
  contact ending as the second memory anchor. A flat footer with a download link wastes the most
  memorable slot of the visit.
- The aesthetic-usability caveat maps directly onto recruiter friction: a stalled loader, a hijacked
  scroll that hides the CV, or a laptop fan spinning up are "large" problems that beauty does not offset.

### Gaps
- No primary-source access to Kahneman's peak-end papers or the Lindgaard paper itself in this session;
  cited via secondary summaries.
- No study found on "wow"/delight specifically in portfolio or recruiting contexts; flow theory
  (Csikszentmihalyi) and surprise/novelty literature were not researched within the call budget.

## 3. Scrollytelling structure: pacing, chapters, pinning, hero and ending

### Takeaway
The featured 2026 builds treat the site as a sequence of composed scenes ("a place rather than a
document", "each scene composed like a film frame"), and NN/g's evidence sets the boundary conditions:
scroll-controlled sequences work only when they progressively disclose relevant information, are short,
interleaved with normal scrolling, never change scroll direction, keep text minimal, sit below the fold,
and never hide CTAs.

### Cited Findings
- Santamaria's portfolio framing: the site should feel like an environment the visitor enters, each scene
  composed like a film frame; scroll drives the 3D world. — [Codrops (search summary)](https://tympanus.net/codrops/?p=114641)
- NN/g: "Scrolljacks were best tolerated when they were used to progressively disclose relevant
  information." — [NN/g, Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/)
- NN/g: long scrolljacks sometimes made users think the page was broken; tune scroll rate by testing (too
  fast → missed content; too slow → fatigue); mix in normal-scrolling sections to preserve control; do not
  change scroll direction (horizontal motion from vertical gestures confuses); keep text minimal inside
  scrolljacks; place them below the fold so they don't hide key content or calls to action; sticky
  navigation helped users escape. — [NN/g, Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/)
- Purdue thesis on parallax reading: with parallax, some people scroll faster, stop more sharply and stop
  longer; people who scroll a little and read a few lines tended to be "blind" to the parallax effect. —
  [Purdue open-access thesis](https://docs.lib.purdue.edu/open_access_theses/1616)
- Peak-end and "last impressions first" argue for designing the ending as deliberately as the hero. —
  [Axess Lab](https://axesslab.com/flipped-web-design/)
- Bruno Simon: content lives inside the world as 3D UI; achievements gamify exploration; work split into
  client projects and a "Lab" of experiments. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)

### Inferences
- A defensible chapter structure for a CV-led portfolio: (1) hero — static, instantly legible identity +
  visible CV/contact affordance (above the fold, never inside a scroll sequence, per NN/g); (2) one pinned
  "peak" chapter below the fold that *discloses information* (e.g. the knowledge map or stack assembling
  from real data) rather than decorating; (3) normal-scroll project/CV sections for reading; (4) a
  closing chapter that resolves the peak's visual motif into the CTA.
- Making the CTA the climax: reuse the peak's visual language in the ending (the same nodes/objects
  converge into the "download CV" control, or the scene settles into a final frame where the PDF is the
  object in focus). The ending then carries continuity rather than reading as a footer. This is an
  inference from peak-end + the "film frame" framing; no source documents this exact technique.
- Bilingual note: scroll sequences with text inside them double the localisation surface; NN/g's "minimal
  text in scrolljacks" also keeps the ES/EN parity cheap.

### Gaps
- No primary account retrieved of how award-winning portfolios *end* (contact/CV placement); Codrops full
  texts were blocked and the Bruno Simon case study does not describe a contact route.
- No NN/g article on "scrollytelling" as such was retrieved (only scrolljacking); data-journalism sources
  (The Pudding, NYT) were not researched.

## 4. Showing technical skill and stack visually without "logo soup" or skill bars

### Takeaway
The strongest evidence that a portfolio demonstrates skill is that *the site itself is the proof* — Simon's
world is a working demo of TSL/WebGPU/physics/instancing, Jesse Zhou's 3D portfolio drew job offers — while
hiring-side commentary says the content inside (projects, write-ups) is what gets people hired. Logos and
bars assert; working artefacts and documented decisions demonstrate.

### Cited Findings
- Bruno Simon's portfolio operates as a live demonstration of the stack he teaches (TSL shaders, WebGPU
  fallback to WebGL, instancing, culling, compressed textures, DRACO), and he open-sourced it. —
  [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html); [GeekNews](https://news.hada.io/topic?id=24963)
- Jesse Zhou's three.js portfolio "attracted multiple job offers" and he now leads 3D product work. —
  [Zero to Mastery bio](https://zerotomastery.io/about/instructor/jesse-zhou)
- "A portfolio website is the container, not the content. The projects and documentation inside it are
  what get you hired." — [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired)
- Bruno Simon separates client projects from a "Lab" of experiments, so play does not dilute evidence of
  delivered work. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)

### Inferences
- A stack visualisation earns its place when it is *derived from evidence* (each skill node connected to
  the projects/roles that used it, with real periods) instead of self-rated. A graph that a recruiter can
  interrogate ("which projects used X?") is the opposite of a skill bar. (This matches the existing repo's
  knowledge map, which derives skills↔projects from the dataset.)
- The performance budget and graceful degradation are themselves skill signals for a frontend developer:
  a 3D layer that falls back to SVG, respects reduced motion and keeps the CV page at zero JS demonstrates
  more seniority than an extra shader.

### Gaps
- No source found with hiring-manager commentary specifically on 3D tech-stack visualisations, logo walls,
  or skill bars; the "logo soup" critique is a common design-community opinion but no citable primary was
  retrieved.

## 5. Risks and mitigations: load, mobile, corporate laptops, accessibility, scroll hijacking, SEO/ATS

### Takeaway
NN/g's usability testing is the hardest evidence: most participants were disoriented by scrolljacking,
mobile made it worse, and task-focused users (recruiters are task-focused) were the most annoyed.
Mitigations in top builds are engineering ones — quality presets, instancing, culling, compressed assets —
plus the accessibility baseline of `prefers-reduced-motion`.

### Cited Findings
- "The majority of our study participants were at least mildly disoriented by scrolljacking"; some left or
  refreshed; pages altering both scroll rate and direction while requiring reading were worst; mobile
  screens made scrolljacks longer and more disorienting and slow connections worsened waits; conclusion:
  "scrolljacking leads to more user pain than benefits"; avoid on mobile unless a mobile-specific version
  is justified. — [NN/g, Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/)
- Task-focused users were most annoyed; one participant said as a prospect he "would get severely agitated
  and just move on." — [NN/g, Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/)
- Critics: when scrolling accelerates or locks the site feels in charge rather than the user; people with
  vestibular disorders, motor differences or keyboard-only navigation can be blocked or disoriented if motion
  isn't optional. — [Webdesigner Depot, "How Scrolljacking Breaks UX Fundamentals"](https://webdesignerdepot.com/how-scrolljacking-breaks-ux-fundamentals/); [Alvaro Trigo](https://alvarotrigo.com/blog/what-is-scroll-hijacking/)
- WCAG 2.2 SC 2.3.3 Animation from Interactions (Level AAA): "Motion animation triggered by interaction can
  be disabled" unless essential; vestibular reactions "include dizziness, nausea and headaches";
  techniques C39 (CSS `prefers-reduced-motion`) and SCR40 (the same query in JS). —
  [W3C Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Bruno Simon's performance toolkit: instancing, looping grass/water/terrain, frustum culling, merged
  geometry with a palette texture, ETC1S/UASTC compressed textures, DRACO quantisation, and a lower mobile
  preset (no water blur or depth of field, reduced shadow-map resolution). "If the experience runs at 10
  FPS, no one will stick around." — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- GSAP's rewritten SplitText includes screen-reader accessibility for split kinetic type (split text
  otherwise risks being read letter by letter). — [Webflow forum announcement](https://discourse.webflow.com/t/webflow-makes-gsap-100-free/319967)
- OpenReplay: animations "can also be what destroys your portfolio's chances with a recruiter" — should not
  make the recruiter dizzy or their device struggle. — [OpenReplay blog](https://blog.openreplay.com/prepare-for-success--create-a-modern-portfolio/)

### Inferences
- Corporate-laptop recruiters are the worst case NN/g describes: task-focused, possibly integrated GPU,
  possibly blocked WebGL or throttled CPU. The fast path (CV link, contact) must exist in the first viewport
  and must not depend on the experience loading.
- The "still version" is not a separate site: the static HTML (with real text and a pre-rendered
  SVG/image of the peak scene) is the baseline, the animated layer is progressive enhancement, and reduced
  motion / low capability / failed WebGL simply never upgrade. That also keeps SEO and ATS/agent readers
  (HTML, JSON, llms.txt, PDF) independent of the experience.
- Loading choreography should be a reveal of already-painted content, not a full-screen percentage loader
  that blocks first paint: per NN/g, waits are the remembered negative peak on slow mobile.
- Lenis/ScrollSmoother-style smooth scroll replaces native scroll physics and is the most likely thing to
  trigger "scrolljacking" complaints; native scroll + ScrollTrigger pinning (or CSS `view()` timelines)
  keeps the browser in charge.

### Gaps
- No quantitative data found on recruiters' devices (corporate laptop GPU/WebGL policies) or on WebGL
  failure rates in enterprise environments.
- No source retrieved on SEO effects of WebGL-heavy portfolios or on how ATS/LLM screeners read them.

## 6. Do flashy portfolios help or hurt developer hiring?

### Takeaway
There is no rigorous study on animation specifically. Available hiring-side evidence is secondary and
mostly advises substance over spectacle: most hiring managers would *open* a portfolio, but about half say
not having one doesn't lower chances, and practitioners who screen applicants say simpler and faster is
better. Counter-evidence comes from creative-developer careers (Simon, Zhou) where the spectacle *was* the
portfolio piece.

### Cited Findings
- Profy.dev survey of 60+ hiring managers (via Scrimba): 93% would look at a portfolio site if provided;
  51% said a candidate's chances would not be lower without one. Primary page unreachable (DNS failure) —
  figures are second-hand. — [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired)
- Scrimba: hiring managers spend "seconds, not minutes" on initial portfolio review; "make those seconds
  count with strong project work, not flashy animations." — [Scrimba](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired)
- Separate Hover survey of 121 hiring professionals: 71% agreed portfolio quality influences hiring
  decisions (do not merge with Profy figures). — [The Interview Guys](https://blog.theinterviewguys.com/?p=10630)
- A developer who screened 200+ applicants: "the simpler your portfolio website, the better"; tone
  animations down to be "as subtle and quick as possible." — [DEV Community comment thread](https://dev.to/etienne-dev/just-launched-my-personal-portfolio-3gka/comments)
- Claim that many recruiters never open portfolio sites and screen résumé and GitHub first; cites a 7.4 s
  résumé-scan figure without a clear primary source (treat as weak). — [Level Up Coding (member-only)](https://levelup.gitconnected.com/recruiters-arent-clicking-your-portfolio-they-re-looking-here-instead-c694c4606dc3)
- Counter-examples: Bruno Simon's 2019 portfolio "went viral and jump-started my career"; Jesse Zhou's 3D
  portfolio won awards and "attracted multiple job offers". — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html); [Zero to Mastery bio](https://zerotomastery.io/about/instructor/jesse-zhou)

### Inferences
- The evidence splits by audience. For creative-dev / agency / freelance clients the experience is the
  sample of work; for product-company recruiters it is a container whose speed and clarity are what
  register. A portfolio aimed at both should let the second audience reach the CV in one action while the
  first audience gets the peak.
- Because the PDF/HTML CV is what a screener actually forwards, the experience's job is to make the person
  memorable and the download frictionless — not to replace the CV. The CV page itself staying fast and
  JS-free protects the artefact that circulates.
- For LatAm/Spanish-market freelance clients (non-technical buyers), the aesthetic-usability halo
  (section 2) likely matters more than for engineering hiring managers; no source tested this.

### Gaps
- No primary Profy.dev data (site unreachable); no peer-reviewed study on animated/3D portfolios and
  developer hiring outcomes; no LatAm-specific recruiter commentary found.
- No hiring-manager quotes found that specifically praise or penalise WebGL/3D portfolios for
  non-creative frontend roles.
