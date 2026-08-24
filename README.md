# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven
en `content/data/` y el CV, el portfolio y los bloques de LinkedIn son **vistas**
derivadas de ellos. Sobre esa capa hay un sitio Astro estático de **una sola
página navegable**: hero, mapa, proyectos y el CV completo, con un índice de
anclas y un botón flotante que baja el PDF. `/cv` sigue existiendo pero dejó de
ser un destino — es la fuente desde la que Playwright imprime `dist/cv.pdf`, y
va con `noindex` y sin links entrantes. El sitio publica además JSON-LD
`Person`, `/cv.json` y `/llms.txt`.

El corazón de la landing es el **mapa de conocimiento**
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
pnpm run test:landing # /cv aislada y la sección CV sincronizada con el PDF
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
