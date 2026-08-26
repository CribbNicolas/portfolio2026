# Landing única Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/` sea la única página navegable — hero, mapa, proyectos y CV completo — y que `/cv` quede como fuente de impresión del PDF, sin links entrantes y con `noindex`.

**Architecture:** La landing resuelve dos vistas del mismo dataset: `portfolio` para hero/mapa/proyectos y `cv-ats` para la sección CV, que tiene que ser idéntica al PDF. El CV se renderiza con los mismos `components/cv/*` en las dos páginas, así el layout tiene una sola fuente. Ni el índice ni el botón flotante agregan JavaScript: son anchors y un `<a download>` con `position: fixed`.

**Tech Stack:** Astro 6 estático, TypeScript ESM, `node:test` vía `tsx --test`, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-08-21-single-landing-design.md`

## Global Constraints

- **El gestor de paquetes es pnpm.** Nunca `npm`.
- **`/cv` no puede enviar un solo byte de JavaScript.** De ahí se imprime el PDF con Playwright esperando `networkidle`.
- **Nada bajo `src/scripts/` importa de `@content`.** No aplica a este plan, que no toca `src/scripts/`.
- **El frontend nunca filtra por `visibility` ni calcula duraciones** (invariante 1). Todo eso ya lo hizo `resolveView`.
- **Todo importa desde `content/source/index.ts`** vía el alias `@content` (invariante 2).
- **Nunca inventar datos** para llenar el dataset (invariante 4). Los `links` de los proyectos los carga el autor.
- **Comentarios en español, explican el PORQUÉ.** Banners de sección `// ---`. Cuando algo hace cumplir una regla, se nombra por número.
- **Copy sin palabras prohibidas** de `docs/02-branding.md` (`apasionado`, `proactivo`, `escalable` sin escala, `buenas prácticas` sin decir cuáles).
- **Secuencia de verificación completa**, todos tienen que pasar. `test:landing`
  existe recién a partir de la Task 4; hasta entonces, la secuencia es la misma
  sin ese comando:
  `pnpm run typecheck && pnpm run validate && pnpm test && pnpm run build && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run audit:todos`
- **`audit:todos` reporta, no bloquea.** Hoy lista 9 TODOs publicados y eso está
  bien: son datos que faltan en el dataset, no fallas de este plan.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/pages/index.astro` | **Modificar.** La landing entera. Resuelve las dos vistas y compone las cuatro secciones |
| `src/pages/cv.astro` | **Modificar.** Solo agregar `noindex`. El resto queda intacto |
| `src/components/proyectos/ListaProyectos.astro` | **Crear.** Componente tonto: recibe proyectos y un mapa de nombres de skill, escribe la lista |
| `src/styles/proyectos.css` | **Crear.** Estilos de la lista de proyectos |
| `src/styles/home.css` | **Modificar.** Índice del hero y botón flotante |
| `scripts/single-landing.check.ts` | **Crear.** Verifica sobre `dist/` que `/cv` esté aislada y que la sección CV de la landing no se desincronice del PDF |
| `package.json` | **Modificar.** Script `test:landing` |
| `.github/workflows/content-validation.yml` | **Modificar.** Step del check nuevo |

---

### Task 1: La sección CV en la landing

La pieza estructural más grande. Todo lo demás cuelga de que `#cv` exista.

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `content.getView(surface, locale)` de `@content`; `Header`, `Section`, `RoleBlock`, `SkillList` de `src/components/cv/`; `formatDateRange`, `formatYearMonth` de `@content`.
- Produces: un `<section id="cv">` en `dist/index.html` que contiene los mismos bullets que `dist/cv/index.html`. La Task 4 verifica esa igualdad.

**Contexto que hace falta entender antes de tocar nada:**

`components/cv/Header.astro` emite `<h1 class="cv__name">` más nombre, ubicación, email y links. La landing **ya** muestra todo eso en el hero, y un segundo `<h1>` en la misma página es un error de accesibilidad. Por eso la landing **NO** renderiza `<Header>`: su sección CV arranca en "Perfil". `/cv` sí lo conserva, porque `pdf-output.check.ts` tiene un test que exige que el nombre se extraiga antes del primer rol.

`Section.astro` emite `<h2>`. La sección CV de la landing lleva su propio `<h2>Currículum</h2>` y los `<h2>` internos quedan al mismo nivel. Es HTML válido y los lectores de pantalla lo manejan. **No** le agregues un prop `level` a `Section`: ese componente existe para garantizar los nombres estándar que un parser mapea a campos (`Perfil`, `Habilidades técnicas`, ...), y darle flexibilidad de heading es abrirle la puerta a que alguien emita otra cosa.

- [ ] **Step 1: Agregar la vista `cv-ats` y los imports**

En `src/pages/index.astro`, después de `import GraphSvg ...` agregá:

```astro
import Section from "../components/cv/Section.astro";
import RoleBlock from "../components/cv/RoleBlock.astro";
import SkillList from "../components/cv/SkillList.astro";
import { formatDateRange, formatYearMonth } from "@content";
```

`formatSeniority` ya está importado desde `@content`; sumá los dos nuevos a ese mismo import en vez de crear otro.

En los imports de CSS, después de `import "../styles/home.css";`:

```astro
import "../styles/cv.css";
```

`cv.css` está acotado a `.cv` y a `@page`, así que no derrama estilos sobre el resto de la landing.

Después de `const view = await content.getView("portfolio", "es");` agregá:

```astro
// Regla 7: `cv-ats` recorta por prioridad (cutoff 3) y topea en 5 logros por
// rol; `portfolio` no recorta nada. La sección de abajo tiene que mostrar
// EXACTAMENTE lo que sale impreso, porque el botón de descarga promete "el CV".
const viewCv = await content.getView("cv-ats", "es");
```

- [ ] **Step 2: Renderizar la sección**

Dentro de `<main class="lab__contenido">`, **después** de `</section>` de `lab__mapa-seccion`, agregá:

```astro
      <section id="cv" class="cv">
        <h2 class="cv__seccion-titulo">Currículum</h2>

        <Section title="Perfil">
          <p class="profile">{viewCv.identity.summary.short}</p>
        </Section>

        <Section title="Habilidades técnicas">
          <SkillList skills={viewCv.skills} />
        </Section>

        <Section title="Experiencia">
          {viewCv.experience.map((role) => <RoleBlock role={role} />)}
        </Section>

        <Section title="Educación">
          {viewCv.education.map((e) => (
            <div class="entry">
              <p class="entry__title">{e.degree}{e.field && <> — {e.field}</>}</p>
              <p class="entry__meta">
                {e.institution}
                {e.end && <> · {e.start ? formatDateRange(e.start, e.end) : formatYearMonth(e.end)}</>}
                {e.status === "partial" && <> · Cursado parcial</>}
                {e.status === "in-progress" && <> · En curso</>}
              </p>
            </div>
          ))}
        </Section>

        <Section title="Idiomas">
          {viewCv.languages.map((l) => (
            <p class="skill-group">
              <span class="skill-group__label">{l.name}:</span>{" "}
              {l.level === "native" ? "Nativo" : l.level}
            </p>
          ))}
        </Section>
      </section>
```

Es una copia literal del cuerpo de `cv.astro` menos `<Header>`. Se copia y no se extrae a un componente compartido a propósito: son cinco `<Section>` en distinto orden de anidamiento, y un componente `<CuerpoCv>` con un flag `conHeader` esconde esa diferencia detrás de un booleano. Los componentes que importan —los que formatean datos— ya están compartidos.

- [ ] **Step 3: Estilo del título de sección**

En `src/styles/cv.css`, al final:

```css
/* Solo lo usa la landing: en `/cv` el `<h1>` del Header ya abre la página.
   Vive acá y no en home.css porque es parte del bloque `.cv`. */
.cv__seccion-titulo {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0 0 calc(var(--espacio) * 2);
}
```

- [ ] **Step 4: Verificar que compila y que la sección salió**

```bash
pnpm run typecheck && pnpm run build
```

Esperado: 0 errors, build completo, `PDF escrito en dist\cv.pdf`.

`RoleBlock.astro` emite `<article class="role">` y `<ul class="role__bullets">`; los logros son `<li>` sueltos, sin clase propia. Como `#cv` es la ÚLTIMA sección de la landing, todo lo que viene después de ese marcador es el CV (más el botón flotante, que no tiene `<li>`):

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const c=fs.readFileSync('dist/cv/index.html','utf8');const cola=h.slice(h.indexOf('id=\"cv\"'));const li=t=>(t.match(/<li[ >]/g)||[]).length;console.log('id=cv:',h.includes('id=\"cv\"'));console.log('roles landing/cv:',(cola.match(/class=\"role\"/g)||[]).length,'/',(c.match(/class=\"role\"/g)||[]).length);console.log('logros landing/cv:',li(cola),'/',li(c));"
```

Esperado: `id=cv: true` y los dos pares de conteos **iguales**. Si los logros difieren, la sección está usando la superficie equivocada — `portfolio` no topea en 5 por rol y `cv-ats` sí.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/styles/cv.css
git commit -m "feat(landing): el CV completo baja a la home, superficie cv-ats

Sin <Header>: el hero ya muestra nombre, ubicacion y contacto, y un segundo
<h1> en la misma pagina es un error de accesibilidad. /cv lo conserva porque
el PDF necesita el nombre antes del primer rol.

Superficie cv-ats y no portfolio: portfolio no recorta nada y la seccion
mostraria mas logros de los que salen impresos, mientras el boton promete
descargar el CV."
```

---

### Task 2: La sección de proyectos

**Files:**
- Create: `src/components/proyectos/ListaProyectos.astro`
- Create: `src/styles/proyectos.css`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `view.projects` y `view.skills` de la vista `portfolio`; `ID_ITEM` de `src/lib/lab-hover-css.ts`; `nodeId` de `@content`.
- Produces: `<section id="proyectos">` con una tarjeta por proyecto, cada una con `id={ID_ITEM(nodeId("project", p.id))}` y `data-node`.

**Contexto:**

`buildHoverCss` ya genera reglas `:has()` para **todos** los nodos del grafo, incluidos los tres `project:*`. Hoy nada en el DOM lleva esos ids, así que esas reglas están escritas y sin usar. Poniéndoselos a las tarjetas, el hover cruzado tarjeta↔mapa funciona sin una línea de JavaScript.

Los tres proyectos tienen `links: []` en el dataset. El componente renderiza el link **solo si existe**. No inventes URLs (invariante 4).

- [ ] **Step 1: Crear el componente**

`src/components/proyectos/ListaProyectos.astro`:

```astro
---
/**
 * Los proyectos, en lista compacta con link público.
 *
 * Es la sección "Casos" que `docs/04` §1 tenía pendiente, en su versión
 * honesta: `problem.short` y `outcome.short` todavía tienen TODO en dos de los
 * tres proyectos, así que el formato problema → decisión → resultado del §2 no
 * se puede llenar sin inventar. `solution.short` está limpio en los tres.
 *
 * Componente tonto: recibe los proyectos ya resueltos y un mapa de nombres de
 * skill. No filtra ni ordena por visibility (invariante 1).
 *
 * El `id` de cada tarjeta es el que espera `buildHoverCss`: con eso el hover
 * cruzado con el mapa funciona SIN JavaScript, con reglas que ya existen.
 */
import type { Project } from "@content";
import { nodeId } from "@content";
import { ID_ITEM } from "../../lib/lab-hover-css";

interface Props {
  proyectos: Project[];
  /** skillId → nombre canónico. Lo arma la página desde la vista. */
  nombreDeSkill: Map<string, string>;
}

const { proyectos, nombreDeSkill } = Astro.props;

/** Qué se muestra al lado del nombre. `archived` no se etiqueta: no aporta. */
const ESTADO: Partial<Record<Project["status"], string>> = {
  "in-progress": "En curso",
  prototype: "Prototipo",
};
---

<ul class="proyectos">
  {proyectos.map((p) => (
    <li
      class="proyecto"
      id={ID_ITEM(nodeId("project", p.id))}
      data-node={nodeId("project", p.id)}
    >
      <h3 class="proyecto__nombre">
        {p.name}
        {ESTADO[p.status] && <span class="proyecto__estado">{ESTADO[p.status]}</span>}
      </h3>
      {p.client && <p class="proyecto__cliente">{p.client}</p>}
      <p class="proyecto__solucion">{p.solution.short}</p>
      <ul class="proyecto__stack">
        {p.skillIds.map((id) => {
          const nombre = nombreDeSkill.get(id);
          return nombre ? <li>{nombre}</li> : null;
        })}
      </ul>
      {p.links.length > 0 && (
        <p class="proyecto__links">
          {p.links.map((l, i) => (
            <>
              {i > 0 && " · "}
              <a href={l.url} rel="noopener">{l.label}</a>
            </>
          ))}
        </p>
      )}
    </li>
  ))}
</ul>
```

- [ ] **Step 2: Crear los estilos**

`src/styles/proyectos.css`:

```css
/*
 * La lista de proyectos.
 *
 * Sin tarjetas con sombra: el mapa de arriba ya es el elemento con peso visual
 * de la página, y competirle acá parte la atención. La jerarquía es tipográfica.
 */

.proyectos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: calc(var(--espacio) * 4);
}

.proyecto {
  border-top: 1px solid var(--linea);
  padding-top: calc(var(--espacio) * 2);
}

.proyecto__nombre {
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 calc(var(--espacio) * 0.5);
  display: flex;
  align-items: baseline;
  gap: calc(var(--espacio) * 1.5);
  flex-wrap: wrap;
}

/* `in-progress` se dice, no se esconde: mostrar algo a medias como terminado
   es lo que el schema evita con `status`. */
.proyecto__estado {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--acento);
  background: var(--acento-tenue);
  padding: 0.15em 0.6em;
  border-radius: 999px;
}

.proyecto__cliente {
  margin: 0 0 calc(var(--espacio) * 1);
  font-size: 0.8125rem;
  color: var(--tinta-suave);
}

.proyecto__solucion {
  margin: 0 0 calc(var(--espacio) * 1.5);
  line-height: 1.55;
  text-wrap: pretty;
}

.proyecto__stack {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--espacio) * 0.75);
}

.proyecto__stack li {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tinta-suave);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  padding: 0.15em 0.6em;
}

.proyecto__links {
  margin: calc(var(--espacio) * 1.5) 0 0;
  font-size: 0.875rem;
}

.proyecto__links a {
  color: var(--acento);
}
```

Los cuatro tokens que usa (`--acento`, `--acento-tenue`, `--linea`, `--radio`) ya existen en `tokens.css`, en claro y en oscuro. Cero hex fuera de ese archivo.

- [ ] **Step 3: Montarlo en la landing**

En `src/pages/index.astro`, con los otros imports:

```astro
import ListaProyectos from "../components/proyectos/ListaProyectos.astro";
```

Con los de CSS:

```astro
import "../styles/proyectos.css";
```

Después de `const afinidades = ...`:

```astro
// skillId → nombre canónico, para el stack de cada proyecto. Se arma acá y no
// en el componente: `view.skills` viene agrupado por categoría, y aplanarlo es
// trabajo de la página, no del componente tonto.
const nombreDeSkill = new Map(
  Object.values(view.skills).flat().map((s) => [s.id, s.name]),
);
```

Entre la sección del mapa y la del CV:

```astro
      <section id="proyectos" class="proyectos-seccion">
        <h2 class="lab__titulo">Proyectos</h2>
        <ListaProyectos proyectos={view.projects} nombreDeSkill={nombreDeSkill} />
      </section>
```

Y en `src/styles/proyectos.css`, arriba de `.proyectos`:

```css
.proyectos-seccion {
  max-width: 40rem;
  margin: 0 auto;
  padding: 0 calc(var(--espacio) * 2.5) calc(var(--espacio) * 8);
}
```

- [ ] **Step 4: Verificar**

```bash
pnpm run typecheck && pnpm run build
```

Esperado: 0 errors, build completo.

```bash
node -e "const h=require('fs').readFileSync('dist/index.html','utf8'); console.log('seccion:', /id=\"proyectos\"/.test(h)); console.log('tarjetas:', (h.match(/class=\"proyecto\"/g)||[]).length); console.log('ids de hover:', (h.match(/id=\"i-project-/g)||[]).length);"
```

Esperado: `seccion: true`, `tarjetas: 3`, `ids de hover: 3`. Si el último da 0, `ID_ITEM` no se aplicó y el hover cruzado no va a funcionar.

- [ ] **Step 5: Comprobar el hover cruzado a ojo**

```bash
pnpm run dev
```

Abrí `http://localhost:4321/`, bajá a Proyectos, pasá el mouse por una tarjeta y mirá el mapa: el nodo de ese proyecto tiene que encenderse con el color de acento. Probá también al revés. Cortá el server cuando termines.

Si no enciende, comparalo con lo que emite la lista de tecnologías del mapa: `ID_ITEM` tiene que producir exactamente el mismo formato de id que usa `buildHoverCss`.

- [ ] **Step 6: Commit**

```bash
git add src/components/proyectos/ src/styles/proyectos.css src/pages/index.astro
git commit -m "feat(landing): seccion de proyectos con link publico

Es la seccion Casos que docs/04 tenia pendiente, en lista compacta y no en
formato caso de estudio: problem.short y outcome.short todavia tienen TODO en
dos de los tres proyectos.

Cada tarjeta lleva el id que espera buildHoverCss, asi que el hover cruzado
con el mapa funciona sin JavaScript con reglas que ya existian sin usarse.

Los tres proyectos tienen links vacios: el componente renderiza el link solo
si existe."
```

---

### Task 3: Índice del hero y botón flotante

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/home.css`

**Interfaces:**
- Consumes: los `id` de las tres secciones (`#mapa`, `#proyectos`, `#cv`) que existen desde las Tasks 1 y 2.
- Produces: la landing deja de tener cualquier `href="/cv"`. La Task 4 lo verifica.

**Contexto:**

Cero JavaScript nuevo. El scroll suave es CSS, y `tokens.css` ya anula animaciones bajo `prefers-reduced-motion` — pero `scroll-behavior` **no** es una animación y ese reset no la cubre, así que hay que anularla explícitamente.

El botón flotante vive fuera de `.lab__mapa`, así que no le roba eventos de puntero al mapa.

- [ ] **Step 1: `#mapa` en la sección del mapa**

En `src/pages/index.astro`, cambiá:

```astro
      <section class="lab__mapa-seccion">
```

por:

```astro
      <section id="mapa" class="lab__mapa-seccion">
```

- [ ] **Step 2: El índice y el botón del hero**

En el hero, reemplazá el bloque `home__actions` entero por:

```astro
        <div class="home__actions">
          <a class="btn btn--primary" href="#cv">Ver el CV</a>
          <a class="btn" href="/cv.pdf" download="Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf">
            Descargar en PDF
          </a>
        </div>

        {/*
          El índice reemplaza a la navegación entre páginas: son anclas dentro
          de la misma landing. `href="#cv"` y NO `/cv` — esa ruta existe solo
          para imprimir el PDF, y hay un test que verifica que nadie la linkee.
        */}
        <nav class="home__indice" aria-label="Secciones">
          <a href="#mapa">Mapa</a>
          <a href="#proyectos">Proyectos</a>
          <a href="#cv">CV</a>
        </nav>
```

- [ ] **Step 3: El botón flotante**

Dentro de `<div class="lab">`, después de `</main>` y antes de `</div>`:

```astro
    {/*
      Acompaña todo el scroll: el del hero sirve para el que decide en los
      primeros diez segundos, este para el que ya leyó. Fuera de `.lab__mapa`,
      así que no le roba eventos de puntero al mapa.
    */}
    <a
      class="descarga-flotante"
      href="/cv.pdf"
      download="Nicolas-Cribb-Barbaro-Full-Stack-Developer.pdf"
    >
      <span aria-hidden="true">↓</span> Descargar CV
    </a>
```

- [ ] **Step 4: Los estilos**

Al final de `src/styles/home.css`:

```css
/* --- Índice y descarga flotante ----------------------------------------- */

.home__indice {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--espacio) * 2.5);
  margin-top: calc(var(--espacio) * 3);
  font-size: 0.875rem;
  font-weight: 600;
}

.home__indice a {
  color: var(--tinta-suave);
  text-decoration: none;
  border-bottom: 1px solid var(--linea);
  padding-bottom: 0.15em;
}

.home__indice a:hover {
  color: var(--acento);
  border-bottom-color: var(--acento);
}

/* z-index 10: `.lab__campo` es `position: fixed` y `.lab__contenido` es
   `z-index: 1`. Sin esto el botón queda debajo del contenido. */
.descarga-flotante {
  position: fixed;
  right: calc(var(--espacio) * 2);
  bottom: calc(var(--espacio) * 2);
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--espacio) * 0.75);
  padding: 0.75em 1.25em;
  border-radius: 999px;
  background: var(--acento);
  color: var(--fondo);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
}

.descarga-flotante:hover {
  filter: brightness(1.08);
}

/* El PDF sale de `/cv`, que no tiene este botón. La regla está por si alguien
   imprime la landing desde el browser. */
@media print {
  .descarga-flotante,
  .home__indice {
    display: none;
  }
}

/* El scroll suave es lo que hace que el índice se lea como navegación y no
   como un salto. `tokens.css` anula animaciones bajo `prefers-reduced-motion`,
   pero `scroll-behavior` no es una animación y ese reset no la alcanza. */
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

`--fondo` es `#ffffff` en claro y `#131417` en oscuro, así que el texto del botón contrasta contra `--acento` en los dos temas.

- [ ] **Step 5: Verificar**

```bash
pnpm run build
node -e "const h=require('fs').readFileSync('dist/index.html','utf8'); console.log('links a /cv:', (h.match(/href=\"\/cv\/?\"/g)||[]).length); console.log('indice:', /home__indice/.test(h)); console.log('flotante:', /descarga-flotante/.test(h)); console.log('anclas:', ['#mapa','#proyectos','#cv'].filter(a=>h.includes('href=\"'+a+'\"')).join(' '));"
```

Esperado: `links a /cv: 0`, `indice: true`, `flotante: true`, `anclas: #mapa #proyectos #cv`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro src/styles/home.css
git commit -m "feat(landing): indice de anclas y descarga flotante, sin JS

El boton Ver el CV pasa de /cv a #cv: esa ruta existe solo para imprimir el
PDF. El indice son anclas y el flotante un <a download> fijo, asi que la
landing no suma un byte de JavaScript.

scroll-behavior se anula aparte bajo prefers-reduced-motion: no es una
animacion y el reset de tokens.css no la alcanza."
```

---

### Task 4: Aislar `/cv` y blindarlo con un test

**Files:**
- Modify: `src/pages/cv.astro`
- Create: `scripts/single-landing.check.ts`
- Modify: `package.json`
- Modify: `.github/workflows/content-validation.yml`

**Interfaces:**
- Consumes: `dist/index.html` y `dist/cv/index.html` del build.
- Produces: `pnpm run test:landing`.

**Contexto:**

Este test es lo que impide que la decisión se desarme sola. Sin él, en tres meses alguien agrega un link "ver CV completo" y nadie se entera. Sigue el patrón de `no-client-js.check.ts`: lee HTML de `dist/` y afirma con regex, y **no** termina en `.test.ts` a propósito porque necesita un build previo.

- [ ] **Step 1: Escribir el check (que va a fallar)**

`scripts/single-landing.check.ts`:

```ts
/**
 * La landing es la única puerta.
 *
 * `/cv` sigue existiendo porque `build-pdf.ts` la imprime, pero dejó de ser un
 * destino: sin links entrantes y sin indexar. Eso es una decisión de UX que se
 * desarma sola —alguien agrega un link "ver CV completo" y nadie se entera— si
 * no hay algo que la sostenga. Esto es ese algo.
 *
 * Además verifica que la sección CV de la landing no se desincronice del PDF:
 * las dos páginas renderizan los mismos componentes, pero con superficies
 * distintas la cantidad de logros dejaría de coincidir en silencio.
 *
 * El nombre NO termina en `.test.ts` a propósito: necesita un build previo.
 * Mismo motivo que `no-client-js.check.ts` y `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";
const landing = await readFile(join(DIST, "index.html"), "utf8");
const cv = await readFile(join(DIST, "cv", "index.html"), "utf8");

test("la landing no linkea `/cv`", () => {
  // Solo la ruta exacta: `/cv.pdf` y `/cv.json` son destinos legítimos y tienen
  // que seguir funcionando.
  const links = [...landing.matchAll(/href="(\/cv\/?)"/g)].map((m) => m[1]);
  assert.deepEqual(
    links, [],
    "la landing volvió a linkear /cv. Esa ruta existe solo para imprimir el " +
    "PDF: el destino del lector es el ancla #cv.",
  );
});

test("`/cv` no se indexa", () => {
  assert.match(
    cv,
    /<meta\s+name="robots"\s+content="[^"]*noindex/,
    "/cv sin noindex: Google la va a indexar y el lector va a caer en una " +
    "página suelta, sin mapa y sin proyectos.",
  );
});

test("la landing tiene las tres anclas del índice", () => {
  for (const id of ["mapa", "proyectos", "cv"]) {
    assert.match(landing, new RegExp(`id="${id}"`), `falta la sección #${id}`);
    assert.ok(landing.includes(`href="#${id}"`), `el índice no apunta a #${id}`);
  }
});

test("la sección CV de la landing no se desincronizó del PDF", () => {
  // `#cv` es la ÚLTIMA sección de la landing, así que todo lo que viene después
  // del marcador es el CV. El botón flotante que le sigue no aporta `<li>`.
  const inicio = landing.indexOf('id="cv"');
  assert.ok(inicio > 0, "no se encontró la sección #cv en la landing");
  const cola = landing.slice(inicio);

  const roles = (html: string) => (html.match(/class="role"/g) ?? []).length;
  // Los logros son `<li>` sin clase propia: `RoleBlock` los mete en un
  // `<ul class="role__bullets">`. Contar `<li>` sobre la cola alcanza.
  const logros = (html: string) => (html.match(/<li[ >]/g) ?? []).length;

  assert.ok(roles(cv) > 0, "`class=\"role\"` ya no existe: actualizá este test");
  assert.equal(
    roles(cola), roles(cv),
    `la landing muestra ${roles(cola)} roles y /cv ${roles(cv)}`,
  );
  assert.equal(
    logros(cola), logros(cv),
    `la landing muestra ${logros(cola)} logros y /cv ${logros(cv)}. ` +
    `Regla 7: \`portfolio\` no topea logros por rol y \`cv-ats\` topea en 5 — ` +
    `alguien cambió la superficie de una de las dos páginas.`,
  );
});

test("la landing NO repite el encabezado del CV", () => {
  // `Header.astro` emite `<h1 class="cv__name">`. El hero de la landing ya
  // tiene su `<h1>`, y dos en una página rompen el orden para un lector de
  // pantalla. La landing arranca su CV en "Perfil".
  assert.ok(!landing.includes("cv__name"), "la landing renderizó <Header> del CV");
  assert.ok(cv.includes("cv__name"), "/cv perdió su <Header>: el PDF necesita el nombre arriba");
});
```

- [ ] **Step 2: Agregar el script y correrlo para verlo fallar**

En `package.json`, después de `"test:bundle"`:

```json
    "test:landing": "tsx --test scripts/single-landing.check.ts",
```

```bash
pnpm run build && pnpm run test:landing
```

Esperado: **falla** el test de `noindex`, con el mensaje "/cv sin noindex...". Los demás tienen que pasar ya (las Tasks 1-3 los dejaron listos). Si falla alguno más, arreglá eso antes de seguir.

Si `role` o `section` no son las clases reales, mirá `RoleBlock.astro` y `Section.astro` y corregí el test con las que emitan.

- [ ] **Step 3: Agregar el `noindex`**

En `src/pages/cv.astro`, dentro del `<Base ...>`, junto al `<script type="application/ld+json" ... slot="head" />`:

```astro
  {/*
    `/cv` existe para que `build-pdf.ts` la imprima, no para que la visiten: el
    lector llega al CV por el ancla `#cv` de la landing. Indexarla partiría en
    dos la única visita, y el que cayera acá no vería ni el mapa ni los
    proyectos. `scripts/single-landing.check.ts` verifica esto.
  */}
  <meta name="robots" content="noindex, follow" slot="head" />
```

`follow` y no `nofollow`: los links del CV apuntan a tu GitHub y tu LinkedIn, y no hay motivo para pedirle a un crawler que los ignore.

- [ ] **Step 4: Verificar que pasa**

```bash
pnpm run build && pnpm run test:landing
```

Esperado: `pass 5`, `fail 0`.

- [ ] **Step 5: Sumarlo a CI**

En `.github/workflows/content-validation.yml`, después del step de `test:bundle`, agregá uno igual con `pnpm run test:landing`, copiando el estilo de los que ya están.

Actualizá también el comentario del encabezado del archivo, que lista la secuencia equivalente local, para incluir `test:landing`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/cv.astro scripts/single-landing.check.ts package.json .github/workflows/content-validation.yml
git commit -m "feat: /cv deja de ser destino, con un test que lo sostiene

noindex y cero links entrantes. La ruta sigue porque build-pdf.ts la imprime
y de ella cuelgan los diez tests de ATS.

El check verifica ademas que la seccion CV de la landing no se desincronice
del PDF: las dos usan cv-ats y los mismos componentes, y si alguien cambia una
superficie los conteos dejan de coincidir en silencio."
```

---

### Task 5: Medir el presupuesto y poner los docs al día

**Files:**
- Modify: `scripts/bundle-budget.check.ts` (solo si la medición lo exige)
- Modify: `docs/04-portfolio.md`
- Modify: `docs/00-indice.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-21-single-landing-design.md`

- [ ] **Step 1: Medir**

```bash
pnpm run build
node -e "const {gzipSync}=require('zlib');const fs=require('fs');for(const f of ['dist/index.html','dist/cv/index.html']){const b=fs.readFileSync(f);console.log(f.padEnd(22),(b.length/1024).toFixed(1).padStart(6)+' KB',' gzip',(gzipSync(b).length/1024).toFixed(1).padStart(5)+' KB');}"
```

Antes de este plan: la landing daba **8.7 KB gzip** contra un techo de 30.

- [ ] **Step 2: Ajustar el techo solo si hace falta**

```bash
pnpm run test:bundle
```

Si pasa, **no toques nada**. Si falla, subí `TECHO_HTML_KB` en `scripts/bundle-budget.check.ts` al valor medido más ~20% de margen, y actualizá el comentario del const con el número medido y la fecha — igual que hacen los otros techos del archivo. Nunca a ojo.

- [ ] **Step 3: Correr la secuencia completa**

```bash
pnpm run typecheck && pnpm run validate && pnpm test && pnpm run build && pnpm run test:pdf && pnpm run test:js && pnpm run test:bundle && pnpm run test:landing && pnpm run audit:todos
```

Todos verdes salvo `audit:todos`, que reporta sin bloquear.

- [ ] **Step 4: Actualizar los docs**

`docs/04-portfolio.md` §1: la estructura pasa a ser la del spec §3 (Hero → índice → mapa → proyectos → CV), con "Casos" marcado como hecho en su versión de lista compacta y el formato caso de estudio del §2 anotado como pendiente de que se escriban `problem.short` y `outcome.short`.

`docs/00-indice.md`: sumá a las decisiones fechadas —2026-08-21— que el sitio pasa a ser una landing única y que `/cv` queda como fuente de impresión, con `noindex` y sin links, sostenido por `single-landing.check.ts`. En Estado, marcá los proyectos como hechos y dejá anotado que los `links` siguen vacíos.

`CLAUDE.md`: en el mapa de archivos, `pages/cv.astro` pasa a decir que no es un destino navegable; sumá `components/proyectos/`, `styles/proyectos.css` y `scripts/single-landing.check.ts`. En §Comandos, sumá `pnpm run test:landing` y actualizá la secuencia completa.

`README.md`: la descripción del sitio pasa de dos páginas a una landing; sumá `test:landing` a la lista de comandos.

En el spec, cambiá el estado de la cabecera a **implementado** con la fecha.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: landing unica implementada, y presupuesto medido

Registra la estructura nueva en docs/04, la decision fechada en docs/00 y el
comando test:landing en CLAUDE.md y README."
```

---

## Lo que queda abierto

**Los links de los proyectos.** Los tres tienen `links: []`. La sección funciona y renderiza el link solo cuando existe, así que cargarlos después es editar `content/data/content.es.json` y buildear — no toca código. Es lo único del spec que no se puede terminar sin el autor.

**El formato caso de estudio** (`docs/04` §2) sigue pendiente de que se escriban `problem.short` y `outcome.short` en `jwd-maderas` y `wp-plugins`.
