# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven
en `content/data/` y el CV, el portfolio y los bloques de LinkedIn son **vistas**
derivadas de ellos. Sobre esa capa hay un sitio Astro estático de **una sola
página navegable**: hero, mapa, proyectos y el CV completo, con un índice de
anclas y un botón flotante que baja el PDF. `/cv` sigue existiendo pero dejó de
ser un destino — es la página desde la que se imprime el PDF, y va con `noindex`
y sin links entrantes. El sitio publica además JSON-LD `Person`, `/cv.json` y
`/llms.txt`.

El corazón de la landing es el **mapa de conocimiento**
que cruza logros, roles, proyectos y tecnologías como grafo. El tamaño de cada
tecnología sale de sus años de uso por sus conexiones; los trabajos quedan en la
corteza y las tecnologías en el núcleo. Se renderiza en el servidor como SVG y,
si el dispositivo lo aguanta, se superpone la versión en WebGL. Sin JavaScript el
mapa sigue completo, hover cruzado incluido.

**El PDF no es un archivo del build.** `/cv.pdf` lo genera una Cloudflare Pages
Function a demanda, pidiéndole a Browser Rendering que imprima nuestro propio
`/cv`, y lo cachea en el borde. Por eso `pnpm run build` es sólo `astro build` y
corre en cualquier lado. Ver [`docs/05`](./docs/05-deploy-y-analitica.md).

## Arranque

Requiere **pnpm** (`corepack enable` alcanza) y Node >= 22.12.

```bash
pnpm install
pnpm run dev          # astro dev
pnpm run build        # SOLO astro build. Sin Chromium: por eso corre en Cloudflare
pnpm run pdf:local    # imprime dist/cv.pdf con Playwright. Gate local, no el entregable
```

Verificación — **todos tienen que pasar**:

```bash
pnpm run test:workflows # los .yml de CI parsean y declaran jobs. Corre PRIMERO
pnpm run typecheck      # astro sync + tsc --noEmit + astro check
pnpm run validate       # Zod (forma) + reglas duras (coherencia)
pnpm test               # reglas que el schema no valida (visibility, locale, grafo, versión)
pnpm run test:pdf       # el PDF parsea y pasa el ATS. Necesita pdf:local, o PDF_SOURCE=<url>
pnpm run test:js        # ninguna página salvo la home envía JavaScript
pnpm run test:bundle    # home: three fuera del camino crítico y dentro del techo
pnpm run test:landing   # /cv aislada, sección CV sincronizada con el PDF, 404 propia
pnpm run test:og        # la tarjeta social no quedó vieja respecto del dataset
pnpm run test:version   # el PR sube package.json.version. Necesita: git fetch origin develop
pnpm run test:servido   # verifica el sitio PUBLICADO. Necesita SITIO=https://…
pnpm run audit:todos    # lista TODOs publicados. No bloquea
pnpm run audit:deps     # pnpm audit --audit-level high
```

Si `validate` falla, el mensaje dice qué regla se violó y cómo arreglarla.

## Límites y techos

**El código es la fuente de verdad de cada número**; esta tabla es un resumen
con lo medido el 2026-08-25.

### Presupuesto del sitio

| Recurso | Techo | Hoy | Definido en |
|---|---|---|---|
| HTML de la home | 30 KB gzip | 11.2 KB | `scripts/bundle-budget.check.ts` |
| JS crítico de la home | 4 KB gzip | 2.4 KB | ídem |
| Chunk del campo WebGL | 8 KB gzip | 2.0 KB | ídem |
| **Chunk 3D diferido** (`three`) | 150 KB gzip | **129.8 KB** | ídem |
| **Páginas del PDF** | 2 | **2** | `scripts/pdf-output.check.ts` |
| JS en cualquier página que no sea la home | 0 | 0 | `scripts/no-client-js.check.ts` |
| **Tarjeta social** (`og.jpg`) | 300 KB | **61 KB** | `scripts/og-template.ts` |

El techo de la tarjeta social no es prolijidad: **WhatsApp no llega a mostrar
la previsualización si la imagen pesa de más**, así que pasarlo significa que el
link deja de mostrar tarjeta en el canal donde más se comparte. Se regula con
`CALIDAD` en `scripts/build-og.ts`; por eso la imagen es JPEG y no PNG.

**Dos están al límite, y conviene saberlo antes de chocarlos:**

- **El PDF está en 2 de 2 páginas.** Cualquier logro, rol o sección que se sume
  al dataset lo empuja a 3 y `test:pdf` lo frena. No es un bug del test: dos
  páginas es la regla de [`docs/03`](./docs/03-cv.md) §2. Agregar contenido al
  CV implica sacar otro.
- **El chunk 3D está al 87% de su techo.** Subir de versión `three` o importar
  un módulo más puede pasarlo. El techo existe para que esa decisión sea
  explícita, no para bloquearla.

### Servicios externos, todos en plan gratuito

| Servicio | Límite | Consumo real |
|---|---|---|
| Cloudflare Pages | 500 builds/mes; banda y requests ilimitados | unos pocos por semana |
| Cloudflare Browser Rendering | 10 min de browser/día · 3 concurrentes · 1 instancia nueva cada 20 s | 3-5 s por render, caché de borde de 1 h |
| GitHub Actions | **ilimitado** — el repo es público | — |
| Microsoft Clarity | gratis, sin tope | — |
| Cloudflare Web Analytics | gratis | — |

**El límite que sí se toca es el de Browser Rendering**, y no el diario sino el
de ritmo: la cadena `develop` → `staging` → `main` son dos deploys seguidos y
cada uno pide un render en frío. Ya pasó una vez — el smoke falló con un 429 con
el sitio sano. Por eso `smoke-deploy.yml` calienta el PDF tolerando el 429 antes
de correr los tests. Detalle en [`docs/07`](./docs/07-deuda-tecnica.md) §16.

## Cómo se trabaja

`feature/*` → `develop` → `staging` → `main`. Cada PR a `develop` **sube la
versión** de `package.json`, y a `staging` y a `main` solo entra la rama de
arriba — las dos cosas las hace cumplir CI, no la disciplina. Ver
[`docs/08`](./docs/08-ramas-y-versionado.md).

## Uso desde el frontend

```ts
import { content } from "./content/source";

const cv = await content.getView("cv", "es");
const web = await content.getView("portfolio", "es");
```

El frontend **nunca** filtra por `visibility` ni calcula duraciones: recibe listas
ya resueltas por `getView()`.

## Dónde seguir

- **Qué se hace ahora y en qué orden:** [`docs/06`](./docs/06-proxima-sesion.md).
- **Deuda técnica, con cómo comprobar cada entrada:** [`docs/07`](./docs/07-deuda-tecnica.md).
- **Estado, decisiones y qué falta:** [`docs/00-indice.md`](./docs/00-indice.md).
- **Cómo trabajar en el repo (invariantes, convenciones, mapa de archivos):**
  [`CLAUDE.md`](./CLAUDE.md).
