# Spec — El CV como sistema (slice 1)

Fecha: 2026-08-13
Estado: aprobado, pendiente de plan de implementación

Primer slice de frontend del proyecto. Entrega un CV que pasa los tres filtros
de `docs/01-filtros-y-seleccion.md`, servido en HTML y en PDF, más la capa
legible por máquinas. **No** entrega el portfolio visual.

---

## 1. Punto de partida

Lo que ya existe (no se rediseña, se consume):

- `content/schema/content-schema.ts` — tipos y el contrato `ContentSource`.
- `content/schema/resolve-view.ts` — toda la lógica de `visibility`. Reglas 7 y 8.
- `content/schema/dates.ts` — única fuente de duraciones. Regla 1.
- `content/source/index.ts` — la costura de migración. Todo importa de acá.
- Dataset real en `content/data/content.es.json`, validado en CI.

Lo que falta y este slice resuelve:

| Hueco | Estado hoy |
|---|---|
| Frontend consumiendo `getView()` | No existe |
| Contrato de salida (`ContentView` → texto) | No existe; **la regla 4 no tiene dueño** |
| CV en HTML y en PDF | No existe |
| Capa máquina (JSON-LD, `llms.txt`, `cv.json`) | No existe |

**Corrección de premisa que originó este spec:** el contrato de *datos* ya
estaba hecho. Lo que faltaba era el contrato de *salida*.

## 2. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Framework | Astro, `output: 'static'` | Cero JS por defecto, HTML server-rendered — requisito de la capa máquina (`docs/04` §3) |
| Ubicación | Astro en la raíz, mismo `package.json` | `content/` no se mueve; la costura `index.ts` no cambia de path; el CI actual sigue verde |
| Momento del PDF | En build, estático | Hosting sin servidor. **Diseñado para escalar a on-demand** sin reescribir el generador |
| Motor de PDF | Playwright (headless Chrome) | Un solo layout para HTML y PDF: no pueden desincronizarse. Texto seleccionable y PDF *tagged* |
| Artefactos | **Uno solo**: `cv.pdf`, diseñado y de una columna | `docs/01` §3: lo que rompe el parser es la estructura, no la estética. Un artefacto = nunca dudar cuál mandar |
| Superficie renderizada | `cv-ats`, **y solo esa** | `priority ≤ 3`, máx 5 bullets por rol. Ya resuelto por `resolveView`. Habrá más CVs más adelante: agregar `cv` o `cv-short` es agregar una página que pida otra superficie, sin tocar la maquinaria |
| Teléfono | Fuera de toda superficie pública | `/cv` HTML y `cv.pdf` comparten superficie, así que comparten política de contacto. **Requiere editar el dataset:** hoy `publishPhoneOn` incluye `cv-ats`, o sea que tal como está el teléfono se publicaría en la web abierta |
| Container API de Astro | **Descartada** | Sigue siendo `experimental_AstroContainer`. El PDF se saca navegando a la página construida; la misma costura sirve para SSR |

Descartadas y por qué: Typst y React-PDF/pdfmake obligan a mantener un **segundo
layout** que espeja el HTML, sin nada en CI que impida que diverjan. En
React-PDF además el orden de extracción de texto depende del orden de dibujo,
que es riesgo directo en la capa 1 — la que `docs/01` llama "la más letal".

## 3. Arquitectura

```
src/
  pages/
    index.astro        Home mínima: nombre, titular, link a /cv, descarga del PDF. NO es el portfolio.
    cv.astro           El CV en HTML. Una columna. ÚNICA fuente del layout.
    cv.json.ts         Endpoint → superficie public-api.
    llms.txt.ts        Endpoint → markdown generado.
  components/cv/       Componentes tontos: reciben props ya resueltas, no filtran nada.
  lib/
    jsonld.ts          ContentView → schema.org Person. Salida web, vive con la web.
content/schema/
  format-metric.ts     Regla 4. Un archivo para la regla, como dates.ts es el de la regla 1.
  format.ts            Duraciones, rangos de fecha y títulos. Ver §4.
scripts/
  build-pdf.ts         Post-build: sirve dist/, Playwright imprime, escribe dist/cv.pdf.
  audit-todos.ts       Reporte no bloqueante de TODOs que llegan a outputs públicos.
```

**Por qué los formatters van en `content/schema/` y no en `src/lib/`:** el test
en `todo` de `content-source.test.ts` ya importa `../schema/format-metric.js`, y
tiene razón — son funciones puras que hacen cumplir reglas del contrato, no
detalles de la web. El CLI por-aviso y el generador de bloques de LinkedIn las
van a necesitar sin arrastrar Astro. `CLAUDE.md` ya lo dice: funciones puras en
`schema/`, I/O solo en `source/`.

### Las tres costuras

1. **`content/source/index.ts`** — no se toca. `src/` importa `getView` vía alias
   `@content`. Ningún `.astro` importa `json-source` (invariante 2).
2. **`content/schema/format.ts` + `format-metric.ts`** — nuevas. Todo
   `ContentView` → string pasa por acá. Un componente que concatena
   `${meses} meses` a mano es un bug (invariante 3).
3. **`renderPdf({ url, out? }) → Buffer`** — recibe una **URL**, no un componente.
   Hoy apunta a `dist/` servido en localhost; en SSR mañana apunta a la ruta viva
   con `?job=`. El cuerpo no cambia.

Astro solo consume `getView(surface, locale)`. Un `.filter(v => v.priority...)`
en `src/` rompe el invariante 1.

## 4. El contrato de salida

`content/schema/format-metric.ts` y `content/schema/format.ts` — funciones
puras, sin JSX, testeadas con `tsx --test`.

| Función | Comportamiento | Regla |
|---|---|---|
| `formatMetric(m: Metric)` | `measured` → `"-40%"`. `estimated` → `"~40%"`. Con `before`/`after` → `"12 min → 3 min"`, prefijado con `~` si es estimado | **4** |
| `formatDuration(months)` | `"1 año 11 meses"`. Nunca escrito a mano | 1 |
| `formatDateRange(start, end)` | `"07/2023 — Actualidad"`. Formato `MM/AAAA` por `docs/03` §2; `end: null` = Actualidad | 1 |
| `formatRoleTitle(role)` | `displayTitle ?? title`, más `"(en paralelo)"` si `concurrent` | 2 |
| `formatSeniority(years)` | Derivado de `careerStart` | 1 |

Lo que **no** hace: no trunca (invariante 6 — `short` y `long` se escriben a
mano), y no decide qué entra (eso es `resolveView`).

El test que hoy está en `todo` en `content-source.test.ts` importando un
`formatMetric` inexistente pasa a verde. **Es el único cambio a un archivo
existente de `content/`.** La regla 4 deja de estar huérfana.

## 5. El CV

Se renderiza la superficie `cv-ats` en `src/pages/cv.astro`, y de ese HTML sale
el PDF.

### Capa 1 — parser

| Permitido | Prohibido |
|---|---|
| Color, tipografía, pesos, tamaños, espaciado, líneas divisorias | Dos columnas, `<table>` para maquetar, `position: absolute` |
| Un solo `<h1>` = nombre + `searchTitle` | Texto dentro de SVG o imagen |
| `<h2>` estándar: `Perfil`, `Habilidades técnicas`, `Experiencia`, `Educación`, `Idiomas` | Headers/footers de página (`displayHeaderFooter: false`) |
| `<ul>` / `<li>` reales para los bullets | Íconos que carguen significado (📧 en vez de "Email:") |

El orden del DOM **es** el orden de lectura del PDF. Una columna en el DOM,
aunque visualmente haya sangrías.

### Capa 2 — LLM

Sale del schema, no del maquetado: fechas y duraciones derivadas de un solo
`careerStart` (coherencia cruzada entre secciones), `formatRoleTitle` marcando
`concurrent` para evitar la bandera roja de la regla 2, y cobertura visible de
`Achievement.dimension`.

**Keywords canónicas, no acumuladas.** La sección de skills imprime `Skill.name`
y nada más. `Skill.aliases` **no** se imprime: `docs/01` §3 documenta que
repetir un término *baja* el score en matchers semánticos. Los aliases quedan
como dato para el CLI por-aviso del slice 2.

### Capa 3 — humano

Bullets = `Achievement.text.short` (topeado en 180 chars por Zod, arranca en
verbo pasado), con la métrica inline vía `formatMetric`.

**Acá el hueco es de datos, no de código:** hoy ningún `Achievement` tiene
`metric`. Este slice entrega la maquinaria; los números los carga el autor.
Invariante 4 prohíbe inventarlos. Ver §9.

### Los `TODO` del dataset no pueden filtrarse al PDF

`resolveView` pasa `languages` sin filtrar (`resolve-view.ts:132`) y
`LanguageSkill.note` no es `Prose`, así que `collectProse` de la regla 1
tampoco lo alcanza. Hoy ese campo dice literalmente
`"TODO — confirmar nivel real"`. Lo mismo pasa con `Project.outcome.short` en
dos de los tres proyectos, que entran en la vista por `priority ≤ 3`.

Dos medidas, deliberadamente asimétricas:

1. **`cv.astro` no renderiza `LanguageSkill.note` ni `Project.outcome`.** El CV
   imprime idioma y nivel, y nada más. Los proyectos no llevan sección de
   resultado en el CV. El PDF queda limpio por construcción, no por disciplina.
2. **Los `TODO` que sí llegan a `/cv.json` y `/llms.txt`** se reportan en un
   step **no bloqueante** de CI (`npm run audit:todos`), que lista dónde están.
   No falla el build: son datos pendientes conocidos del autor, y un pipeline
   rojo permanente deja de dar señal.

Lo único bloqueante es que **`dist/cv.pdf` no contenga la cadena `TODO`** —
verificable con el texto que ya se extrae en §6.

## 6. Motor de PDF

```
npm run build  →  astro build  &&  tsx scripts/build-pdf.ts
```

`scripts/build-pdf.ts` levanta un servidor estático sobre `dist/` con
`node:http` (sin dependencia nueva), Playwright abre `http://localhost:PORT/cv`,
imprime y escribe `dist/cv.pdf`.

El archivo en `dist/` se llama `cv.pdf` porque la URL corta es lo que se pega en
postulaciones. El nombre que exige `docs/03` §2
(`Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf`) se impone con el atributo
`download` del enlace: el visitante guarda ese nombre, el link sigue siendo
`/cv.pdf`.

```ts
await page.pdf({
  format: "a4",
  printBackground: true,
  preferCSSPageSize: true,  // manda el @page del CSS
  tagged: true,             // reading order explícito dentro del PDF
  outline: true,            // marcadores por sección
  displayHeaderFooter: false,
});
```

`tagged` y `outline` existen en `page.pdf()` desde Playwright 1.42 (verificado
contra la documentación oficial, no asumido).

Tres detalles que deciden si funciona:

- **Fuentes self-hosted en `woff2`**, más `await document.fonts.ready` antes de
  imprimir. Depender de fuentes del sistema hace que el PDF del Windows local y
  el del Ubuntu de CI salgan distintos.
- **Saltos de página por CSS**: `break-inside: avoid` en cada bloque de rol,
  `@page { size: A4; margin: 18mm 16mm }`.
- **La firma es `renderPdf({ url, out? })`.** Recibe URL, no componente. Esa es
  la costura que permite pasar a on-demand sin reescribir nada.

### El test que hace cumplir "pasa el ATS"

Después de generar, CI abre `dist/cv.pdf` con `pdfjs-dist`, extrae el texto y
verifica:

1. el texto extraído **no está vacío** — si sale vacío, el PDF es una imagen y
   la capa 1 lo descarta entero;
2. contiene `identity.fullName`, `identity.searchTitle` y el `company` de cada
   rol visible en la superficie;
3. el nombre aparece **antes** que el primer rol en el orden de extracción
   (reading order sano);
4. `numPages <= 2`;
5. el texto **no contiene la cadena `TODO`**.

Esto convierte "pasa el ATS" de intención en test de CI, que es lo que exige el
invariante 7.

## 7. Capa máquina

Todo generado desde `getView`. Nada escrito a mano: un JSON-LD tipeado a mano se
desincroniza del CV en el primer cambio, que es exactamente lo que el sistema
existe para impedir.

| Salida | Contenido | Archivo |
|---|---|---|
| `/cv.json` | `ContentView` de superficie `public-api`, serializado | `src/pages/cv.json.ts` |
| JSON-LD `Person` | En el `<head>` de `/` y `/cv`, server-rendered | `src/lib/jsonld.ts` |
| `/llms.txt` | Markdown: quién sos, stack, roles, proyectos con links, y links a `/cv` y `/cv.pdf` | `src/pages/llms.txt.ts` |

Campos del `Person`: `name`, `jobTitle` = `searchTitle` (el buscable, no
`brandTitle`), `knowsAbout` = skills `core` y `working`, `sameAs` = links
github/linkedin/website, `address` sin `streetAddress`, `worksFor` del rol
activo, `alumniOf` desde `education`, `@id` estable `https://DOMINIO/#person`.

`astro.config` toma `site` de la env var `SITE_URL`, con un default. Cuando haya
dominio definitivo, cambia una variable.

## 8. CI y scripts

Se **extiende** `.github/workflows/content-validation.yml`, no se crea otro:

```
typecheck → validate → test → playwright install chromium (cacheado) → build → test del PDF
```

Los tres comandos actuales quedan intactos.

Scripts nuevos en `package.json`: `dev`, `build`, `preview`. `test` sigue siendo
`tsx --test` y suma los tests de `lib/format/*`, la forma del JSON-LD y el smoke
test del PDF.

**Deploy:** `output: 'static'` corre en cualquier hosting. Recomendación:
**Cloudflare Pages** — el repo es privado y GitHub Pages sobre repo privado
exige plan pago. Requiere la cuenta del autor; el spec deja el paso escrito, no
lo ejecuta.

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **El dataset no tiene ninguna `metric`** | El CV pasa capas 1 y 2 pero queda flojo en la capa 3, que es la que decide | Ninguna técnica. Carga de datos del autor, asumida explícitamente: se corrige después y el CV se regenera solo. Candidatos en `docs/03-cv.md` §5 |
| Chromium en CI: build más lento y más frágil | Pipeline de minutos en vez de segundos | Cache de browsers de Playwright; step aislado para que el fallo sea legible |
| Fuentes distintas entre local y CI | PDFs que no coinciden | Self-hosting de `woff2` + `document.fonts.ready` |
| El CV excede 2 páginas al crecer el dataset | Descarte por longitud | El test de `numPages <= 2` falla en CI. Se corrige bajando `priority` en el dato, no el layout |

## 10. Criterios de aceptación

1. `npm run typecheck && npm run validate && npm test && npm run build` pasan en
   limpio, local y en CI.
2. `dist/cv.pdf` existe, tiene texto seleccionable y pasa las cuatro
   verificaciones de §6.
3. `/cv` renderiza el CV completo en HTML, una columna, sin JS de cliente.
4. `/cv.json`, `/llms.txt` y el JSON-LD del `<head>` salen del mismo `getView`.
5. `grep` de `.visibility` y de `.priority` dentro de `src/` da cero resultados
   (invariante 1).
6. `grep` de `json-source` dentro de `src/` da cero resultados (invariante 2).
7. El test en `todo` de `content-source.test.ts` está en verde.
8. Ni `streetAddress` ni `phone` aparecen en `dist/` (regla 8). Requiere sacar
   `cv-ats` de `publishPhoneOn` en el dataset.
9. El texto de `dist/cv.pdf` no contiene `TODO`. El resto de los outputs se
   audita sin bloquear (`npm run audit:todos`).

## 11. Fuera de alcance

- **Portfolio visual**, casos de estudio, servicios, testimonios → slice 2.
  `docs/04` §6 pide la investigación de portfolios de referencia **antes** de
  decidir el diseño visual.
- **CLI de CV-por-aviso** usando `Skill.aliases` → slice 2.
- **Mapper a JSON Resume** → si aparece un consumidor concreto. El mapeo son
  ~80 líneas y el retorno práctico hoy es bajo.
- **Dataset EN, Sanity, blog** → decisiones ya fechadas en `docs/00-indice.md`,
  sin cambios.
- **Métricas** → dato, no código. Candidatos en `docs/03-cv.md` §5.

## 12. Decisiones abiertas

- **Dominio definitivo.** No bloquea la implementación (`SITE_URL` con default),
  sí bloquea el `@id` estable del JSON-LD y el canonical.
- **Datos de Hogarth** (`employmentType`, `start` 2023-07) siguen sin confirmar
  desde `docs/00-indice.md`. Si cambian, cambia el CV renderizado.
- **Nivel de inglés** para la sección `Idiomas`.
