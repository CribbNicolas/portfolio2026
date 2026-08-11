# portfolio2026

Capa de contenido del portfolio y del CV. Fuente única de verdad: los datos viven acá y el CV, el portfolio y los bloques de LinkedIn son **vistas** derivadas.

```
content/
  schema/
    content-schema.ts   → los tipos. El contrato.
    validation.ts       → Zod (forma) + reglas duras (coherencia)
  data/
    content.es.json     → tus datos. Fase 0: JSON en el repo.
  source/
    json-source.ts      → implementación de ContentSource sobre el JSON
    index.ts            → ⚠️ la única línea que cambia al migrar a Sanity
scripts/
  validate.ts           → corré esto en CI
docs/
  00-indice.md              → índice, decisiones tomadas y estado
  01-filtros-y-seleccion.md → cómo funcionan los filtros, evidencia, qué sube el puntaje
  02-branding.md            → posicionamiento, titular, About, voz
  03-cv.md                  → formato, bullets, métricas pendientes, checklist
  04-portfolio.md           → estructura, casos de estudio, capa para agentes
  CONTRATO.md               → las reglas del sistema de contenido
```

**Empezá por [`docs/00-indice.md`](./docs/00-indice.md).**

## Arranque

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run validate    # valida forma + reglas duras
```

## Uso desde el frontend

```ts
import { content } from "./content/source";

const cv = await content.getView("cv", "es");
const web = await content.getView("portfolio", "es");
const caso = await content.getProject("jwd-maderas", "es");
```

El frontend **nunca** filtra por `visibility` ni calcula duraciones. Recibe listas ya resueltas.

## Migrar a Sanity (Fase 1)

1. Escribir `content/source/sanity-source.ts` implementando `ContentSource`.
2. Cambiar una línea en `content/source/index.ts`.
3. Listo. El resto del proyecto no se entera.

## Huecos a completar

Los datos cargados son los reales que ya teníamos. Lo que falta solo lo podés poner vos:

**Métricas (lo más importante).** Ningún logro tiene `metric` todavía. Candidatos:
- `dinkum-vite` → tiempo de build antes/después
- `adsmovil-datos` → qué mejoró en la recolección: tiempo, volumen, errores
- `freelance-build` → peso del bundle o tiempo de carga antes/después
- `dinkum-mapbox` → volumen de datos o cantidad de usuarios

Si el número es estimado, marcá `confidence: "estimated"` y el generador lo renderiza con "~".

**Datos a confirmar:**
- `hogarth.employmentType` → lo puse como `contract` con `concurrent: true` porque se superpone con Adsmovil. Si fue otra cosa, corregilo: la regla 2 lo valida.
- `hogarth.start` → 2023-07 (el que figura en LinkedIn). Tu CV actual dice 2022-07, que no cierra con los 7 meses.
- `languages.en.level` → puse B1 por "Intermedio". Ajustá si corresponde.
- `identity.careerStart` → puse 2020-04, el inicio de tu experiencia listada. Es la decisión que resuelve las tres antigüedades distintas.
- Fechas de inicio de `mapas-distritos` y `wp-plugins` → puse aproximados.

**Textos marcados como TODO:** el `summary.long`, y los `problem`/`outcome` de los proyectos.

## Nota

Al cargar los datos, el validador encontró que `Git` estaba declarada como `core` sin ningún logro que la respaldara. La bajé a `working`. Eso es exactamente para lo que sirve la regla 3.
