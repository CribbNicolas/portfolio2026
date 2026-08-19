# CLAUDE.md — instrucciones para sesiones futuras

Instrucciones operativas para vos, no documentación para humanos. Los docs de
fondo ya existen en `docs/`: acá se enlazan, no se repiten.

## Qué es esto

Capa de **contenido** de un portfolio + CV para un dev que busca trabajo y
freelance en LatAm/español. Principio rector: **los datos son la fuente única de
verdad; el CV, el portfolio y los bloques de LinkedIn son VISTAS derivadas.** El
backend guarda hechos atómicos (`Achievement`, `Skill`, `Role`, `Metric`), nunca
documentos. Existen la capa de contenido (schema + validación + dataset JSON +
una implementación de `ContentSource`) y un frontend Astro estático que solo
renderiza la superficie `cv-ats` (CV en HTML, PDF, JSON-LD, `/cv.json`,
`/llms.txt`). El portfolio visual y las demás superficies quedan para el
próximo slice. Por qué el schema es como es: `docs/CONTRATO.md` y `docs/01`–`04`.
No los reescribas; leelos.

## Mapa de archivos

```
content/
  schema/
    content-schema.ts   Los tipos + las interfaces del contrato (ContentSource, ContentView). La fuente de tipos.
    validation.ts       Zod (forma) + checkRules (coherencia). Reglas 1,2,3,6 + integridad referencial.
    dates.ts            ÚNICA fuente de cálculo de duración/antigüedad. Regla 1.
    resolve-view.ts     ÚNICA fuente de lógica de visibility. resolveView(dataset, surface). Reglas 7,8. Compartida por todo backend.
  data/
    content.es.json     El dataset real. Fase 0. Sin dataset EN (getDataset("en") tira error a propósito).
  source/
    json-source.ts      ContentSource sobre el JSON. Solo trae/cachea el dataset y delega en resolveView.
    index.ts            ⚠️ La ÚNICA línea que cambia al migrar a Sanity. Todo el frontend importa de acá.
    content-source.test.ts  Tests de reglas 7,8 + locale (lo que el schema NO valida).
scripts/validate.ts     Entry point de `npm run validate`.
.github/workflows/      content-validation.yml — typecheck + validate + test + build + test:pdf + audit:todos en cada push. Sube dist/cv.pdf como artifact. Activo (repo en GitHub).
docs/                   Ver docs/00-indice.md. El "por qué" de cada decisión de diseño vive acá.
src/
  pages/cv.astro      El CV en HTML. ÚNICA fuente del layout; de acá sale el PDF.
  pages/index.astro   Home mínima. NO es el portfolio.
  pages/cv.json.ts    Endpoint public-api.
  pages/llms.txt.ts   Endpoint markdown para agentes.
  components/cv/      Componentes tontos: reciben props resueltas, no filtran nada.
  lib/jsonld.ts       ContentView → schema.org Person.
  styles/cv.css       Una columna. Prohibido flex/grid/table (rompe el parseo).
content/schema/
  format-metric.ts    Regla 4. El "~" de los estimados vive acá y solo acá.
  format.ts           Duraciones, rangos MM/AAAA, títulos de rol. Reglas 1 y 2.
scripts/
  render-pdf.ts       renderPdf({ url }). Recibe URL, no componente: es la costura a SSR.
  build-pdf.ts        Sirve dist/ e imprime /cv → dist/cv.pdf.
  pdf-output.check.ts Verifica el PDF generado. No es *.test.ts a propósito.
  audit-todos.ts      Reporte NO bloqueante de TODOs publicados.
```

**No toques sin pensarlo:**
- `content/source/index.ts` — es la costura de migración. Cambiar el import cambia el backend de todo el proyecto.
- `content/schema/resolve-view.ts` — cualquier `.filter` de visibility que aparezca en otro lado es un bug. Toda esa lógica va acá.
- `content/data/content.es.json` — no inventes datos para llenarlo (ver invariante 4).

## Comandos

```bash
npm run typecheck   # tsc --noEmit
npm run validate    # tsx scripts/validate.ts — Zod + reglas duras
npm test            # tsx --test — reglas 7,8 + locale (lo que el schema no valida)
npm run dev         # astro dev
npm run build       # astro build + genera dist/cv.pdf
npm run test:pdf    # verifica el PDF generado (necesita build previo)
npm run audit:todos # lista TODOs publicados. No bloquea
```

**Corré la secuencia completa antes de dar cualquier cosa por hecha:**
`npm run typecheck && npm run validate && npm test && npm run build && npm run test:pdf && npm run audit:todos`.
Si `validate` falla, el mensaje dice qué regla se violó y cómo arreglarla; leelo,
no lo saltees. Todo eso corre en CI en cada push
(`.github/workflows/content-validation.yml`; repo ya en GitHub, privado) —
`audit:todos` incluido, pero como último step y sin bloquear: es un reporte, no
un gate.

## Invariantes (no negociables)

1. **El frontend NUNCA filtra por `visibility` ni calcula duraciones.** Todo eso
   vive en `resolveView` (`getView` lo llama). Un `.filter(v => v.priority...)` o
   un cálculo de meses en un componente está mal.
2. **Todo importa desde `content/source/index.ts`, nunca desde `json-source`.**
   Esa es la línea que cambia al migrar a Sanity.
3. **Ninguna duración ni antigüedad se escribe a mano.** Se deriva de
   `careerStart`/`start`/`end` vía `dates.ts`. La regla 1 del validador lo caza.
4. **Nunca inventar métricas, números, fechas ni logros para llenar el dataset.**
   Falta un dato → va como `TODO` explícito en el `Prose`. Un número inventado se
   cae en la entrevista y es peor que no tener número.
5. **`Metric.confidence` distingue `measured` de `estimated`; los estimados se
   renderizan con "~" o "aprox.".** No romper esa distinción (regla 4).
6. **`Prose.short` y `Prose.long` NO son truncado.** Son dos registros de
   escritura distintos: uno telegráfico y denso en keywords, otro que explica. Si
   aparece un `truncate()` / `.slice()` que genera `short` desde `long`, se rompió
   la intención. Escribir los dos a mano es intencional.
7. **Las reglas de `docs/CONTRATO.md` son tests de CI, no sugerencias.** Si algo
   nuevo las viola, se arregla el dato, no la regla.
8. **El copy sigue las reglas de voz de `docs/02-branding.md`,** incluida la lista
   de palabras prohibidas (`apasionado`, `proactivo`, `escalable` sin escala,
   `buenas prácticas` sin decir cuáles, etc.). Test: "¿otro con mi mismo stack
   pudo escribir esta frase idéntica?" Si sí, la frase no hace nada.

## Dónde se hace cumplir cada regla dura

Las 8 reglas de `docs/CONTRATO.md` NO se validan todas en el mismo lugar. Antes de
asumir que `validate` cubre algo, mirá esta tabla:

| Regla | Qué | Dónde se hace cumplir |
|---|---|---|
| 1 | Ninguna duración a mano | `validation.ts` → `checkRules` + `collectProse` (recorre TODO `Prose`, short y long). **CI** |
| 2 | No dos full-time solapados sin `concurrent` | `validation.ts` → `checkRules` (`overlaps`). **CI** |
| 3 | Skill `core` necesita evidencia | `validation.ts` → `checkRules`. **CI** |
| 4 | `estimated` se renderiza con "~" | `content/schema/format-metric.ts` → `formatMetric`. Único lugar. **`npm test`** (corre en CI) |
| 5 | Todo `Media` con `alt` | `validation.ts` → Zod (`media.alt.min(1)`). **CI** |
| 6 | `approved: false` no se renderiza | Doble: `resolveView` filtra por `t.approved`; `checkRules` además avisa si hay no-aprobado sin exclusión. **CI + runtime** |
| 7 | `cv-short` corta por `priority` | `resolve-view.ts` (`PRIORITY_CUTOFF`, `MAX_ACHIEVEMENTS_PER_ROLE`). **`npm test`** (corre en CI), no `validate`. |
| 8 | `streetAddress`/`phone` solo en superficies listadas | `resolve-view.ts` (filtrado de `identity`). **`npm test`** (corre en CI), no `validate`. |
| — | Integridad referencial (`roleId`/`projectId`/`skillId`) | `checkRules` (rule 0). **CI** |

## Convenciones (deducidas del código, no de preferencias)

- **Comentarios en español, explican el PORQUÉ, no el qué.** Banners de sección
  `// ---`. JSDoc `/** */` en tipos y funciones públicas; cuando un campo o
  función hace cumplir una regla, se nombra por número: `// Regla 8: ...`.
- **Tipado:** `interface` para formas de datos, `type` para uniones y alias
  (`Surface`, `SkillCategory`). Fechas SIEMPRE `YearMonth` = `` `${number}-${number}` ``,
  string `"YYYY-MM"`, nunca `Date` en los datos. Todo tipo se exporta desde
  `content-schema.ts`.
- **Zod espeja las interfaces 1:1:** un `const` lowercase por cada `interface`
  (`role` ↔ `Role`), mismos campos, mismo orden, y **todos con `.strict()`** — una
  clave no declarada tira error en vez de descartarse en silencio. Si agregás un
  campo a una interface, agregalo al schema Zod en el mismo commit (si no, el dato
  con ese campo revienta en `validate`/`test`, que es la idea).
- **Naming:** `id` en kebab/lowercase (`"mapbox-gl"`), `camelCase` funciones,
  `PascalCase` tipos, `UPPER_SNAKE` consts de configuración (`PRIORITY_CUTOFF`).
- **Funciones puras en `schema/`; I/O solo en implementaciones de `source/`.**
  `resolveView` y `checkRules` no tienen side effects.
- **ESM** (`"type": "module"`), imports sin extensión, `import type` para tipos.
- **Datos faltantes van como `TODO — ...` dentro del `Prose`**, no como campo
  vacío ni número inventado. `Prose.short` está topeado en **180 caracteres** (Zod
  lo valida): si el texto no entra, no es para `short`, va en `long`.

## Pendiente / qué NO hacer todavía

Estado completo en `docs/00-indice.md`. Resumen operativo:

- **Frontend:** existe (Astro estático, ver `src/` en el mapa de archivos), pero
  solo renderiza la superficie `cv-ats`. El CV diseñado (CV-A) queda para
  después. `components/cv/` son tontos: reciben props resueltas, no filtran
  nada (invariante 1).
- **Generadores de salida** (CV PDF, `/cv` HTML, JSON-LD `Person`, `/llms.txt`,
  `/cv.json`): existen. La regla 4 vive en un único `formatMetric()`
  (`content/schema/format-metric.ts`). Detalle de qué emite cada uno:
  `docs/CONTRATO.md` §2 y `docs/04`.
- **Métricas:** el hueco más importante. Ningún `Achievement` tiene `metric`.
  NO las inventes — candidatos y qué medir en `docs/03-cv.md` §5. Rango honesto
  con `confidence: "estimated"` sirve; número inventado no.
- **Datos a confirmar:** Hogarth (`employmentType`, `start` 2023-07), nivel de
  inglés, `careerStart`. Fuente única: `docs/00-indice.md`.
- **`services` y `testimonials` vacíos a propósito** — están en el schema para no
  migrar después. No los llenes con placeholders.
- **Dataset EN:** no cargar ni traducir (decisión fechada en `docs/00-indice.md`).
- **Sanity (Fase 1, sin apuro):** escribir `sanity-source.ts` que implemente
  `ContentSource`, traiga el dataset y llame a `resolveView`. Cambiar una línea en
  `index.ts`. Nada más.

## Preguntas abiertas / estado

Observaciones de las sesiones de arranque, con su resolución. Registradas acá
para que la próxima sesión no las redescubra desde cero:

1. **`getDataset("en")` fallaba en silencio** (devolvía ES). **RESUELTO:** ahora
   tira `Error` explícito para locales sin dataset (`json-source.ts`, `DATASETS`).
2. **No todas las reglas se validan en el mismo lugar.** **RESUELTO como
   documentación:** ver la tabla "Dónde se hace cumplir cada regla dura". La
   regla 4 tuvo dueño más tarde: `formatMetric()` en `content/schema/format-metric.ts`.
3. **La regla 1 escaneaba solo campos hardcodeados.** **RESUELTO:** `collectProse`
   recorre todo `Prose` del dataset (short + long: identity, roles, achievements,
   projects, services). Cierra la clase de agujero, no casos sueltos.
4. **No había CI ni el repo estaba en git.** **RESUELTO:** `git init`, repo privado
   `CribbNicolas/portfolio2026`, y workflow `content-validation.yml` corriendo verde
   en cada push. Extendido después a build + test:pdf + audit:todos cuando
   existieron los generadores. El estado activo vive en §Comandos.
5. **`monthsBetween` estaba duplicado.** **RESUELTO:** extraído a `dates.ts`,
   importado por `validation.ts` y `resolve-view.ts`.
6. **Los schemas Zod no eran `.strict()`:** una clave presente en el JSON pero
   ausente del schema se descartaba en silencio. **RESUELTO:** `.strict()` en todos
   los objetos + test que verifica que una clave desconocida tira error.

Además, resuelto en esta sesión: la lógica de visibility vivía dentro de
`json-source.ts` (dentro de la implementación, no de la capa compartida) —
contradecía la promesa de "migración = una línea". **Extraída a
`resolve-view.ts`.** Las implementaciones de `ContentSource` quedan reducidas a
traer el dataset.

**Regla 4, resuelta:** `formatMetric()` en `content/schema/format-metric.ts` es
el único lugar que decide el "~" de un `Metric` `estimated`. El test que antes
estaba en `todo` (`content-source.test.ts`) ya corre en verde — `npm test` no
tiene ningún `todo` en la salida.
