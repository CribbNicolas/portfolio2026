# 02 — Branding: positioning, voice and LinkedIn

The copy quoted here is in Spanish because the copy itself is in Spanish. The
prose around it is not.

---

## 1. The two identities

They coexist and do not mix:

| | What it is | Where it lives |
|---|---|---|
| **Brand identity** | `Product Engineer` — I build complete web products, not screens | About, portfolio, conversation |
| **Search identity** | `Desarrollador Full Stack` | First position of the headline and of the CV |

In LatAm nobody types "Product Engineer" into Computrabajo, Bumeran or LinkedIn
Recruiter. **The searchable title starts the chain; the identity comes after.**
Inverting the order gains character and loses appearances — and with freelance +
local market, appearances are the asset.

In the schema: `identity.searchTitle`, `identity.brandTitle`,
`identity.titleAliases`.

## 2. Language rule

Copy in Spanish, **technical terms always in English**. Boolean searches are run
with "React", "Node.js", "TypeScript". Write "Desarrollador Full Stack" but
"React · Next.js · TypeScript · Node.js".

## 3. The differentiator

It is not React: hundreds of thousands of people have that. It is that **you ship
complete web products for real businesses** — frontend with depth, plus CMS,
infrastructure, deploy and data. And within that, two things almost nobody has:

- **Geospatial data** (Mapbox GL JS, polygon layers, feature-state).
- **Legacy environments modernised without breaking them** (WordPress plugins
  with React + TypeScript, build migrated to Vite). In freelance this sells
  enormously.

## 4. LinkedIn headline

**Option A — searchable + identity (recommended)**
```
Desarrollador Full Stack (Product Engineer) | React · Next.js · TypeScript · Node.js | Construyo productos web completos: del repo a producción | Docker · CI/CD · headless CMS
```

**Option B — with an active freelance signal**
```
Desarrollador Full Stack | React · Next.js · TypeScript · Node.js | Productos web end-to-end para negocios reales | Disponible para proyectos freelance
```

**Option C — with the data/maps differentiator**
```
Desarrollador Full Stack · React · Next.js · TypeScript | Interfaces con datos pesados y mapas (Mapbox) | Del frontend al deploy: Node · Docker · CI/CD
```

Maximum 220 characters. No repeated word — repeating keywords lowers the score in
semantic matchers.

## 5. About / summary

The first ~220 characters are what is seen without clicking and what weighs most.

```
Construyo productos web completos, no solo la interfaz.

Soy desarrollador full stack con foco en producto: React, Next.js y TypeScript
del lado del frontend, y el backend, la infraestructura y el deploy necesarios
para llevar algo de una idea a producción real.

Pasé por agencias, adtech y proyectos propios. Eso me dejó una forma de trabajar
bastante concreta: entender primero qué problema de negocio hay detrás de la
pantalla, elegir la tecnología más aburrida que lo resuelva bien, y dejar el
código en un estado donde el próximo que lo toque —a veces yo, seis meses
después— no tenga que adivinar nada.

Algunas cosas que hice:
· [Proyecto]: [qué resolvía] — [resultado o número]
· [Proyecto]: [qué resolvía] — [resultado o número]
· [Proyecto]: [qué resolvía] — [resultado o número]

Trabajo cómodo en todo el recorrido: React, Next.js, TypeScript, Solid, Vue 3,
Tailwind, Node, PHP/WordPress, Playwright, Docker, Cloudflare, CI/CD y monorepos.
Uso desarrollo asistido por IA (Claude Code, Cursor) como parte del flujo diario,
con revisión propia de todo lo que entra al repo.

Me interesan los equipos donde se puede discutir criterio técnico sin ego.

Tomo también proyectos freelance: [tipo de proyecto que querés atraer].
📩 [mail] · 🔗 [portfolio]
```

What each part does: the first line is identity (human). The bullets with numbers
are the personalisation that avoids layer 3's discard. The stack paragraph is
keyword density for layer 2. The AI line is honest and verifiable, without being
the centre.

**Note:** do not write the seniority by hand here. It derives from `careerStart`
(contract rule 1).

## 6. LinkedIn skills

**Top 3 pinned:** React · TypeScript · Next.js

**Full list (15-20, not 50):** React, TypeScript, JavaScript, Next.js, Node.js,
Desarrollo Full Stack, Tailwind CSS, REST APIs, Docker, CI/CD, Playwright,
Mapbox, WordPress, PHP, Vue.js, SolidJS, Git, Cloudflare.

Ask 3-5 former colleagues for endorsements **specifically on the top 3**. A skill
with endorsements ranks above the same skill without them.

## 7. Profile hygiene

- Custom URL (`/in/nicolascribb`).
- Professional photo + banner with the value proposition in text.
- **Featured** section: portfolio, main case study, GitHub.
- Activity: 2-3 substantive interventions a week. No need to post original work;
  technical comments with judgement are enough.
- Total coherence with the CV: same dates, same titles, same skills. Layer 2
  cross-checks sections.

## 8. Voice: the rule governing all the copy

Structure and vocabulary can be "machine-like" — that helps at layer 2. **The
facts have to be yours and verifiable** — that is what saves you at layer 3.

Test before publishing any line:

> Could another person with my exact stack have written this identical sentence?

If the answer is yes, the sentence is doing nothing. Rewrite it with a proper
name, a number or a decision.

### Banned words

`apasionado` · `proactivo` · `resultados` · `soluciones innovadoras` ·
`aprovechar` · `liderar` (with no object) · `buenas prácticas` (without saying
which) · `stack moderno` · `escalable` (without saying at what scale) ·
`cutting-edge` · `dinámico` · `orientado a resultados`

### Writing pattern for an achievement

```
[past-tense verb] + [concrete technical object] + [what for] + [outcome or number]
```

Bad: *"Implementé buenas prácticas para garantizar la escalabilidad."*
Good: *"Migré el tooling de build de Webpack a Vite, reduciendo el tiempo de
build de X a Y."*
