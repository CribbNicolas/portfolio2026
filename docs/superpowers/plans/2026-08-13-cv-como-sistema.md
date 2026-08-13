# El CV como sistema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un sitio Astro estático que sirve el CV en HTML, genera `cv.pdf` con texto seleccionable y verificado por CI, y publica la capa legible por máquinas — todo derivado del dataset que ya existe.

**Architecture:** Astro `output: 'static'` en la raíz del repo existente. La capa `content/` no se mueve: se le agregan funciones puras de formato (el contrato de salida) y todo `src/` consume `getView()` a través del alias `@content`. El PDF sale de la misma página `/cv` navegada por Playwright, así HTML y PDF no pueden desincronizarse.

**Tech Stack:** Astro 6, TypeScript, Playwright (Chromium), pdfjs-dist, @fontsource/inter, Zod (ya presente), `node:test` vía tsx.

**Spec:** `docs/superpowers/specs/2026-08-13-cv-como-sistema-design.md`

## Global Constraints

- **ESM en todo el repo** (`"type": "module"`). Imports sin extensión, `import type` para tipos.
- **Comentarios en español, explican el PORQUÉ.** Banners de sección `// ---`. Cuando algo hace cumplir una regla del contrato, se nombra por número: `// Regla 4: ...`.
- **Nada en `src/` filtra por `visibility` ni por `priority`.** Toda esa lógica ya vive en `content/schema/resolve-view.ts`. Un `.filter(v => v.priority ...)` en un componente es un bug.
- **Nada en `src/` importa de `content/source/json-source`.** El único punto de entrada es `content/source/index.ts`, expuesto como el alias `@content`.
- **Ninguna duración ni antigüedad se escribe a mano.** Se deriva vía `content/schema/dates.ts` y se formatea vía `content/schema/format.ts`.
- **Nunca inventar métricas, números, fechas ni logros.** El dataset se toca solo donde este plan lo dice explícitamente (Task 7).
- **Fechas visibles en formato `MM/AAAA`** (`docs/03-cv.md` §2). Presente = `"Actualidad"`.
- **El CV es de UNA columna.** Prohibido `display: flex`, `display: grid`, `<table>` y `position: absolute` dentro de `src/styles/cv.css` y de los componentes de `src/components/cv/`. El orden del DOM es el orden de lectura que extrae el parser.
- **Node 20** (lo que usa el workflow actual).
- Los tres comandos existentes (`npm run typecheck`, `npm run validate`, `npm test`) tienen que seguir pasando después de cada task.

---

## File Structure

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `content/schema/format-metric.ts` | Regla 4: `Metric` → texto. Único lugar donde una métrica se vuelve string |
| `content/schema/format.ts` | Duraciones, rangos de fecha, títulos de rol, antigüedad |
| `content/schema/format.test.ts` | Tests de los dos anteriores |
| `astro.config.mjs` | `site`, `output: 'static'` |
| `src/layouts/Base.astro` | `<html lang="es">`, head, slot para JSON-LD |
| `src/pages/index.astro` | Home mínima. NO es el portfolio |
| `src/pages/cv.astro` | El CV en HTML. Única fuente del layout del PDF |
| `src/components/cv/Header.astro` | `<h1>` + contacto |
| `src/components/cv/Section.astro` | `<h2>` + slot |
| `src/components/cv/RoleBlock.astro` | Un rol con sus bullets |
| `src/components/cv/SkillList.astro` | Skills agrupadas por categoría |
| `src/styles/cv.css` | Layout de pantalla y de impresión (`@page`) |
| `src/lib/jsonld.ts` | `ContentView` → `schema.org/Person` |
| `src/pages/cv.json.ts` | Endpoint `public-api` |
| `src/pages/llms.txt.ts` | Endpoint markdown |
| `scripts/render-pdf.ts` | `renderPdf({ url, out })`. La costura hacia on-demand |
| `scripts/build-pdf.ts` | Sirve `dist/`, llama a `renderPdf`, escribe `dist/cv.pdf` |
| `scripts/pdf-output.check.ts` | Verificación del PDF generado (no es `*.test.ts` a propósito) |
| `scripts/audit-todos.ts` | Reporte no bloqueante de TODOs publicados |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `package.json` | Dependencias y scripts `dev`/`build`/`preview`/`audit:todos`/`test:pdf` |
| `tsconfig.json` | `extends` de Astro, `paths` para `@content`, `include` de `src/` |
| `content/source/index.ts` | Re-exporta los formatters. Sigue siendo el único punto de entrada |
| `content/source/content-source.test.ts:66-77` | Se activa el test en `todo` de la regla 4 |
| `content/data/content.es.json:26` | Sale `cv-ats` de `publishPhoneOn` |
| `.github/workflows/content-validation.yml` | Steps de Chromium, build, verificación del PDF y auditoría |
| `.gitignore` | `dist/`, `.astro/` |
| `CLAUDE.md`, `docs/00-indice.md` | Estado real al cerrar |

---

### Task 1: El contrato de salida (formatters)

Cierra el hueco de la regla 4, que hoy no tiene dueño. Es la base de todo lo demás: los componentes de las tasks siguientes no arman texto, llaman a esto.

**Files:**
- Create: `content/schema/format-metric.ts`
- Create: `content/schema/format.ts`
- Create: `content/schema/format.test.ts`
- Modify: `content/source/content-source.test.ts:66-77`
- Modify: `content/source/index.ts`

**Interfaces:**
- Consumes: `Metric`, `Role`, `YearMonth` de `content/schema/content-schema.ts`; `yearsOfExperience` de `content/schema/dates.ts`.
- Produces:
  - `formatMetric(m: Metric): string | null`
  - `formatYearMonth(ym: YearMonth): string`
  - `formatDateRange(start: YearMonth, end: YearMonth | null): string`
  - `formatDuration(months: number): string`
  - `formatRoleTitle(role: Role): string`
  - `formatSeniority(years: number): string`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `content/schema/format.test.ts`:

```ts
/**
 * Tests del contrato de salida.
 *
 * Estas funciones son el único lugar donde un dato se convierte en texto
 * visible. La regla 4 (estimados con "~") y la regla 1 (duraciones derivadas)
 * se hacen cumplir acá o no se hacen cumplir en ningún lado.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMetric } from "./format-metric";
import {
  formatDateRange,
  formatDuration,
  formatRoleTitle,
  formatSeniority,
  formatYearMonth,
} from "./format";
import type { Role } from "./content-schema";

test("regla 4: una métrica measured no lleva ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "-40%", confidence: "measured" });
  assert.equal(out, "-40%");
});

test("regla 4: una métrica estimated lleva ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" });
  assert.equal(out, "~40%");
});

test("regla 4: before/after estimado marca los DOS extremos", () => {
  const out = formatMetric({
    label: "tiempo de build",
    before: "90 s",
    after: "12 s",
    confidence: "estimated",
  });
  assert.equal(out, "~90 s → ~12 s");
});

test("una métrica sin números devuelve null, no un string vacío", () => {
  // El llamador tiene que poder omitir el fragmento entero. Un "" se cuela
  // silenciosamente en un template y deja un guion suelto en el CV.
  const out = formatMetric({ label: "algo", confidence: "measured" });
  assert.equal(out, null);
});

test("formatYearMonth usa MM/AAAA (docs/03 §2)", () => {
  assert.equal(formatYearMonth("2023-07"), "07/2023");
});

test("formatDateRange: end null es Actualidad, no una fecha inventada", () => {
  assert.equal(formatDateRange("2024-09", null), "09/2024 — Actualidad");
  assert.equal(formatDateRange("2022-06", "2024-09"), "06/2022 — 09/2024");
});

test("formatDuration: años y meses en palabras, singular incluido", () => {
  assert.equal(formatDuration(23), "1 año 11 meses");
  assert.equal(formatDuration(12), "1 año");
  assert.equal(formatDuration(5), "5 meses");
  assert.equal(formatDuration(1), "1 mes");
});

test("regla 2: un rol concurrent se declara en el título", () => {
  const role = {
    id: "hogarth",
    company: "Hogarth",
    title: "Frontend Developer",
    employmentType: "contract",
    concurrent: true,
    workMode: "remote",
    start: "2023-07",
    end: "2024-01",
    context: { short: "x" },
    visibility: { priority: 2 },
  } as Role;
  assert.equal(formatRoleTitle(role), "Frontend Developer (en paralelo)");
});

test("formatRoleTitle prefiere displayTitle cuando existe", () => {
  const role = {
    id: "dinkum",
    company: "Dinkum",
    title: "Desarrollador de front-end",
    displayTitle: "Desarrollador Full Stack",
    employmentType: "full-time",
    workMode: "remote",
    start: "2024-09",
    end: null,
    context: { short: "x" },
    visibility: { priority: 1 },
  } as Role;
  assert.equal(formatRoleTitle(role), "Desarrollador Full Stack");
});

test("formatSeniority no escribe el número a mano", () => {
  assert.equal(formatSeniority(6), "6+ años");
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx tsx --test content/schema/format.test.ts`
Expected: FAIL — `Cannot find module './format-metric'`

- [ ] **Step 3: Implementar `format-metric.ts`**

```ts
/**
 * Regla 4 del contrato: una `Metric` con `confidence: "estimated"` NUNCA se
 * presenta como medición.
 *
 * Este archivo es el único lugar del sistema donde una `Metric` se vuelve
 * texto. Si aparece un `${m.delta}` en un componente, la regla se bifurcó y
 * dejó de valer. Igual que `dates.ts` es el archivo de la regla 1, este es el
 * de la regla 4.
 */

import type { Metric } from "./content-schema";

/** Marca de estimación. El contrato admite "~" o "aprox."; usamos "~" por espacio. */
const APROX = "~";

/**
 * `Metric` → texto listo para renderizar, o `null` si no hay ningún número.
 *
 * Devuelve `null` y no `""` a propósito: el llamador tiene que poder omitir el
 * fragmento completo. Un string vacío se cuela en un template y deja un guion
 * colgando en el CV.
 *
 * `before`/`after` gana sobre `delta` porque mostrar el movimiento completo es
 * más defendible en entrevista que un porcentaje suelto.
 */
export function formatMetric(m: Metric): string | null {
  const aprox = m.confidence === "estimated" ? APROX : "";

  if (m.before && m.after) return `${aprox}${m.before} → ${aprox}${m.after}`;
  if (m.delta) return `${aprox}${m.delta}`;
  return null;
}
```

- [ ] **Step 4: Implementar `format.ts`**

```ts
/**
 * Texto derivado de datos. La otra mitad del contrato de salida.
 *
 * Regla 1: ninguna duración ni antigüedad se escribe a mano. Los componentes
 * reciben strings ya formateados; un `${meses} meses` dentro de un `.astro`
 * significa que esta capa se bifurcó.
 *
 * El formato de fecha es `MM/AAAA` porque lo pide `docs/03-cv.md` §2:
 * consistente, sin nombres de mes que cambien entre superficies.
 */

import type { Role, YearMonth } from "./content-schema";
import { yearsOfExperience } from "./dates";

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** "2023-07" → "07/2023". */
export function formatYearMonth(ym: YearMonth): string {
  const [year, month] = ym.split("-");
  return `${month.padStart(2, "0")}/${year}`;
}

/**
 * Rango de un rol. `end === null` significa "sigue vigente", no "falta el dato":
 * por eso rinde "Actualidad" y no un vacío.
 */
export function formatDateRange(start: YearMonth, end: YearMonth | null): string {
  return `${formatYearMonth(start)} — ${end ? formatYearMonth(end) : "Actualidad"}`;
}

/**
 * Meses → "1 año 11 meses". En palabras y no abreviado porque lo lee un humano
 * en 10 segundos y también un LLM que cruza fechas contra los rangos.
 */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;

  const partYears = years === 1 ? "1 año" : `${years} años`;
  const partMonths = rest === 1 ? "1 mes" : `${rest} meses`;

  if (years === 0) return partMonths;
  if (rest === 0) return partYears;
  return `${partYears} ${partMonths}`;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Regla 2: dos roles solapados sin aclaración son una bandera roja automática,
 * tanto para la capa de IA como para el humano. Si el dato dice `concurrent`,
 * el título lo declara.
 */
export function formatRoleTitle(role: Role): string {
  const title = role.displayTitle ?? role.title;
  return role.concurrent ? `${title} (en paralelo)` : title;
}

/**
 * Regla 1: el número viene de `ContentView.yearsOfExperience`, que a su vez sale
 * de `careerStart`. Esta función solo le pone las palabras alrededor.
 */
export function formatSeniority(years: number): string {
  return `${years}+ años`;
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx tsx --test content/schema/format.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Activar el test en `todo` de la regla 4**

En `content/source/content-source.test.ts`, reemplazar el bloque completo de las líneas 66-77 por:

```ts
// Regla 4: una Metric `estimated` se renderiza con "~" o "aprox.".
// Este test estuvo en `todo` hasta que existió `formatMetric`. La cobertura
// completa vive en `content/schema/format.test.ts`; acá queda el caso mínimo
// porque este archivo es el que documenta las reglas que el schema no valida.
test("regla 4: Metric estimated se renderiza con ~", () => {
  const out = formatMetric({ label: "tiempo de build", delta: "40%", confidence: "estimated" });
  assert.match(String(out), /~|aprox\./);
});
```

Y agregar el import junto a los que ya están arriba del archivo:

```ts
import { formatMetric } from "../schema/format-metric";
```

- [ ] **Step 7: Exponer los formatters desde el único punto de entrada**

En `content/source/index.ts`, después del `export * from "../schema/content-schema";` existente:

```ts
// El contrato de salida viaja con el contenido: quien consume datos también
// necesita convertirlos en texto sin reimplementar las reglas 1, 2 y 4.
// Así `src/` importa TODO de un solo lugar y el invariante 2 sigue siendo cierto.
export * from "../schema/format";
export * from "../schema/format-metric";
```

- [ ] **Step 8: Correr la suite completa**

Run: `npm run typecheck && npm run validate && npm test`
Expected: los tres PASS. En `npm test` ya no debe aparecer ningún test marcado como `todo`.

- [ ] **Step 9: Commit**

```bash
git add content/schema/format.ts content/schema/format-metric.ts content/schema/format.test.ts content/source/index.ts content/source/content-source.test.ts
git commit -m "feat(content): contrato de salida - formatMetric cierra la regla 4"
```

---

### Task 2: Scaffold de Astro y la costura `@content`

Deja el proyecto conectado punta a punta: Astro construye una página que muestra datos reales traídos por `getView()`. Sin CV todavía.

**Files:**
- Create: `astro.config.mjs`
- Create: `src/layouts/Base.astro`
- Create: `src/pages/index.astro`
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `content` (instancia de `ContentSource`) y `formatSeniority` desde `@content`.
- Produces: alias `@content`, `Base.astro` con props `{ title: string; description: string }` y un slot nombrado `head`.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install astro@^6
npm install -D @astrojs/check
```

- [ ] **Step 2: Crear `astro.config.mjs`**

```js
import { defineConfig } from "astro/config";

// `site` tiene que ser absoluta: el JSON-LD y el canonical la necesitan, y los
// crawlers no resuelven rutas relativas. El TLD .invalid está reservado por RFC
// 2606, así que si alguien deployea sin definir SITE_URL, rompe visiblemente en
// vez de publicar una URL equivocada que parece buena.
const SITE = process.env.SITE_URL ?? "https://portfolio.invalid";

export default defineConfig({
  site: SITE,
  output: "static",
  build: { format: "directory" },
});
```

- [ ] **Step 3: Actualizar `tsconfig.json`**

Reemplazar el archivo completo por:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@content": ["./content/source/index.ts"]
    }
  },
  "include": ["content/**/*", "scripts/**/*", "src/**/*", ".astro/types.d.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Astro lee `paths` de acá y configura el alias de Vite solo. No hace falta declararlo dos veces.

- [ ] **Step 4: Actualizar los scripts de `package.json`**

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build && tsx scripts/build-pdf.ts",
  "preview": "astro preview",
  "typecheck": "astro sync && tsc --noEmit && astro check",
  "validate": "tsx scripts/validate.ts",
  "test": "tsx --test",
  "test:pdf": "tsx --test scripts/pdf-output.check.ts",
  "audit:todos": "tsx scripts/audit-todos.ts"
}
```

`astro sync` va primero porque genera `.astro/types.d.ts`, sin el cual `astro check` falla en un clone limpio.

- [ ] **Step 5: Agregar `dist/` y `.astro/` a `.gitignore`**

Si el archivo no existe, crearlo con `node_modules/` también.

```
node_modules/
dist/
.astro/
```

- [ ] **Step 6: Crear `src/layouts/Base.astro`**

```astro
---
/**
 * Layout base. Su única responsabilidad es el `<head>`.
 *
 * El slot `head` existe para que cada página inyecte su JSON-LD server-rendered:
 * los crawlers no ejecutan JS, así que tiene que salir en el HTML del server
 * (docs/04 §3).
 */
interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
---

<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 7: Crear `src/pages/index.astro`**

```astro
---
/**
 * Home mínima. NO es el portfolio: eso es otro slice y depende de una
 * investigación de diseño que todavía no se hizo (docs/04 §6).
 *
 * Existe para dos cosas: que la URL raíz no sea un 404, y que el PDF tenga
 * de dónde descargarse.
 */
import Base from "../layouts/Base.astro";
import { content, formatSeniority } from "@content";

const view = await content.getView("public-api", "es");
const { identity } = view;
---

<Base
  title={`${identity.fullName} — ${identity.searchTitle}`}
  description={identity.summary.short}
>
  <main>
    <h1>{identity.fullName}</h1>
    <p>{identity.searchTitle} · {formatSeniority(view.yearsOfExperience)}</p>
    <p>{identity.tagline.short}</p>

    <ul>
      <li><a href="/cv">Ver el CV</a></li>
      <li>
        <a href="/cv.pdf" download="Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf">
          Descargar el CV en PDF
        </a>
      </li>
      {identity.links.map((link) => (
        <li><a href={link.url} rel="me noopener">{link.label}</a></li>
      ))}
    </ul>
  </main>
</Base>
```

El atributo `download` es lo que hace cumplir el nombre de archivo que pide `docs/03` §2 sin ensuciar la URL.

- [ ] **Step 8: Verificar que la costura funciona de punta a punta**

```bash
npx astro build
```
Expected: build sin errores, `dist/index.html` creado.

```bash
node --input-type=commonjs -e "const h=require('fs').readFileSync('dist/index.html','utf8'); if(!h.includes('Nicolás Agustín Cribb Barbaro')) { console.error('FALLO: el nombre del dataset no llegó al HTML'); process.exit(1) } console.log('OK: dato real renderizado')"
```
Expected: `OK: dato real renderizado`

`--input-type=commonjs` es necesario porque el repo es `"type": "module"` y estas
verificaciones usan `require`.

Si esto pasa, `getView()` → Astro → HTML está conectado.

- [ ] **Step 9: Verificar que no se rompió nada**

Run: `npm run typecheck && npm run validate && npm test`
Expected: los tres PASS.

- [ ] **Step 10: Commit**

```bash
git add astro.config.mjs tsconfig.json package.json package-lock.json .gitignore src/
git commit -m "feat(web): scaffold de Astro consumiendo getView via alias @content"
```

---

### Task 3: `/cv` — el CV en HTML

La página que después imprime el PDF. Todas las restricciones de la capa 1 se aplican acá.

**Files:**
- Create: `src/styles/cv.css`
- Create: `src/components/cv/Section.astro`
- Create: `src/components/cv/Header.astro`
- Create: `src/components/cv/RoleBlock.astro`
- Create: `src/components/cv/SkillList.astro`
- Create: `src/pages/cv.astro`
- Modify: `package.json` (dependencia de la fuente)

**Interfaces:**
- Consumes: `content`, `formatDateRange`, `formatDuration`, `formatMetric`, `formatRoleTitle` desde `@content`; `Base.astro` de la Task 2.
- Produces: la ruta `/cv` (`dist/cv/index.html`), que la Task 4 navega para imprimir.

- [ ] **Step 1: Instalar la fuente**

```bash
npm install @fontsource/inter
```

Self-hosteada a propósito: si el PDF depende de fuentes del sistema, el que sale en Windows y el que sale en el Ubuntu de CI no coinciden.

- [ ] **Step 2: Crear `src/styles/cv.css`**

```css
/*
 * Layout del CV. UNA SOLA COLUMNA.
 *
 * El orden del DOM es el orden en que el parser extrae el texto (docs/01 §1,
 * capa 1: "si el parseo falla, nada de lo que sigue importa"). Por eso acá no
 * hay flex, ni grid, ni tablas, ni position: absolute. La estética se hace con
 * tipografía, color y espaciado, que no mueven el orden de lectura.
 *
 * docs/01 §3 desarma el mito de que el diseño rompe el parseo: lo que lo rompe
 * es la estructura. Este archivo respeta la estructura y se toma la estética.
 */

@page {
  size: A4;
  margin: 16mm 15mm;
}

:root {
  --tinta: #14181f;
  --tinta-suave: #4a5261;
  --acento: #1f4fd8;
  --linea: #d5dae3;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #fff;
  color: var(--tinta);
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  /* Las ligaduras (fi, fl) se extraen como un glifo solo y ensucian el texto
     que lee el parser. Se apagan a propósito, no por estética. */
  font-variant-ligatures: none;
  font-size: 10.5pt;
  line-height: 1.45;
}

.cv {
  max-width: 190mm;
  margin: 0 auto;
  padding: 14mm;
}

.cv__name {
  font-size: 21pt;
  line-height: 1.15;
  margin: 0 0 1mm;
}

.cv__title {
  font-size: 12pt;
  font-weight: 600;
  color: var(--acento);
  margin: 0 0 2mm;
}

.cv__contact {
  color: var(--tinta-suave);
  margin: 0 0 2mm;
}

.cv__contact a {
  color: inherit;
}

.section {
  margin-top: 7mm;
}

.section__title {
  font-size: 10.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1px solid var(--linea);
  padding-bottom: 1.5mm;
  margin: 0 0 3mm;
}

.role {
  margin-bottom: 5mm;
  /* Un rol partido entre dos páginas se lee como dos trabajos distintos. */
  break-inside: avoid;
}

.role__title {
  font-size: 11pt;
  font-weight: 700;
  margin: 0;
}

.role__meta,
.role__context {
  color: var(--tinta-suave);
  margin: 0.5mm 0 0;
}

.role__bullets {
  margin: 2mm 0 0;
  padding-left: 5mm;
}

.role__bullets li {
  margin-bottom: 1.5mm;
}

.skill-group {
  margin: 0 0 1.5mm;
}

.skill-group__label {
  font-weight: 600;
}

.entry {
  margin-bottom: 2.5mm;
  break-inside: avoid;
}

@media screen {
  body {
    background: #eef0f4;
    padding: 8mm 0;
  }

  .cv {
    background: #fff;
    box-shadow: 0 1px 12px rgb(0 0 0 / 0.08);
  }
}
```

- [ ] **Step 3: Crear `src/components/cv/Section.astro`**

```astro
---
/**
 * Sección del CV. Los nombres los pone quien la usa, y tienen que ser los
 * estándar de docs/03 §2 (`Perfil`, `Habilidades técnicas`, ...): un parser
 * mapea esos títulos a campos, y "Mi stack" no mapea a nada.
 */
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<section class="section">
  <h2 class="section__title">{title}</h2>
  <slot />
</section>
```

- [ ] **Step 4: Crear `src/components/cv/Header.astro`**

```astro
---
/**
 * Encabezado del CV. Un solo `<h1>` con nombre y `searchTitle` —el título
 * buscable, no el de marca (docs/CONTRATO §3).
 *
 * El contacto sale en texto plano con etiquetas escritas ("Email:"), no con
 * íconos: un ícono no se extrae y el dato queda huérfano.
 */
import type { Identity } from "@content";

interface Props {
  identity: Identity;
}

const { identity } = Astro.props;
const { city, region, country } = identity.location;
---

<header>
  <h1 class="cv__name">{identity.fullName}</h1>
  <p class="cv__title">{identity.searchTitle}</p>
  <p class="cv__contact">
    {city}, {region}, {country} · Email: <a href={`mailto:${identity.contact.email}`}>{identity.contact.email}</a>
    {identity.contact.phone && <> · Tel: {identity.contact.phone}</>}
  </p>
  <p class="cv__contact">
    {identity.links.map((link, i) => (
      <>
        {i > 0 && " · "}
        {link.label}: <a href={link.url}>{link.url}</a>
      </>
    ))}
  </p>
</header>
```

El teléfono se renderiza solo si `resolveView` lo dejó pasar (regla 8). El componente no decide: pregunta si el dato está.

- [ ] **Step 5: Crear `src/components/cv/RoleBlock.astro`**

```astro
---
/**
 * Un rol con sus bullets.
 *
 * Ni las fechas ni la duración se escriben acá: vienen de `format.ts`
 * (regla 1). El título pasa por `formatRoleTitle` porque es lo que declara un
 * rol `concurrent` y evita la bandera roja de la regla 2.
 */
import type { ContentView } from "@content";
import { formatDateRange, formatDuration, formatMetric, formatRoleTitle } from "@content";

interface Props {
  role: ContentView["experience"][number];
}

const { role } = Astro.props;
const company = role.clientDescription
  ? `${role.company} — ${role.clientDescription}`
  : role.company;
---

<article class="role">
  <h3 class="role__title">{formatRoleTitle(role)} · {company}</h3>
  <p class="role__meta">
    {formatDateRange(role.start, role.end)} · {formatDuration(role.durationMonths)}
    {role.location && <> · {role.location}</>}
  </p>
  <p class="role__context">{role.context.short}</p>

  {role.achievements.length > 0 && (
    <ul class="role__bullets">
      {role.achievements.map((a) => {
        const metric = a.metric ? formatMetric(a.metric) : null;
        return (
          <li>
            {a.text.short}
            {metric && <> — <strong>{metric}</strong></>}
          </li>
        );
      })}
    </ul>
  )}
</article>
```

- [ ] **Step 6: Crear `src/components/cv/SkillList.astro`**

```astro
---
/**
 * Skills agrupadas por categoría, en texto corrido separado por comas.
 *
 * Sin barras de progreso ni puntos de nivel: ningún parser los lee y a un
 * técnico le generan desconfianza (docs/03 §2 y CONTRATO §4).
 *
 * Se imprime `Skill.name` canónico y NUNCA los `aliases`: repetir variantes del
 * mismo término BAJA el score en matchers semánticos (docs/01 §3). Los aliases
 * son dato para el generador por-aviso, no texto del CV.
 */
import type { ContentView, SkillCategory } from "@content";

interface Props {
  skills: ContentView["skills"];
}

const { skills } = Astro.props;

// Orden y etiquetas de las categorías. El orden es editorial: primero lo que
// más se busca en un aviso. Las categorías vacías no se imprimen.
const GRUPOS: Array<[SkillCategory, string]> = [
  ["language", "Lenguajes"],
  ["frontend", "Frontend"],
  ["backend", "Backend"],
  ["data", "Datos"],
  ["cms", "CMS"],
  ["testing", "Testing"],
  ["infra", "Infraestructura"],
  ["tooling", "Herramientas"],
  ["practice", "Prácticas"],
];

const grupos = GRUPOS
  .map(([key, label]) => [label, skills[key]] as const)
  .filter(([, list]) => list.length > 0);
---

{grupos.map(([label, list]) => (
  <p class="skill-group">
    <span class="skill-group__label">{label}:</span>{" "}
    {list.map((s) => s.name).join(", ")}
  </p>
))}
```

- [ ] **Step 7: Crear `src/pages/cv.astro`**

```astro
---
/**
 * El CV en HTML. De esta misma página sale el PDF (scripts/build-pdf.ts), así
 * que HTML y PDF no se pueden desincronizar: hay un solo layout.
 *
 * Superficie `cv-ats`. Por ahora es la única que se renderiza; agregar un
 * `cv` diseñado más adelante es agregar otra página que pida otra superficie,
 * sin tocar nada de esto.
 *
 * Dos cosas NO se renderizan a propósito:
 *  - `LanguageSkill.note`: hoy contiene un TODO y `resolveView` no filtra
 *    `languages`. Si se imprimiera, el TODO saldría en el PDF.
 *  - `Project.outcome`: dos de los tres proyectos tienen el outcome en TODO, y
 *    los proyectos ya viven en el portfolio. El CV no lleva sección de proyectos.
 */
import Base from "../layouts/Base.astro";
import Header from "../components/cv/Header.astro";
import Section from "../components/cv/Section.astro";
import RoleBlock from "../components/cv/RoleBlock.astro";
import SkillList from "../components/cv/SkillList.astro";
import { content, formatDateRange } from "@content";

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "../styles/cv.css";

const view = await content.getView("cv-ats", "es");
const { identity } = view;
---

<Base
  title={`CV — ${identity.fullName}, ${identity.searchTitle}`}
  description={identity.summary.short}
>
  <main class="cv">
    <Header identity={identity} />

    <Section title="Perfil">
      <p>{identity.summary.short}</p>
    </Section>

    <Section title="Habilidades técnicas">
      <SkillList skills={view.skills} />
    </Section>

    <Section title="Experiencia">
      {view.experience.map((role) => <RoleBlock role={role} />)}
    </Section>

    <Section title="Educación">
      {view.education.map((e) => (
        <div class="entry">
          <p class="role__title">{e.degree}{e.field && <> — {e.field}</>}</p>
          <p class="role__meta">
            {e.institution}
            {e.end && <> · {formatDateRange(e.start ?? e.end, e.end)}</>}
            {e.status === "partial" && <> · Cursado parcial</>}
            {e.status === "in-progress" && <> · En curso</>}
          </p>
        </div>
      ))}
    </Section>

    <Section title="Idiomas">
      {view.languages.map((l) => (
        <p class="skill-group">
          <span class="skill-group__label">{l.name}:</span>{" "}
          {l.level === "native" ? "Nativo" : l.level}
        </p>
      ))}
    </Section>
  </main>
</Base>
```

- [ ] **Step 8: Verificar el HTML generado**

```bash
npx astro build
```
Expected: build OK, `dist/cv/index.html` creado.

```bash
node --input-type=commonjs -e "const fs=require('fs'),p=require('path'); const walk=d=>fs.readdirSync(d).flatMap(e=>{const r=p.join(d,e);return fs.statSync(r).isDirectory()?walk(r):[r]}); const h=fs.readFileSync('dist/cv/index.html','utf8'); const css=walk('dist').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(f,'utf8')).join('\n'); const fallos=[]; if(h.includes('TODO')) fallos.push('hay un TODO en el HTML del CV'); if(!h.includes('Habilidades técnicas')) fallos.push('falta la seccion estandar'); if(/display:\s*(flex|grid)/.test(css)) fallos.push('hay flex o grid en el CSS: rompe el orden de lectura'); if(fallos.length){console.error(fallos.join('\n'));process.exit(1)} console.log('OK: CV en HTML sin TODOs y de una columna')"
```
Expected: `OK: CV en HTML sin TODOs y de una columna`

El chequeo de `flex`/`grid` va contra el **CSS compilado**, no contra el HTML: los
estilos viven en `dist/_astro/*.css`, así que mirar el HTML no probaría nada.

- [ ] **Step 9: Revisar a ojo**

Run: `npm run dev` y abrir `http://localhost:4321/cv`
Expected: una columna, secciones en orden `Perfil` → `Habilidades técnicas` → `Experiencia` → `Educación` → `Idiomas`, sin teléfono duplicado ni texto cortado. Cerrar con Ctrl-C.

- [ ] **Step 10: Verificar que no se rompió nada y commitear**

```bash
npm run typecheck && npm run validate && npm test
git add src/ package.json package-lock.json
git commit -m "feat(cv): pagina /cv en HTML, una columna, secciones estandar"
```

---

### Task 4: El PDF y su verificación

El artefacto que se sube a los portales, más el test que convierte "pasa el ATS" en algo verificable.

**Files:**
- Create: `scripts/render-pdf.ts`
- Create: `scripts/build-pdf.ts`
- Create: `scripts/pdf-output.check.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: la ruta `/cv` de la Task 3; `content` desde `content/source/index`.
- Produces:
  - `renderPdf(opts: { url: string; out?: string }): Promise<Buffer>` en `scripts/render-pdf.ts`
  - `dist/cv.pdf`
  - `npm run test:pdf`

- [ ] **Step 1: Instalar dependencias**

```bash
npm install -D playwright pdfjs-dist
npx playwright install chromium
```

- [ ] **Step 2: Escribir la verificación que falla**

Crear `scripts/pdf-output.check.ts`:

```ts
/**
 * Verificación del PDF generado. Esto es lo que convierte "el CV pasa el ATS"
 * de intención en test (invariante 7).
 *
 * El nombre NO termina en `.test.ts` a propósito: `npm test` descubre todos los
 * `*.test.ts` y correría este antes de que exista `dist/cv.pdf`. Se corre
 * aparte, después del build, con `npm run test:pdf`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// El build `legacy` es el único que corre en Node (el principal necesita APIs
// del DOM que Node 20 no tiene). Ese subpath no expone types propios.
// @ts-ignore
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { content } from "../content/source/index";

const PDF = "dist/cv.pdf";

/** Texto del PDF en orden de extracción: exactamente lo que ve un parser. */
async function extraer(): Promise<{ texto: string; paginas: number }> {
  const buf = await readFile(PDF);
  const doc = await getDocument({ data: new Uint8Array(buf) }).promise;

  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const contenido = await page.getTextContent();
    texto += contenido.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");
    texto += "\n";
  }
  return { texto, paginas: doc.numPages };
}

test("capa 1: el PDF tiene texto extraíble, no es una imagen", async () => {
  const { texto } = await extraer();
  assert.ok(
    texto.trim().length > 500,
    `el texto extraído tiene ${texto.trim().length} caracteres; un PDF exportado como imagen se descarta entero en la capa 1`,
  );
});

test("capa 1: el parser encuentra nombre, título y todas las empresas", async () => {
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");

  const normal = texto.replace(/\s+/g, " ");
  assert.ok(normal.includes(view.identity.fullName), "falta el nombre completo");
  assert.ok(normal.includes(view.identity.searchTitle), "falta el searchTitle");

  for (const role of view.experience) {
    assert.ok(
      normal.includes(role.company),
      `falta la empresa "${role.company}" en el texto extraído`,
    );
  }
});

test("capa 1: el orden de extracción es sano (nombre antes que el primer rol)", async () => {
  const { texto } = await extraer();
  const view = await content.getView("cv-ats", "es");
  const normal = texto.replace(/\s+/g, " ");

  const posNombre = normal.indexOf(view.identity.fullName);
  const posPrimerRol = normal.indexOf(view.experience[0].company);
  assert.ok(
    posNombre >= 0 && posNombre < posPrimerRol,
    "el nombre no aparece antes del primer rol: el orden de lectura está roto",
  );
});

test("el CV no excede 2 páginas", async () => {
  const { paginas } = await extraer();
  assert.ok(paginas <= 2, `el PDF tiene ${paginas} páginas; el máximo es 2 (docs/03 §2)`);
});

test("ningún TODO del dataset llegó al PDF", async () => {
  const { texto } = await extraer();
  assert.ok(
    !texto.includes("TODO"),
    "hay un TODO en el PDF: o se completa el dato o se deja de renderizar ese campo",
  );
});

test("regla 8: ni el teléfono ni la dirección salen en el PDF", async () => {
  const { texto } = await extraer();
  const data = await content.getDataset("es");
  const normal = texto.replace(/\s+/g, " ");

  if (data.identity.contact.phone) {
    assert.ok(!normal.includes(data.identity.contact.phone), "el teléfono salió en el PDF");
  }
  if (data.identity.location.streetAddress) {
    assert.ok(
      !normal.includes(data.identity.location.streetAddress),
      "la dirección de calle salió en el PDF",
    );
  }
});
```

- [ ] **Step 3: Correr la verificación y confirmar que falla**

Run: `npm run test:pdf`
Expected: FAIL — `ENOENT: no such file or directory, open 'dist/cv.pdf'`

- [ ] **Step 4: Implementar `scripts/render-pdf.ts`**

```ts
/**
 * La costura del PDF.
 *
 * Recibe una URL, no un componente. Hoy la URL es `dist/` servido en localhost;
 * el día que exista una ruta SSR que arme un CV por aviso, esa ruta se le pasa
 * acá y este archivo no cambia una línea. Ese es todo el motivo de que la firma
 * sea así.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

export interface RenderPdfOptions {
  url: string;
  /** Si se pasa, además de devolver el Buffer lo escribe en disco. */
  out?: string;
}

export async function renderPdf({ url, out }: RenderPdfOptions): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    // Sin esto, Chromium puede imprimir con la fuente de fallback y el PDF
    // sale distinto en cada máquina.
    await page.evaluate(() => document.fonts.ready);

    const buffer = await page.pdf({
      format: "a4",
      printBackground: true,
      // El @page del CSS manda sobre estas opciones: los márgenes viven con el
      // layout, no repartidos entre CSS y script.
      preferCSSPageSize: true,
      // PDF accesible: deja el orden de lectura explícito adentro del archivo
      // en vez de que el parser lo deduzca de las coordenadas.
      tagged: true,
      outline: true,
      // Los headers y footers de Chrome rompen el parseo (docs/01 §1).
      displayHeaderFooter: false,
    });

    if (out) await writeFile(out, buffer);
    return buffer;
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 5: Implementar `scripts/build-pdf.ts`**

```ts
/**
 * Post-build: sirve `dist/` y le pide a Chromium que imprima `/cv`.
 *
 * Se sirve por HTTP y no por `file://` porque las rutas absolutas de los assets
 * (`/_astro/...`) no resuelven desde el sistema de archivos, y el PDF saldría
 * sin fuentes ni estilos.
 *
 * El servidor es de 30 líneas a propósito: agregar una dependencia para esto
 * sería más superficie de mantenimiento que el problema que resuelve.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { renderPdf } from "./render-pdf";

const DIST = "dist";
const SALIDA = join(DIST, "cv.pdf");

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

const servidor = createServer(async (req, res) => {
  // normalize() corta cualquier `..`: el server nunca sale de dist/.
  const ruta = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const candidatos = [join(DIST, ruta), join(DIST, ruta, "index.html")];

  for (const archivo of candidatos) {
    try {
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { "content-type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
      res.end(cuerpo);
      return;
    } catch {
      // Probamos el siguiente candidato.
    }
  }

  res.writeHead(404).end("no encontrado");
});

await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
const { port } = servidor.address() as { port: number };

try {
  await renderPdf({ url: `http://127.0.0.1:${port}/cv`, out: SALIDA });
  console.log(`PDF escrito en ${SALIDA}`);
} finally {
  servidor.close();
}
```

- [ ] **Step 6: Generar el PDF**

Run: `npm run build`
Expected: `astro build` OK, luego `PDF escrito en dist/cv.pdf`.

- [ ] **Step 7: Correr la verificación y confirmar que pasa**

Run: `npm run test:pdf`
Expected: 6 tests PASS.

Si falla *"ni el teléfono ni la dirección salen en el PDF"*, es lo esperado en este punto: el dataset todavía publica el teléfono en `cv-ats` y eso se corrige en la Task 7. Anotarlo y seguir; el resto tiene que pasar igual.

- [ ] **Step 8: El test manual de `docs/03` §2**

Abrir `dist/cv.pdf`, seleccionar todo, pegar en un editor de texto plano.
Expected: sale en orden legible, de arriba a abajo, sin columnas entremezcladas.

- [ ] **Step 9: Commit**

```bash
git add scripts/render-pdf.ts scripts/build-pdf.ts scripts/pdf-output.check.ts package.json package-lock.json
git commit -m "feat(pdf): cv.pdf desde /cv con Playwright + verificacion de parseo"
```

---

### Task 5: Capa legible por máquinas

Lo que lee un LLM cuando un reclutador pega la URL, y lo que lee un crawler.

**Files:**
- Create: `src/lib/jsonld.ts`
- Create: `src/lib/jsonld.test.ts`
- Create: `src/pages/cv.json.ts`
- Create: `src/pages/llms.txt.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/cv.astro`

**Interfaces:**
- Consumes: `ContentView` desde `@content`.
- Produces: `buildPersonJsonLd(view: ContentView, site: URL): Record<string, unknown>`; rutas `/cv.json` y `/llms.txt`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/jsonld.test.ts`:

```ts
/**
 * El JSON-LD se genera del dataset, nunca se escribe a mano: uno escrito a mano
 * se desincroniza del CV en el primer cambio, que es justo lo que este sistema
 * existe para impedir.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "../../content/source/index";
import { buildPersonJsonLd } from "./jsonld";

const SITE = new URL("https://ejemplo.test");

test("emite un Person con @id estable", async () => {
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE);

  assert.equal(ld["@type"], "Person");
  assert.equal(ld["@id"], "https://ejemplo.test/#person");
  assert.equal(ld.name, view.identity.fullName);
});

test("jobTitle usa searchTitle, no brandTitle", async () => {
  // Product Engineer es la marca; Desarrollador Full Stack es lo que se busca.
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE);

  assert.equal(ld.jobTitle, view.identity.searchTitle);
  assert.notEqual(ld.jobTitle, view.identity.brandTitle);
});

test("sameAs trae los perfiles externos", async () => {
  const view = await content.getView("public-api", "es");
  const ld = buildPersonJsonLd(view, SITE) as { sameAs: string[] };

  assert.ok(ld.sameAs.some((u) => u.includes("github.com")));
  assert.ok(ld.sameAs.some((u) => u.includes("linkedin.com")));
});

test("regla 8: no filtra streetAddress ni teléfono", async () => {
  const view = await content.getView("public-api", "es");
  const serializado = JSON.stringify(buildPersonJsonLd(view, SITE));

  assert.ok(!serializado.includes("streetAddress"));
  assert.ok(!serializado.includes("telephone"));
});
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `npx tsx --test src/lib/jsonld.test.ts`
Expected: FAIL — `Cannot find module './jsonld'`

- [ ] **Step 3: Implementar `src/lib/jsonld.ts`**

```ts
/**
 * ContentView → schema.org/Person.
 *
 * Server-rendered en el `<head>`: los crawlers no ejecutan JS, así que un
 * JSON-LD inyectado por script no existe para ellos (docs/04 §3).
 *
 * Se alimenta de la superficie `public-api`, que ya excluye los datos de
 * contacto privados. Este archivo no filtra nada: si tuviera que filtrar,
 * el filtro estaría en el lugar equivocado.
 */

import type { ContentView } from "@content";

export function buildPersonJsonLd(view: ContentView, site: URL): Record<string, unknown> {
  const { identity } = view;
  const rolActual = view.experience.find((r) => r.end === null);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    // `@id` estable: es lo que le permite a un agente unir esta página con los
    // perfiles de `sameAs` como una sola entidad. Si cambia, se pierde.
    "@id": new URL("/#person", site).toString(),
    name: identity.fullName,
    alternateName: identity.preferredName,
    // El buscable, no el de marca (CONTRATO §3).
    jobTitle: identity.searchTitle,
    description: identity.summary.short,
    url: site.toString(),
    email: identity.contact.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: identity.location.city,
      addressRegion: identity.location.region,
      addressCountry: identity.location.country,
    },
    knowsAbout: Object.values(view.skills)
      .flat()
      .filter((s) => s.level === "core" || s.level === "working")
      .map((s) => s.name),
    knowsLanguage: view.languages.map((l) => ({
      "@type": "Language",
      name: l.name,
      alternateName: l.code,
    })),
    ...(rolActual && {
      worksFor: { "@type": "Organization", name: rolActual.company },
    }),
    alumniOf: view.education.map((e) => ({
      "@type": "EducationalOrganization",
      name: e.institution,
    })),
    sameAs: identity.links.map((l) => l.url),
  };
}
```

- [ ] **Step 4: Correr y confirmar que pasa**

Run: `npx tsx --test src/lib/jsonld.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Inyectar el JSON-LD en las dos páginas**

En `src/pages/index.astro` y en `src/pages/cv.astro`, agregar al frontmatter:

```ts
import { buildPersonJsonLd } from "../lib/jsonld";

const jsonLd = buildPersonJsonLd(view, new URL(Astro.site!));
```

y dentro del `<Base>`, como primer hijo:

```astro
  <script type="application/ld+json" slot="head" set:html={JSON.stringify(jsonLd)} />
```

En `index.astro` la vista ya es `public-api`. En `cv.astro` la vista es `cv-ats`, así que ahí hay que traer la otra explícitamente en el frontmatter:

```ts
const viewPublica = await content.getView("public-api", "es");
const jsonLd = buildPersonJsonLd(viewPublica, new URL(Astro.site!));
```

- [ ] **Step 6: Crear `src/pages/cv.json.ts`**

```ts
/**
 * El dataset resuelto, servido como JSON. Para agentes y para cualquiera que
 * quiera consumir estos datos sin scrapear HTML.
 *
 * Superficie `public-api`: `resolveView` ya sacó el teléfono y la dirección.
 */

import type { APIRoute } from "astro";
import { content } from "@content";

export const GET: APIRoute = async () => {
  const view = await content.getView("public-api", "es");

  return new Response(JSON.stringify(view, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
```

- [ ] **Step 7: Crear `src/pages/llms.txt.ts`**

```ts
/**
 * Resumen en markdown para agentes (docs/04 §3).
 *
 * Cada vez más reclutadores pegan la URL en un LLM y preguntan si el candidato
 * sirve. Esto es lo que ese modelo lee. Se genera del dataset: escribirlo a
 * mano garantiza que en tres meses diga otra cosa que el CV.
 */

import type { APIRoute } from "astro";
import { content, formatDateRange, formatSeniority } from "@content";

export const GET: APIRoute = async ({ site }) => {
  const view = await content.getView("public-api", "es");
  const { identity } = view;
  const base = site?.toString().replace(/\/$/, "") ?? "";

  const lineas = [
    `# ${identity.fullName}`,
    "",
    `${identity.searchTitle} (${identity.brandTitle}) · ${formatSeniority(view.yearsOfExperience)} · ${identity.location.city}, ${identity.location.country} · ${identity.location.timezone}`,
    "",
    identity.summary.short,
    "",
    "## Contacto",
    `- Email: ${identity.contact.email}`,
    ...identity.links.map((l) => `- ${l.label}: ${l.url}`),
    `- CV en HTML: ${base}/cv`,
    `- CV en PDF: ${base}/cv.pdf`,
    `- Datos en JSON: ${base}/cv.json`,
    "",
    "## Stack",
    ...Object.entries(view.skills)
      .filter(([, list]) => list.length > 0)
      .map(([cat, list]) => `- ${cat}: ${list.map((s) => s.name).join(", ")}`),
    "",
    "## Experiencia",
    ...view.experience.flatMap((role) => [
      `### ${role.company} — ${role.displayTitle ?? role.title}`,
      `${formatDateRange(role.start, role.end)} · ${role.employmentType} · ${role.workMode}`,
      role.context.short,
      ...role.achievements.map((a) => `- ${a.text.short}`),
      "",
    ]),
    "## Proyectos",
    ...view.projects.flatMap((p) => [
      `### ${p.name}${p.client ? ` (${p.client})` : ""}`,
      p.problem.short,
      p.solution.short,
      ...(p.slug ? [`Caso: ${base}/proyectos/${p.slug}`] : []),
      "",
    ]),
  ];

  return new Response(lineas.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
```

- [ ] **Step 8: Verificar las tres salidas**

```bash
npm run build
```

```bash
node --input-type=commonjs -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('dist/cv.json','utf8')); const t=fs.readFileSync('dist/llms.txt','utf8'); const h=fs.readFileSync('dist/cv/index.html','utf8'); const f=[]; if(j.identity.contact.phone) f.push('el telefono salio en cv.json'); if(!t.includes('## Experiencia')) f.push('llms.txt incompleto'); if(!h.includes('application/ld+json')) f.push('falta el JSON-LD en /cv'); if(f.length){console.error(f.join('\n'));process.exit(1)} console.log('OK: capa maquina completa')"
```
Expected: `OK: capa maquina completa`

- [ ] **Step 9: Correr todo y commitear**

```bash
npm run typecheck && npm run validate && npm test && npm run test:pdf
git add src/
git commit -m "feat(web): capa maquina - JSON-LD Person, /cv.json y /llms.txt"
```

---

### Task 6: Auditoría de TODOs y saneamiento del dataset

El chequeo bloqueante del PDF ya existe (Task 4). Falta la visibilidad sobre lo que sí se publica con TODOs, y sacar el teléfono de la web.

**Files:**
- Create: `scripts/audit-todos.ts`
- Modify: `content/data/content.es.json:26`

**Interfaces:**
- Consumes: los archivos de `dist/`.
- Produces: `npm run audit:todos` (siempre exit 0).

- [ ] **Step 1: Implementar `scripts/audit-todos.ts`**

```ts
/**
 * Reporte de los TODO del dataset que llegan a un output público.
 *
 * NO bloquea el build a propósito. Son datos pendientes conocidos del autor
 * (métricas, outcomes de proyectos, nivel de inglés), y un pipeline en rojo
 * permanente deja de dar señal: a la tercera vez nadie lo mira.
 *
 * Lo que sí bloquea es que un TODO llegue al PDF, y eso lo verifica
 * `scripts/pdf-output.check.ts`, porque el PDF es lo que se manda.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";
const EXTENSIONES = [".html", ".json", ".txt"];

async function* archivos(dir: string): AsyncGenerator<string> {
  for (const entrada of await readdir(dir)) {
    const ruta = join(dir, entrada);
    if ((await stat(ruta)).isDirectory()) yield* archivos(ruta);
    else if (EXTENSIONES.some((ext) => ruta.endsWith(ext))) yield ruta;
  }
}

let encontrados = 0;

for await (const ruta of archivos(DIST)) {
  const contenido = await readFile(ruta, "utf8");
  contenido.split("\n").forEach((linea, i) => {
    if (!linea.includes("TODO")) return;
    encontrados++;
    console.log(`${ruta}:${i + 1}  ${linea.trim().slice(0, 140)}`);
  });
}

console.log(
  encontrados === 0
    ? "\nSin TODOs en los outputs publicados."
    : `\n${encontrados} TODO(s) publicados. No bloquea, pero cada uno es un dato que un lector va a ver.`,
);
```

- [ ] **Step 2: Correr la auditoría**

Run: `npm run build && npm run audit:todos`
Expected: lista los TODOs de `cv.json` y `llms.txt` (outcomes de proyectos, `summary.long`, nota del nivel de inglés) y termina con exit 0.

- [ ] **Step 3: Sacar el teléfono de las superficies públicas**

En `content/data/content.es.json`, línea 26:

```json
      "publishPhoneOn": ["cv", "cv-short"]
```

`cv-ats` sale de la lista porque `/cv` HTML y `cv.pdf` comparten esa superficie: dejarlo publicaba el teléfono en la web abierta, no solo en el PDF que se sube a un portal. Las superficies `cv` y `cv-short` todavía no se renderizan; cuando se agregue el CV diseñado, esta decisión se revisa ahí.

- [ ] **Step 4: Verificar que el teléfono desapareció de todos lados**

```bash
npm run build && npm run test:pdf
```
Expected: los 6 tests PASS, incluido *"regla 8: ni el teléfono ni la dirección salen en el PDF"* que en la Task 4 quedó fallando.

```bash
node --input-type=commonjs -e "const fs=require('fs'),p=require('path'); const tel='<TELEFONO-REMOVIDO>'; const walk=d=>fs.readdirSync(d).flatMap(e=>{const r=p.join(d,e);return fs.statSync(r).isDirectory()?walk(r):[r]}); const malos=walk('dist').filter(f=>/\.(html|json|txt)$/.test(f)&&fs.readFileSync(f,'utf8').includes(tel)); if(malos.length){console.error('el telefono sigue en: '+malos.join(', '));process.exit(1)} console.log('OK: telefono fuera de dist/')"
```
Expected: `OK: telefono fuera de dist/`

- [ ] **Step 5: Correr la suite completa y commitear**

```bash
npm run typecheck && npm run validate && npm test && npm run test:pdf
git add scripts/audit-todos.ts content/data/content.es.json package.json
git commit -m "feat(build): auditoria de TODOs publicados + telefono fuera de cv-ats"
```

---

### Task 7: CI y cierre de documentación

Sin esto, todo lo anterior es una intención: las reglas del contrato son tests de CI o no son nada (invariante 7).

**Files:**
- Modify: `.github/workflows/content-validation.yml`
- Modify: `CLAUDE.md`
- Modify: `docs/00-indice.md`

**Interfaces:**
- Consumes: todos los scripts de las tasks anteriores.
- Produces: pipeline verde en cada push.

- [ ] **Step 1: Extender el workflow**

Reemplazar `.github/workflows/content-validation.yml` por:

```yaml
# Hace ciertas las afirmaciones de los docs: las reglas duras son CI, no intenciones.
# Equivalente local (todos tienen que pasar):
#   npm run typecheck && npm run validate && npm test && npm run build && npm run test:pdf
name: content-validation

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run validate
      - run: npm test

      # El PDF necesita Chromium. Va en un step propio para que un fallo de
      # descarga del browser no se confunda con un fallo del CV.
      - name: Cache de browsers de Playwright
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium

      - run: npm run build
      # Acá se verifica que el CV pasa la capa 1 del embudo: texto extraíble,
      # orden de lectura sano, sin TODOs, sin teléfono, máximo 2 páginas.
      - run: npm run test:pdf

      # No bloquea: son datos pendientes conocidos. Queda en el log para verlos.
      - run: npm run audit:todos

      - name: Publicar el CV generado
        uses: actions/upload-artifact@v4
        with:
          name: cv-pdf
          path: dist/cv.pdf
```

- [ ] **Step 2: Verificar el workflow localmente**

Run: `npm run typecheck && npm run validate && npm test && npm run build && npm run test:pdf && npm run audit:todos`
Expected: todo PASS. Es exactamente lo que va a correr CI.

- [ ] **Step 3: Actualizar el mapa de archivos de `CLAUDE.md`**

En la sección `## Mapa de archivos`, agregar debajo del bloque de `content/`:

```
src/
  pages/cv.astro      El CV en HTML. ÚNICA fuente del layout; de acá sale el PDF.
  pages/index.astro   Home mínima. NO es el portfolio.
  pages/cv.json.ts    Endpoint public-api.
  pages/llms.txt.ts   Endpoint markdown para agentes.
  components/cv/      Componentes tontos: reciben props resueltas, no filtran nada.
  lib/jsonld.ts       ContentView → schema.org Person.
  styles/cv.css       Una columna. Prohibido flex/grid/table (rompe el parseo).
content/schema/
  format-metric.ts    Regla 4. El "~" de los estimados vive acá y solo acá.
  format.ts           Duraciones, rangos MM/AAAA, títulos de rol. Reglas 1 y 2.
scripts/
  render-pdf.ts       renderPdf({ url }). Recibe URL, no componente: es la costura a SSR.
  build-pdf.ts        Sirve dist/ e imprime /cv → dist/cv.pdf.
  pdf-output.check.ts Verifica el PDF generado. No es *.test.ts a propósito.
  audit-todos.ts      Reporte NO bloqueante de TODOs publicados.
```

En la sección `## Comandos`, agregar:

```bash
npm run dev         # astro dev
npm run build       # astro build + genera dist/cv.pdf
npm run test:pdf    # verifica el PDF generado (necesita build previo)
npm run audit:todos # lista TODOs publicados. No bloquea
```

En la tabla `## Dónde se hace cumplir cada regla dura`, cambiar la fila de la regla 4 por:

```
| 4 | `estimated` se renderiza con "~" | `content/schema/format-metric.ts` → `formatMetric`. Único lugar. **`npm test`** (corre en CI) |
```

- [ ] **Step 4: Actualizar el estado en `docs/00-indice.md`**

En la sección `## Estado`, marcar como hechos:

```
- [x] Repo en GitHub
- [x] `formatMetric()` — hace cumplir la regla 4
- [x] Frontend consumiendo `getView()`
- [x] Generadores de salida: CV PDF, `/cv` HTML, JSON-LD, `llms.txt`, `/cv.json`
```

Y agregar a la tabla de decisiones:

```
| 2026-08 | Frontend en **Astro estático**, PDF en build con **Playwright** desde la misma página `/cv` | Un solo layout para HTML y PDF: no se pueden desincronizar |
| 2026-08 | Solo se renderiza `cv-ats`; el CV diseñado (CV-A) queda para después | Un artefacto = nunca dudar cuál mandar. La maquinaria de superficies ya soporta agregar el otro |
| 2026-08 | `cv-ats` sale de `publishPhoneOn` | `/cv` HTML y el PDF comparten superficie: publicarlo ahí lo ponía en la web abierta |
```

- [ ] **Step 5: Commit y push**

```bash
git add .github/workflows/content-validation.yml CLAUDE.md docs/00-indice.md
git commit -m "ci: build y verificacion del PDF en el pipeline + docs al dia"
git push
```

- [ ] **Step 6: Verificar que CI queda en verde**

Run: `gh run watch`
Expected: el workflow `content-validation` termina en verde, con `cv-pdf` como artifact descargable.

---

## Verificación final

Los criterios de aceptación del spec, en orden, con el comando que los prueba:

| # | Criterio | Comando |
|---|---|---|
| 1 | Los cinco comandos pasan local y en CI | `npm run typecheck && npm run validate && npm test && npm run build && npm run test:pdf` |
| 2 | `dist/cv.pdf` con texto seleccionable y las 5 verificaciones | `npm run test:pdf` |
| 3 | `/cv` en una columna, sin JS de cliente | `grep -c "<script" dist/cv/index.html` → solo el de `application/ld+json` |
| 4 | Las salidas máquina vienen del mismo `getView` | `npx tsx --test src/lib/jsonld.test.ts` |
| 5 | Nada en `src/` filtra por visibility | `grep -rn "\.visibility\|\.priority" src/` → sin resultados |
| 6 | Nada en `src/` importa `json-source` | `grep -rn "json-source" src/` → sin resultados |
| 7 | El test en `todo` de la regla 4 está activo | `npm test` → ningún `todo` en la salida |
| 8 | Ni `streetAddress` ni `phone` en `dist/` | Step 4 de la Task 6 |
| 9 | Sin `TODO` en el PDF; el resto auditado sin bloquear | `npm run test:pdf && npm run audit:todos` |

## Después de este plan

Nada de esto entra acá, y ninguna task lo asume:

- **Datos:** cargar las `metric` (`docs/03-cv.md` §5), confirmar Hogarth y el nivel de inglés, resolver los `outcome` en TODO. El CV se regenera solo.
- **Dominio:** definirlo y setear `SITE_URL`. Hasta entonces el `@id` del JSON-LD apunta a `portfolio.invalid`, que rompe visible en vez de mentir.
- **Deploy:** Cloudflare Pages (el repo es privado y GitHub Pages sobre privado exige plan pago).
- **Slice 2:** portfolio visual, casos de estudio y CLI de CV-por-aviso.
