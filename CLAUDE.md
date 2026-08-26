# CLAUDE.md — instrucciones para sesiones futuras

Instrucciones operativas para vos, no documentación para humanos. Los docs de
fondo ya existen en `docs/`: acá se enlazan, no se repiten.

## Qué es esto

Capa de **contenido** de un portfolio + CV para un dev que busca trabajo y
freelance en LatAm/español. Principio rector: **los datos son la fuente única de
verdad; el CV, el portfolio y los bloques de LinkedIn son VISTAS derivadas.** El
backend guarda hechos atómicos (`Achievement`, `Skill`, `Role`, `Metric`), nunca
documentos. Existen la capa de contenido (schema + validación + dataset JSON +
una implementación de `ContentSource`) y un frontend Astro estático que es
**una sola página navegable**: `/` con hero, índice de anclas, mapa de
conocimiento, proyectos y el CV completo. `/cv` sigue existiendo pero NO es un
destino — es la fuente desde la que se imprime el PDF, con `noindex` y sin
links entrantes. Los casos de estudio en formato largo, los servicios y el
lado freelance quedan para el próximo slice. Por qué el schema es como es: `docs/CONTRATO.md` y `docs/01`–`04`.
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
.github/workflows/      content-validation.yml — typecheck + validate + test + build + pdf:local + test:pdf + los cuatro checks + audit:todos en cada push. Sube dist/cv.pdf como artifact. NO deployea: de eso se encarga Cloudflare Pages.
                        smoke-deploy.yml — corre test:pdf contra el /cv.pdf PUBLICADO en cada deploy con éxito de Pages (previews de staging incluidas). Solo dispara si el archivo está en la rama por defecto.
                        version-gate.yml — solo en PRs a develop: package.json.version tiene que subir.
                        flujo-de-ramas.yml — solo en PRs a staging/main: verifica de qué rama vienen.
                        A main solo entra staging; a staging solo entra develop. Los rulesets no
                        pueden expresar esto: miran la rama destino, no el origen.
functions/              Cloudflare Pages Functions. Lo ÚNICO del repo que corre en runtime.
  cv.pdf.ts           GET /cv.pdf. Le pide a Browser Rendering que imprima nuestro propio /cv y cachea el resultado. Reemplaza al dist/cv.pdf estático.
  _pdf.ts             Las piezas puras (cuerpo del pedido, clave de caché, cabeceras). El guion bajo lo saca del ruteo de Pages.
  _pdf.test.ts        Custodia que el PDF servido pida las MISMAS opciones que el PDF testeado.
docs/                   Ver docs/00-indice.md. El "por qué" de cada decisión de diseño vive acá.
                        08-ramas-y-versionado.md — feature/* → develop → staging → main, y la regla del bump.
                        LEELO antes de abrir un PR: el de develop falla si no subís la versión.
                        07-deuda-tecnica.md — lo encontrado fuera de scope y no arreglado. Mirarlo ANTES de
                        "arreglar de paso" algo: puede que ya esté anotado con su porqué.
src/
  pages/cv.astro      El CV en HTML. ÚNICA fuente del layout; de acá sale el PDF.
                      NO es un destino navegable: `noindex` y cero links entrantes.
                      El lector llega al CV por el ancla `#cv` de la landing.
  pages/index.astro   La landing: hero + índice + #mapa + #proyectos + #cv. ÚNICA página con JS.
  pages/cv.json.ts    Endpoint public-api.
  pages/build.json.ts El commit publicado (CF_PAGES_COMMIT_SHA). Un solo consumidor: el smoke,
                      que espera con esto a que Cloudflare sirva el commit recién pusheado.
  pages/404.astro     Sin esto Pages devuelve 200 con HTML para cualquier ruta: soft-404.
  pages/llms.txt.ts   Endpoint markdown para agentes.
  components/cv/      Componentes tontos: reciben props resueltas, no filtran nada.
  components/proyectos/ListaProyectos.astro  Los proyectos. Cada tarjeta lleva el id que
                      espera `buildHoverCss`: el hover cruzado con el mapa va SIN JS.
  components/lab/GraphSvg.astro  El mapa en SVG. NO es placeholder: es el fallback real.
                      El prefijo `lab` es el nombre del BLOQUE (el mapa), no de una ruta:
                      `/lab` ya no existe. Renombrarlo rompería los greps de CI.
  components/Logo.astro  La marca completa: el aro con la N adentro. La geometría NO vive
                      acá, sale de lib/marca.ts. Usa var(--acento)/var(--tinta), así que el
                      modo oscuro le sale de los tokens sin CSS propio.
  lib/marca.ts        ÚNICA fuente de la geometría de la marca. La comparten el logo del
                      header y la tarjeta social. public/favicon.svg NO puede importarla
                      (es estático): og-output.check.ts verifica que no diverjan.
  lib/jsonld.ts       ContentView → schema.org Person.
  lib/graph-svg.ts    PositionedGraph → lista de dibujo. Niebla, orden de pintado, etiquetas.
  lib/lab-hover-css.ts  Grafo → reglas :has(). El hover cruzado funciona SIN JS.
  scripts/analitica.ts  Clarity. SOLO lo llama index.astro; nunca Base.astro (/cv en cero JS).
                      El beacon de Cloudflare Web Analytics va en index.astro, tambien a mano:
                      habilitarlo desde el dashboard de Pages lo inyecta en TODO el sitio y
                      no-client-js.check.ts no lo veria (mira dist/, no lo servido).
                      Sin PUBLIC_CLARITY_ID el import se va por tree-shaking y no pesa nada.
  scripts/lab/        Lo ÚNICO que se bundlea para el browser. Ver §Frontend del mapa.
  scripts/lab/pildora.ts  Retraso de la barra flotante al scrollear. Adorno: detrás de
                      `prefers-reduced-motion` y el rAF se apaga solo al frenar.
                      Lee `scrollY` DENTRO del frame, no en el listener.
  scripts/lab/interaccion.ts  Arrastre, foco de vecindario, tooltip. No importa three:
                      el renderer le pasa una función `proyectar`. Cambiar de
                      renderer no toca este archivo.
  styles/cv.css       Una columna. Prohibido flex/grid/table (rompe el parseo).
  styles/proyectos.css  La lista de proyectos. Jerarquía tipográfica, sin tarjetas con sombra.
  styles/tokens.css   `--ancho` es el ancho de TODAS las secciones. Un solo valor, a propósito.
  styles/lab.css      El mapa. Los dos canvas son pointer-events:none. Eso es lo que hace
                      cierta la promesa de "no captura el mouse".
content/schema/
  format-metric.ts    Regla 4. El "~" de los estimados vive acá y solo acá.
  format.ts           Duraciones, rangos MM/AAAA, títulos de rol. Reglas 1 y 2.
  knowledge-graph.ts  ContentView → grafo. Incluye la afinidad skill↔skill derivada.
  graph-layout.ts     Fuerzas en 3D + proyección. Determinista, corre SOLO en build.
scripts/
  og-template.ts      El HTML de la tarjeta social. PURO: recibe textos y binarios ya
                      resueltos. No es una página de src/pages/ a propósito — se buildearía
                      y los tres checks que recorren dist/ tendrían que aprender a ignorarla.
  og-datos.ts         Lo que comparten el generador y su check: los textos derivados del
                      dataset y la huella. Aparte porque build-og.ts es entry point.
  build-og.ts         Escribe public/og.jpg + og.lock.json. `og:local`, fuera del build.
  og-output.check.ts  Medidas, techo de peso de WhatsApp, que la imagen no haya quedado
                      vieja, y que el favicon siga dibujando el aro de lib/marca.ts.
  pdf-options.ts      ÚNICA definición de las opciones de impresión. La comparten render-pdf.ts
                      (Playwright, el gate) y functions/cv.pdf.ts (producción). Si vivieran
                      separadas, el PDF testeado y el PDF servido divergirían en silencio.
  render-pdf.ts       renderPdf({ url }). Recibe URL, no componente. YA NO genera el entregable:
                      produce el dist/cv.pdf contra el que corre el gate pre-deploy.
  build-pdf.ts        Sirve dist/ e imprime /cv → dist/cv.pdf. Fuera de `build`: es `pdf:local`.
  pdf-output.check.ts Verifica el PDF. Con PDF_SOURCE=<url> corre las MISMAS assertions contra
                      el PDF publicado. No es *.test.ts a propósito.
  no-client-js.check.ts  Política de JS por página en todo dist/. Blinda /cv.
  bundle-budget.check.ts Presupuesto de la home: three fuera del camino crítico.
  landing-unica.check.ts La landing es la única puerta: /cv sin links ni indexar, y la
                      sección CV de la landing sincronizada con el PDF. Además: existe 404.html.
  servido.check.ts    Lo ÚNICO que verifica la respuesta SERVIDA y no dist/. Corre desde el
                      smoke. Ataja lo que pasa después del build: inyecciones en el borde.
  audit-todos.ts      Reporte NO bloqueante de TODOs publicados.
  version.ts          Comparación de versiones. Puro, sin I/O. Acepta SOLO x.y.z.
  version.test.ts     Tests de lo anterior. Corre en `pnpm test`.
  version-bump.check.ts  Gate del bump. Lee git, por eso no es *.test.ts.
  workflows.check.ts  Los .yml de CI parsean. Existe porque un CR incrustado dejó
                      smoke-deploy.yml inválido tres commits sin que se notara.
```

**No toques sin pensarlo:**
- `content/source/index.ts` — es la costura de migración. Cambiar el import cambia el backend de todo el proyecto.
- `content/schema/resolve-view.ts` — cualquier `.filter` de visibility que aparezca en otro lado es un bug. Toda esa lógica va acá.
- `content/data/content.es.json` — no inventes datos para llenarlo (ver invariante 4).

## Comandos

**El gestor de paquetes es pnpm** (`packageManager: pnpm@11.1.3`). No uses `npm`:
`pnpm-workspace.yaml` declara qué paquetes pueden correr scripts de instalación
(`allowBuilds`), y ese es el motivo de fondo del cambio — con npm cualquiera de
los 450 paquetes del árbol ejecuta código arbitrario al instalar.

```bash
pnpm run typecheck   # astro sync && tsc --noEmit && astro check
pnpm run validate    # tsx scripts/validate.ts — Zod + reglas duras
pnpm test            # tsx --test — reglas 7,8, locale y el grafo
pnpm run dev         # astro dev
pnpm run build       # SOLO astro build. Sin Chromium: por eso corre en Cloudflare Pages
pnpm run pdf:local   # imprime dist/cv.pdf con Playwright. Gate pre-deploy, no el entregable
pnpm run og:local    # escribe public/og.jpg (la tarjeta social) + og.lock.json. Se COMMITEA
pnpm run test:pdf    # verifica el PDF (necesita pdf:local previo, o PDF_SOURCE=<url>)
pnpm run test:js     # política de JS por página sobre todo dist/ (necesita build)
pnpm run test:bundle # presupuesto de bytes del mapa de la home (necesita build)
pnpm run test:landing # /cv aislada + sección CV sincronizada con el PDF (necesita build)
pnpm run test:og     # la tarjeta social no quedó vieja + el favicon parsea (necesita build)
pnpm run test:servido # verifica el sitio PUBLICADO. Necesita SITIO=https://…  (no dist/)
pnpm run test:version # el PR sube package.json.version. Necesita: git fetch origin develop
pnpm run test:workflows # los .yml de CI parsean y declaran jobs. Corre PRIMERO en CI
pnpm run audit:todos # lista TODOs publicados. No bloquea
pnpm run audit:deps  # pnpm audit --audit-level high
```

**Corré la secuencia completa antes de dar cualquier cosa por hecha:**
`pnpm run test:workflows && pnpm run typecheck && pnpm run validate && pnpm test && pnpm run build && pnpm run pdf:local && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run test:og && pnpm run audit:todos`.
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

## Frontend del mapa (lo único con JavaScript)

**La home es la ÚNICA página que envía JS.** `/cv` sigue en cero y eso NO es
negociable: el PDF se renderiza desde ahí esperando `networkidle`, así que un
script que se cuele cambia el PDF en silencio. **Desde el 2026-08-25 eso pasó de
romper tu build a romper producción:** el PDF lo imprime `functions/cv.pdf.ts`
sobre la página PUBLICADA, no sobre tu `dist/`.
`PAGINAS_CON_JS` en `no-client-js.check.ts` es la lista blanca —agregar una
página es una decisión explícita en un diff, no un accidente.

Reglas, todas verificadas en CI por `bundle-budget.check.ts` y
`no-client-js.check.ts`:

1. **Nada bajo `src/scripts/` importa de `@content`.** `json-source.ts` importa
   estáticamente zod y el dataset entero: un solo import los manda al browser.
   Los tipos cruzan solo por `src/scripts/lab/types.ts`, que no importa nada en
   runtime. Precedente y comentario: `src/lib/jsonld.ts:12-15`.
2. **`three` tiene UN solo importador —`grafo-3d.ts`— y se carga con
   `import()` dinámico.** Alcanza un import estático en cualquier módulo para
   que Rollup meta three (127 KB gzip) en el bundle inicial sin que nadie se
   entere. El check busca `WebGLRenderer` en los chunks críticos.
3. **Prohibido `three/examples/jsm/*` y `three/addons`.** `OrbitControls`
   registra `wheel` con `preventDefault`: eso es scroll hijacking, que el spec
   §3.4 prohíbe. Se descarta por comportamiento, no por peso.
4. **Los canvas son `pointer-events: none` siempre. Quien escucha es el
   CONTENEDOR** (`.lab__mapa`, que además es `tabindex=0`). Esa separación es lo
   que permite clickear nodos sin que el mapa se quede con los eventos que no le
   tocan. El hit-test es por proyección a NDC, no con `Raycaster`: la proyección
   hay que calcularla igual para ubicar las etiquetas.
5. **Ningún listener de `wheel` ni `touchmove`** (hay un test que lo verifica
   sobre los chunks emitidos). El scroll lo reparte el browser vía
   `touch-action: pan-y`: vertical scrollea, horizontal rota. Esa es la
   diferencia con el scroll hijacking — arbitra el browser, no nosotros. Los
   ÚNICOS `preventDefault` de `src/scripts/` están en teclado (flechas sobre el
   mapa ya enfocado, Espacio sobre un ítem de la lista), nunca sobre puntero.
6. **Cero hex en JS.** Los colores salen de `getComputedStyle` sobre los tokens,
   así el modo oscuro funciona sin JS de tema.
7. **El SVG nunca se saca del DOM.** El 3D se superpone y el SVG pasa a
   `opacity: 0`. Volver —contexto WebGL perdido, frames fuera de presupuesto—
   es quitar una clase.

**Si el dispositivo aguanta se decide en cuatro escalones** (`capacidad.ts`), y
solo el tercero mide: `prefers-reduced-motion`/`saveData`/`effectiveType`/
`deviceMemory`/WebGL2 antes de bajar un byte; el contexto al montar; **la mediana
de los primeros 30 frames contra un techo de 20 ms**; y degradación en vivo
(primero `dpr → 1`, después apagar). El tercero es el que importa: en iOS no
existen `saveData`, `effectiveType` ni `deviceMemory` —son APIs de Chromium—,
así que apoyarse en el escalón 1 es decidir a ciegas en la mitad de los
teléfonos.

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

**Arrancá por `docs/06-proxima-sesion.md`:** es el plan de trabajo en tres
fases, con cómo proceder en cada tarea y qué verificar. La regla que ordena todo:
**lo que toca cómo se CREAN los datos espera al editor de la fase 2**; arreglarlo
antes es garantizar que se retoque después.

Antes de "arreglar de paso" algo, mirá `docs/07-deuda-tecnica.md`: puede que ya
esté anotado con su porqué y con la fase que le toca. Estado completo en
`docs/00-indice.md`. Resumen operativo:

- **Frontend:** existe (Astro estático, ver `src/` en el mapa de archivos):
  `/cv` sobre `cv-ats` y la home sobre `portfolio`. El CV diseñado (CV-A) y los
  casos de estudio quedan para después. `components/cv/` son tontos: reciben
  props resueltas, no filtran nada (invariante 1).
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
- **Backend: NO por ahora.** Evaluado el 2026-08-25 (`docs/06` §5). Keystatic
  descartado —exige adaptador SSR más React y Markdoc—; Sanity viable pero
  pospuesto, porque con los datos afuera de git el contenido deja de pasar por
  los gates. En su lugar va `pnpm run editor`, un editor local. Adoptar Sanity
  más adelante sigue costando lo mismo: `sanity-source.ts` y una línea en
  `index.ts`.
- **Techos que están al límite:** el PDF va 2 de 2 páginas y el chunk 3D al 87%.
  Agregar contenido al CV implica sacar otro. Tabla completa en el `README`.

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
