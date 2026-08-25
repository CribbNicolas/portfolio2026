# 06 — Plan de trabajo

Escrito el 2026-08-25 al cerrar la sesión de infraestructura. Reemplaza al
handoff anterior, que hablaba de un deploy bloqueado y de ramas que ya no
existen.

**La infraestructura está cerrada.** Sitio público en
`https://cribbnicolas.pages.dev`, PDF a demanda, analítica midiendo, y el flujo
`feature/*` → `develop` → `staging` → `main` enforced por rulesets y por dos
workflows propios. Detalle en [`05`](./05-deploy-y-analitica.md) y
[`08`](./08-ramas-y-versionado.md).

---

## 0. El orden, y por qué

Tres fases. **El orden importa y no es arbitrario.**

| Fase | Qué | Por qué acá |
|---|---|---|
| **1** | Metadata social + la deuda técnica que no toca la creación de datos | Lo que más mueve la aguja por hora. Hoy compartir el link da una URL pelada |
| **2** | `pnpm run editor` | Necesita que el schema esté quieto. Si se toca antes, se hace dos veces |
| **3** | La deuda que sí toca la creación de datos, y lo que haya quedado | Se resuelve con el editor a la vista, no antes |

**La regla que separa la fase 1 de la fase 3:** todo lo que tenga que ver con
**cómo se crean o se modelan los datos del CV** espera al editor. Arreglarlo
antes es garantizar que se retoque después.

Con ese criterio, de las 13 entradas abiertas de [`07`](./07-deuda-tecnica.md)
solo dos se posponen: la **§7** (`/cv.json` publica campos internos) y la **§6**
(la Function no se prueba de punta a punta en local, que además es una
limitación y no un defecto).

---

## 1. Fase 1 — metadata y deuda

### 1.1 Antes de escribir código: verificar a ojo

Sigue pendiente de dos sesiones atrás y ningún test lo reemplaza.

- [ ] **Hover cruzado tarjeta ↔ mapa.** Verificado que los ids del DOM coinciden
      3/3 con las reglas `:has()`. Eso prueba que el CSS apunta a algo, no que
      se vea bien.
- [ ] **Inercia de la píldora.** Simulada: arrastra 19.9 px, cruza el cero
      200 ms después de frenar, rebota 3.5 px. Apagada bajo
      `prefers-reduced-motion`. Los números son correctos; la sensación hay que
      sentirla.
- [ ] **El PDF en un visor de verdad**, no solo pasando los diez tests.

**Cómo:** `pnpm run dev`, y `pnpm run pdf:local` para el PDF. Diez minutos.
Cierra la [`07`](./07-deuda-tecnica.md) §13.

### 1.2 Metadata social — [`07`](./07-deuda-tecnica.md) §17

La deuda más visible que queda. Cuatro pasos, en orden de impacto.

**a) Open Graph y Twitter Card en `Base.astro`.**
Se derivan del `title` y la `description` que el layout ya recibe, más
`Astro.site` para `og:url`.

> **Cuidado:** `/cv` **no** debe llevarlos. Es `noindex` y no es un destino
> compartible. `Base.astro` lo usan las tres páginas, así que las etiquetas van
> condicionadas —o se pasan por props desde cada página, que es más explícito y
> sigue el patrón del `slot="head"` que ya existe.

**Verificar:** `pnpm run build && pnpm run test:js` —`/cv` sigue en cero JS— y
después pegar la URL de la preview de `staging` en el validador de LinkedIn o
en un chat cualquiera.

**b) La imagen social.** Sin `og:image` no hay tarjeta aunque el resto esté, y
**no hay ni un asset de imagen en el repo**. Dos caminos:

- Generarla en build desde el nombre y el título, con los mismos tokens
  tipográficos del sitio. Se mantiene sola cuando el dato cambia.
- Un PNG a mano en `public/`. Más rápido hoy, se desactualiza solo.

El primero encaja mejor con "los datos son la fuente de verdad", pero es más
trabajo. Decidir antes de empezar, no a mitad.

**c) Favicon.** `/favicon.ico` y `/favicon.svg` dan 404 hoy.

**d) `sitemap.xml` y `robots.txt`.** `@astrojs/sitemap` resuelve el primero.
Para el segundo, un `public/robots.txt` con la línea `Sitemap:`.

> **Sin verificar:** hoy Cloudflare sirve un `robots.txt` gestionado que son
> **solo comentarios** —cero directivas—. **Hay que comprobar contra un deploy
> si `public/robots.txt` le gana al gestionado.** Si no le gana, el sitemap hay
> que anunciarlo por Search Console y anotarlo como limitación.

### 1.3 El resto de la deuda de fase 1

Por severidad. Cada una con su entrada en [`07`](./07-deuda-tecnica.md).

| # | Qué hacer | Cómo verificar |
|---|---|---|
| §8 | `endpoints.check.ts`: que `/cv.json` parsee y traiga las claves del contrato, y que `/llms.txt` no tenga campos vacíos ni títulos de rol partidos | Sumarlo a `content-validation.yml` con los otros checks que leen `dist/` |
| §11 | `pnpm.overrides` para forzar `sharp >= 0.35.0` y ver si el árbol lo aguanta | `pnpm run audit:deps` en verde, y el build sigue pasando |
| §9 | Mover `GRUPOS` de `SkillList.astro` a `content/schema/` y que `llms.txt.ts` importe de ahí | El CV y `/llms.txt` dicen las mismas etiquetas en el mismo orden |
| §10 | Test de fuentes embebidas en `pdf-output.check.ts` usando la API de `pdfjs` | Corre solo contra los dos caminos, porque ese archivo ya acepta `PDF_SOURCE` |
| §2 | Subir `build.chunkSizeWarningLimit` en `astro.config.mjs`, con el comentario de por qué | El build deja de emitir el warning y `test:bundle` sigue siendo el techo real |
| §3 | Borrar `ORBITA`; prefijar con `_` lo que se ignora a propósito en `grafo-3d.ts` | `pnpm run typecheck` baja de 6 hints a 3 |
| §4 | `is:inline` explícito en los tres `<script type=…>` de datos | `typecheck` sin hints `astro(4000)` |
| §12 | Leer los tres criterios del plan viejo y decidir: check propio, o ya cubierto | Uno de los tres quedó sin objeto — verificaba el teléfono, que ya no está en el dataset |
| §5 | Confirmar por qué un merge no deja corrida propia de CI, o aceptarlo y cerrar la entrada | No cambia el mecanismo: el check que cuenta viene del evento `pull_request` |

**Cómo trabajar la fase 1.** Una rama por tema, no una sola con todo. `§17` es
un PR; los cosméticos (`§2`, `§3`, `§4`) entran bien juntos en otro porque
comparten la historia "bajar el ruido que tapa la señal nueva". Cada PR sube la
versión (ver [`08`](./08-ramas-y-versionado.md) §4).

---

## 2. Fase 2 — `pnpm run editor`

Un editor local del dataset, para dejar de tocar `content.es.json` a mano.
Decidido el 2026-08-25 tras evaluar Sanity y Keystatic (§5).

### La forma acordada

```bash
pnpm run editor     # abre localhost:4322, editás, guarda content.es.json
pnpm run validate   # Zod + las 8 reglas
commit → PR         # los gates de siempre
```

**Fuera de `src/pages/`, y esa es la decisión central.** Una ruta dentro del
sitio traería tres problemas que este repo ya pagó por evitar:

1. Escribir un archivo necesita `POST`, y con `output: "static"` los endpoints
   se prerenderizan y son solo GET. Habilitar POST implica adaptador SSR — lo
   mismo que hizo descartar Keystatic.
2. Una página en `src/pages/` se buildea. Que "solo funcione en local" pasaría a
   depender de una guarda por `import.meta.env.DEV`, o sea de que nadie la rompa.
3. `no-client-js`, `bundle-budget` y `landing-unica` recorren todo `dist/`. Un
   editor con formularios los obligaría a tener excepciones, y una excepción en
   un check es una grieta permanente.

Precedente: `scripts/build-pdf.ts` ya levanta un servidor de 30 líneas, con el
comentario *"agregar una dependencia para esto sería más superficie de
mantenimiento que el problema que resuelve"*.

### Las dos preguntas que definen el alcance

**No arrancar sin contestarlas.**

1. **¿Qué parte del dataset se edita?** `Achievement`, `Metric` y los `Prose`
   cubren el 90% de las ediciones reales. Un formulario para las seis
   superficies, los `visibility`, los `skillIds` y el grafo es bastante más
   trabajo y casi nunca se toca.
2. **¿El formulario se deriva del schema Zod, o se escribe a mano?** Derivarlo
   es más trabajo al principio y cero mantenimiento después: agregar un campo al
   schema lo hace aparecer en el editor. A mano es al revés, y garantiza que en
   tres meses el editor y el schema no coincidan.

### Cómo proceder

- **Escribir siempre por `validate`.** El editor no debe poder guardar un
  dataset que `checkRules` rechazaría; que el error salga en el formulario y no
  tres comandos después.
- **No duplicar reglas.** Toda validación sale de `content/schema/`. Una regla
  reimplementada en el editor es una regla que va a divergir.
- **Preservar el formato del JSON.** Reescribirlo con `JSON.stringify` entero
  produce un diff enorme en cada edición y hace ilegible el historial, que es
  medio motivo por el que los datos siguen en git.
- **El editor no necesita tests de UI**, pero la capa que lee y escribe sí:
  es donde se pierde un dato.

### Lo que el editor NO resuelve

Editar desde el celular. Descartado a conciencia — §5.

---

## 3. Fase 3 — cierre

- **[`07`](./07-deuda-tecnica.md) §7** — `/cv.json` publica `publishPhoneOn` y
  40 `visibility` + 40 `priority`. Es una proyección nueva para la superficie
  `public-api`, no un filtro: el tipo de salida tiene que ser distinto del de
  las superficies internas. **Con el editor hecho**, porque para entonces se
  sabe qué campos son realmente internos.
- **[`07`](./07-deuda-tecnica.md) §6** — la Function no se prueba de punta a
  punta en local. Decidir si vale un túnel o se acepta y se cierra la entrada.
- Lo que haya aparecido en el camino.

---

## 4. Datos — el hueco que solo puede llenar el autor

Nada de esto se puede hacer sin vos (invariante 4: no se inventan datos). **Es
justo el trabajo que el editor de la fase 2 viene a hacer soportable**, así que
conviene atacarlo con la herramienta hecha.

### Métricas: cero en todo el dataset

`grep -c '"metric"' content/data/content.es.json` → **0**. Candidatos en
[`03-cv.md`](./03-cv.md#5-métricas-pendientes):

| Logro | Qué medir |
|---|---|
| `dinkum-vite` | Tiempo de build antes/después |
| `dinkum-mapbox` | Volumen de datos o usuarios del mapa |
| `adsmovil-datos` | Tiempo, volumen o tasa de error en la recolección |
| `adsmovil-react` | Tamaño del equipo, productos migrados |
| `freelance-build` | Peso del bundle o tiempo de carga antes/después |
| `hogarth-i18n` | Mercados o idiomas |

Un rango honesto con `confidence: "estimated"` sirve — se renderiza con "~"
(regla 4). Un número inventado se cae en la entrevista.

### Los 8 TODO publicados

`audit:todos` reporta **9** porque cuenta apariciones en `dist/` y una misma
entrada se publica en más de una salida. Son 8 datos.

| Qué | Falta |
|---|---|
| summary | Versión larga, para LinkedIn y portfolio |
| `dinkum-mapbox` | Volumen de datos, qué resolvía al usuario final |
| `jwd-maderas` | Arquitectura y modelado; consultas recibidas o tiempo ahorrado |
| `mapas-distritos` | Qué necesitaba resolver el usuario; volumen o impacto |
| `wp-plugins` | Tiempo de build antes/después, plugins entregados |
| idiomas | **Nivel real de inglés** — hoy declarado sin confirmar |

### Otros

- [ ] Links de los tres proyectos: `links: []`. La sección los renderiza solo si
      existen — es editar el dataset, no tocar código.
- [ ] **Hogarth**: confirmar `employmentType` y `start: 2023-07`.
- [ ] **Rol Freelance (2020-04 → 2022-06)**: un solo logro, con
      `skillIds: ["javascript"]`. Esos 2.2 años no conectan con ninguna otra
      tecnología, y por eso WordPress —declarada `core`— sale chica en el mapa.

---

## 5. Contenido y front, después de las tres fases

- [ ] **Casos de estudio en formato largo** ([`04`](./04-portfolio.md) §2:
      problema → decisión → resultado). Bloqueado en `problem.short` y
      `outcome.short`.
- [ ] **Sección Servicios** (lado freelance). `services` está vacío a propósito
      — no llenar con placeholders.
- [ ] **Sección Sobre mí.**
- [ ] **Investigación de patrones de portfolios** ([`04`](./04-portfolio.md) §6).
      Conviene **antes** de diseñar los casos de estudio, no después.
- [ ] **CV diseñado (CV-A).** La maquinaria ya lo soporta: el dataset declara
      `cv` y `cv-short` y hoy solo se renderiza `cv-ats`.

### Por qué no hay backend

Evaluado el 2026-08-25 con la restricción de mantener el stack gratuito.

- **Keystatic: descartado.** Su doc exige un adaptador de Astro para deployar,
  más las integraciones de React y Markdoc. Es SSR y React en un repo cuya
  tesis es `output: static` y 2.4 KB de JS crítico.
- **Sanity: viable, no ahora.** El free tier sobra por tres órdenes de
  magnitud, pero su modelo ya cambió dos veces (2023 y 2025). Lo decisivo es
  otra cosa: con los datos afuera de git, **el contenido deja de pasar por los
  gates** — `validate`, las reglas 7 y 8 y `test:pdf` corren en push, no en un
  webhook. Un logro mal cargado se publicaría sin que nada lo mire.
- **La fricción real no es la falta de backend**, es que un typo cuesta tres
  PRs. Un CMS no arregla eso: lo esquiva salteándose los gates.

**Adoptarlo más adelante cuesta lo mismo que hoy:** escribir `sanity-source.ts`
y cambiar una línea en `content/source/index.ts`. Esa opción no se vence.

**Decidido que NO se hace:** dataset en inglés. Traducir un CV produce inglés
traducido, que es peor que inglés escrito.

---

## 6. Estado al cerrar

```
typecheck       0 errors        validate      Dataset válido
pnpm test      62 pass          test:pdf      10 pass
test:workflows 13 pass          test:js       11 pass
test:bundle    10 pass          test:landing   7 pass
test:servido    3 pass (contra producción)
audit:todos     9 TODOs publicados (datos que faltan, no fallas)
```

Consumo contra los techos: ver la tabla del [`README`](../README.md#límites-y-techos).

Deuda técnica: **17 entradas, 4 resueltas.** Ver [`07`](./07-deuda-tecnica.md).
