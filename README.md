# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven
en `content/data/` y el CV, el portfolio y los bloques de LinkedIn son **vistas**
derivadas de ellos. Todavía no hay frontend.

## Arranque

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run validate    # Zod (forma) + reglas duras (coherencia)
npm test            # reglas que el schema no valida (visibility, locale)
```

Los tres tienen que pasar. Si `validate` falla, el mensaje dice qué regla se violó
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
