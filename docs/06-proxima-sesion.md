# 06 — Próxima sesión

Handoff del 2026-08-25, reescrito al cerrar la sesión de infraestructura. Qué
quedó a medias, qué está bloqueado y en qué orden conviene atacarlo. El estado
completo vive en [`00-indice.md`](./00-indice.md); acá está solo lo accionable.

**La infraestructura quedó cerrada.** El sitio está público en
`https://cribbnicolas.pages.dev`, el PDF se imprime a demanda, la analítica
mide, y el flujo `feature/*` → `develop` → `staging` → `main` está enforced por
rulesets y por dos workflows propios. El detalle en
[`05`](./05-deploy-y-analitica.md) y [`08`](./08-ramas-y-versionado.md).

---

## 1. Lo próximo: `pnpm run editor`

**Un editor local del dataset**, para dejar de tocar `content.es.json` a mano.
Decidido el 2026-08-25 después de evaluar Sanity y Keystatic — el razonamiento
completo está abajo, en §6.

### La forma acordada

Un comando que levanta **su propio servidor local**, fuera de Astro:

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

Precedente en el repo: `scripts/build-pdf.ts` ya levanta un servidor de 30
líneas, con el comentario *"agregar una dependencia para esto sería más
superficie de mantenimiento que el problema que resuelve"*.

### Las dos preguntas que definen el alcance

**No arrancar sin contestarlas.**

1. **¿Qué parte del dataset se edita?** Cargar `Achievement`, `Metric` y los
   `Prose` cubre el 90% de las ediciones reales. Un formulario para las seis
   superficies, los `visibility`, los `skillIds` y el grafo es bastante más
   trabajo y casi nunca se toca.
2. **¿El formulario se deriva del schema Zod, o se escribe a mano campo por
   campo?** Derivarlo es más trabajo al principio y cero mantenimiento después:
   agregar un campo al schema lo hace aparecer en el editor. Escribirlo a mano
   es al revés, y garantiza que en tres meses el editor y el schema no
   coincidan.

### Lo que el editor NO resuelve

Editar desde el celular. Se descartó a conciencia: ver §6.

---

## 2. Antes de tocar nada: verificar a ojo

Sigue pendiente de la sesión anterior y nadie lo hizo todavía.

- [ ] **El hover cruzado tarjeta ↔ mapa.** Está verificado que los ids del DOM
      coinciden 3/3 con las reglas `:has()`. Eso prueba que el CSS apunta a
      algo, no que se vea bien.
- [ ] **La inercia de la píldora.** Simulada —arrastra 19.9 px, cruza el cero
      200 ms después de frenar, rebota 3.5 px— y apagada bajo
      `prefers-reduced-motion`. Los números son correctos; la sensación hay que
      sentirla.
- [ ] **El PDF en un visor de verdad**, no solo pasando los diez tests.

No hay test que reemplace abrir el navegador. Anotado también en
[`07`](./07-deuda-tecnica.md) §13.

---

## 3. SEO y metadata — el hueco más grande hoy

Medido sobre producción el 2026-08-25. El `<head>` tiene **siete etiquetas**:
charset, viewport, title, description, canonical y dos hojas de estilo.

| Falta | Impacto |
|---|---|
| **Open Graph** (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`) | **Alto.** Pegar el link en LinkedIn o WhatsApp muestra una URL pelada, sin tarjeta. Es el canal principal de distribución de un portfolio |
| **Twitter Card** | Medio, mismo motivo |
| **Imagen social** | Alto — sin ella no hay tarjeta aunque estén las etiquetas. **No hay ni un solo asset de imagen en el repo** |
| **Favicon** | Medio. `/favicon.ico` y `/favicon.svg` dan 404: la pestaña muestra el ícono genérico |
| **`sitemap.xml`** | Bajo con dos páginas, pero `@astrojs/sitemap` lo resuelve en una línea |
| **`robots.txt` propio** | Bajo. Hoy se sirve el gestionado de Cloudflare, que son **solo comentarios**: cero directivas, cero `Sitemap:` |

Lo que **sí** está bien: `canonical` correcto desde que `SITE_URL` se aplicó,
`lang="es"`, `/cv` con `noindex` a propósito, y sin `x-robots-tag` que bloquee
la indexación de `pages.dev`.

**Ojo al agregar el `robots.txt` propio:** hay que verificar contra un deploy si
`public/robots.txt` le gana al gestionado de Cloudflare. No está probado.

### Búsqueda por IA

Acá el sitio está **mejor que el promedio**, y conviene no romperlo:

- `/llms.txt` existe y sirve el CV en markdown plano.
- `/cv.json` sirve el dataset resuelto — un agente no necesita scrapear HTML.
- JSON-LD `Person` server-rendered en la landing, que es lo que un crawler sin
  JavaScript puede leer.

Lo que falta es de descubrimiento, no de contenido: sin `sitemap.xml` ni un
`robots.txt` que lo referencie, esas tres salidas dependen de que alguien las
adivine. Y sin Open Graph, cada vez que el link se comparte se pierde el
contexto que un modelo usaría para resumirlo.

---

## 4. Datos — el hueco que solo puede llenar el autor

Nada de esto se puede hacer sin vos (invariante 4: no se inventan datos).

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

| Línea | Qué falta |
|---|---|
| 38 | Versión larga del summary, para LinkedIn y portfolio |
| 135 | `dinkum-mapbox`: volumen de datos, qué resolvía al usuario final |
| 229 | `jwd-maderas`: arquitectura, modelado en Sanity, SEO local |
| 232 | `jwd-maderas`: consultas recibidas, tiempo ahorrado por cotización |
| 258 | `mapas-distritos`: qué necesitaba resolver el usuario |
| 264 | `mapas-distritos`: volumen de datos o impacto |
| 287 | `wp-plugins`: tiempo de build antes/después, plugins entregados |
| 340 | **Nivel real de inglés** — hoy declarado sin confirmar |

*(Números de línea válidos al 2026-08-25; el teléfono salió del dataset ese día
y pueden haberse corrido unas líneas.)*

### Otros

- [ ] Links de los tres proyectos: `links: []`. La sección los renderiza solo si
      existen — es editar el dataset, no tocar código.
- [ ] **Hogarth**: confirmar `employmentType` y `start: 2023-07`.
- [ ] **Rol Freelance (2020-04 → 2022-06)**: un solo logro, con
      `skillIds: ["javascript"]`. Esos 2.2 años no conectan con ninguna otra
      tecnología, y por eso WordPress —declarada `core`— sale chica en el mapa.

---

## 5. Contenido y front

- [ ] **Casos de estudio en formato largo** ([`04`](./04-portfolio.md) §2:
      problema → decisión → resultado). Bloqueado en `problem.short` y
      `outcome.short`: faltan los dos en `mapas-distritos`, y el `outcome` de
      `jwd-maderas` y `wp-plugins`.
- [ ] **Sección Servicios** (lado freelance). `services` está vacío a propósito
      — no llenar con placeholders.
- [ ] **Sección Sobre mí.**
- [ ] **Investigación de patrones de portfolios** ([`04`](./04-portfolio.md) §6).
      Conviene **antes** de diseñar los casos de estudio, no después.
- [ ] **CV diseñado (CV-A).** La maquinaria ya lo soporta: el dataset declara
      `cv` y `cv-short` y hoy solo se renderiza `cv-ats`.

---

## 6. El backend: por qué no hay uno, y cuándo revisarlo

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

**Adoptar Sanity más adelante cuesta lo mismo que hoy:** escribir
`sanity-source.ts` y cambiar una línea en `content/source/index.ts`. Esa opción
no se vence, y por eso la decisión de hoy es barata.

**Decidido que NO se hace:** dataset en inglés. Traducir un CV produce inglés
traducido, que es peor que inglés escrito.

---

## 7. Estado al cerrar

```
typecheck       0 errors        validate      Dataset válido
pnpm test      62 pass          test:pdf      10 pass
test:workflows 13 pass          test:js       11 pass
test:bundle    10 pass          test:landing   7 pass
test:servido    3 pass (contra producción)
audit:todos     9 TODOs publicados (datos que faltan, no fallas)
```

Presupuesto: landing **11.0 KB** gzip contra un techo de 30. Camino crítico
**2.41 KB** contra un techo de 4 — subió de 2.10 al entrar Clarity.

Deuda técnica: **16 entradas, 4 resueltas.** Ver [`07`](./07-deuda-tecnica.md).
