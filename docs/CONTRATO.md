# El contrato — reglas del sistema de contenido

Acompaña a `content-schema.ts`. El schema define la forma; esto define las reglas que la forma no puede expresar sola.

---

## 1. Reglas duras (deberían ser tests, no buenas intenciones)

Estas se validan en CI. Si fallan, no deployea.

| # | Regla | Por qué |
|---|-------|---------|
| 1 | **Ninguna duración escrita a mano.** Todo se deriva de `careerStart`, `start` y `end`. | Es la causa raíz de las tres antigüedades distintas que tenés hoy. |
| 2 | **No puede haber dos roles `full-time` superpuestos** salvo que uno tenga `concurrent: true`. | Bandera roja automática en revisión humana y en la capa de IA. |
| 3 | **Toda `Skill` con `level: "core"` necesita ≥1 `Achievement` que la referencie.** | Si no podés mostrar dónde la usaste, no la reclames. Esto te obliga a poder defender cada línea. |
| 4 | **Toda `Metric` con `confidence: "estimated"` se renderiza con "~" o "aprox."** | Un número inventado que se cae en la entrevista cuesta más que no tener número. |
| 5 | **Todo `Media` necesita `alt`.** | Accesibilidad + los agentes leen el alt. |
| 6 | **`Testimonial.approved: false` nunca se renderiza.** | Obvio, pero es el tipo de cosa que se filtra. |
| 7 | **`cv-short` no puede exceder N items.** Corta por `priority`. | Fuerza la decisión editorial en los datos, no en el maquetado. |
| 8 | **`streetAddress` y `phone` solo salen en las superficies listadas explícitamente.** | Tu dirección de calle no tiene por qué circular en PDFs subidos a portales. |

---

## 2. Cómo cada superficie consume los datos

| Superficie | Qué usa | Qué ignora |
|---|---|---|
| `cv` | `summary.short`, roles con achievements `priority ≤ 3`, `text.short`, skills activas agrupadas | `decisions`, `services`, `testimonials`, `Prose.long` |
| `cv-short` | Igual pero `priority ≤ 2`, máximo 3 bullets por rol | Roles de más de 8 años atrás |
| `cv-ats` | Mismo contenido que `cv`, sin diseño, una columna, sin íconos | Todo lo visual |
| `portfolio` | Todo. `Prose.long`, `decisions`, `media`, `services`, `testimonials` | Nada, salvo `except: ["portfolio"]` |
| `linkedin` | Bloques generados: titular, About, un párrafo por rol | Formato de bullets del CV (LinkedIn los renderiza distinto) |
| `public-api` | Dataset filtrado → `/cv.json`, JSON-LD `Person`, `llms.txt` | Datos de contacto privados |

**Un solo lugar decide qué entra:** la implementación de `getView()`. El frontend nunca filtra por `visibility`; recibe listas ya resueltas.

---

## 3. Las cuatro decisiones de diseño que importan

**`Prose` con `short` y `long` en vez de un solo texto recortado.** El bullet del CV y el párrafo del portfolio no son la misma frase en dos tamaños: son dos registros distintos. Uno es telegráfico y denso en keywords; el otro respira y explica. Un `truncate()` los arruina a los dos.

**Los `Achievement` viven sueltos, no anidados dentro de `Role`.** Así podés consultarlos por skill ("todo lo que hice con Mapbox"), por dimensión ("mostrame mis logros de arquitectura") o por proyecto. Un CV típico solo puede listarlos cronológicamente; tu portfolio va a poder cruzarlos. Eso es una feature que casi nadie tiene y que sale gratis del modelo de datos.

**`brandTitle` separado de `searchTitle`.** Product Engineer es quién sos; Desarrollador Full Stack es lo que se tipea en un buscador. El sistema emite el que corresponde según la superficie, sin que tengas que acordarte.

**`Skill.aliases`.** El generador de CV-por-aviso puede emitir la variante exacta que usa la oferta ("Vue.js" y no "Vue") sin que vos edites nada. Los parsers viejos matchean literal; la capa LLM ya razona sinónimos, pero la vieja corre primero.

---

## 4. Lo que el schema NO hace a propósito

- **No hay campo `yearsOfExperience`.** Se calcula. Si existiera como dato, se desincronizaría.
- **No hay niveles de skill de 1 a 5.** Tres valores defendibles en entrevista, y listo. Las barritas de progreso no las lee ningún parser y a los técnicos les generan desconfianza.
- **No hay i18n por campo.** Un dataset por idioma. Traducir un CV campo por campo produce inglés traducido, que es peor que inglés escrito.
- **No hay estado de postulaciones.** Es otro dominio. Si lo querés, va en otro sistema.

---

## 5. Orden de implementación

1. **Definir los tipos** (`content-schema.ts`) y validarlos con Zod. Los mismos schemas de Zod te sirven después para validar lo que venga del backend.
2. **Cargar tus datos reales en un JSON tipado en el repo.** Acá es donde vas a descubrir qué métricas no tenés. Ese ejercicio vale por sí solo.
3. **Implementar `ContentSource` sobre ese JSON.** El front consume solo la interfaz.
4. **Construir las vistas:** portfolio, `/cv` en HTML, JSON-LD, `llms.txt`.
5. **Generadores de salida:** PDF (Puppeteer o React-PDF) y bloques de texto para LinkedIn.
6. **Recién ahí:** mover el storage a Sanity o a backend propio. Es cambiar el paso 3.

Los pasos 1 a 4 se hacen en un fin de semana y ya te dejan el portfolio online. El 6 puede esperar todo lo que haga falta.

---

## 6. Decisiones abiertas

- **¿`services` y `testimonials` ahora o después?** Los dejé en el schema porque agregarlos después obliga a migrar. Podés tenerlos vacíos.
- **¿El dataset en inglés existe desde el día 1?** Dijiste español y freelance local. El schema lo soporta; yo no lo cargaría todavía.
- **¿Los repos privados de laburo entran como `Project` sin links?** Se puede: `links: []` y `clientDescription` en vez de `client`. Vale la pena si el caso técnico es fuerte.
