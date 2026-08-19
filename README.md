# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven
en `content/data/` y el CV, el portfolio y los bloques de LinkedIn son **vistas**
derivadas de ellos. Sobre esa capa hay un sitio Astro estático que renderiza la
superficie `cv-ats` como `/cv` en HTML, imprime `dist/cv.pdf` con Playwright, y
publica JSON-LD `Person`, `/cv.json` y `/llms.txt`.

## Arranque

```bash
npm install
npm run dev          # astro dev
npm run build        # astro build + genera dist/cv.pdf
npm run typecheck    # astro sync + tsc --noEmit + astro check
npm run validate     # Zod (forma) + reglas duras (coherencia)
npm test             # reglas que el schema no valida (visibility, locale)
npm run test:pdf     # verifica dist/cv.pdf ya buildeado (parseo, ATS)
npm run audit:todos  # chequea que no queden TODOs sin resolver en el dataset
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
