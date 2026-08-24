# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven
en `content/data/` y el CV, el portfolio y los bloques de LinkedIn son **vistas**
derivadas de ellos. Sobre esa capa hay un sitio Astro estático que renderiza la
superficie `cv-ats` como `/cv` en HTML, imprime `dist/cv.pdf` con Playwright, y
publica JSON-LD `Person`, `/cv.json` y `/llms.txt`.

La **home** es la segunda vista de los mismos datos: un **mapa de conocimiento**
que cruza logros, roles, proyectos y tecnologías como grafo. El tamaño de cada
tecnología sale de sus años de uso por sus conexiones; los trabajos quedan en la
corteza y las tecnologías en el núcleo. Se renderiza en el servidor como SVG y,
si el dispositivo lo aguanta, se superpone la versión en WebGL. Sin JavaScript el
mapa sigue completo, hover cruzado incluido.

## Arranque

Requiere **pnpm** (`corepack enable` alcanza) y Node >= 22.12.

```bash
pnpm install
pnpm run dev          # astro dev
pnpm run build        # astro build + genera dist/cv.pdf
pnpm run typecheck    # astro sync + tsc --noEmit + astro check
pnpm run validate     # Zod (forma) + reglas duras (coherencia)
pnpm test             # reglas que el schema no valida (visibility, locale, grafo)
pnpm run test:pdf     # verifica dist/cv.pdf ya buildeado (parseo, ATS)
pnpm run test:js      # ninguna página salvo la home envía JavaScript
pnpm run test:bundle  # home: three fuera del camino crítico y dentro del techo
pnpm run audit:todos  # chequea que no queden TODOs sin resolver en el dataset
```

Todos tienen que pasar. Si `validate` falla, el mensaje dice qué regla se violó
y cómo arreglarla.

## Uso desde el frontend

```ts
import { content } from "./content/source";

const cv = await content.getView("cv", "es");
const web = await content.getView("portfolio", "es");
```

El frontend **nunca** filtra por `visibility` ni calcula duraciones: recibe listas
ya resueltas por `getView()`.

## Dónde seguir

- **Estado, decisiones y qué falta:** [`docs/00-indice.md`](./docs/00-indice.md).
- **Cómo trabajar en el repo (invariantes, convenciones, mapa de archivos):**
  [`CLAUDE.md`](./CLAUDE.md).
