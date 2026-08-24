# 04 — Portfolio

Dos objetivos a la vez: convencer a un equipo que contrata y cerrar clientes freelance. Y dos lectores: el humano y el agente.

---

## 1. Estructura

Desde el 2026-08-24 el sitio es **una sola página navegable**. El orden real
es el del spec de la landing única §3:

```
┌─ Hero          nombre, rol, tagline, contacto                    [hecho]
│  Índice        Mapa · Proyectos · CV  (anclas, sin JS)           [hecho]
├─ #mapa         Mapa de conocimiento. Ver §7.                     [hecho]
├─ #proyectos    Proyectos, con link público                       [hecho]
├─ #cv           El CV completo, superficie cv-ats                 [hecho]
└─ [↓ PDF]       botón flotante, acompaña todo el scroll           [hecho]
```

Lo que sigue pendiente:

```
Servicios       → qué te pueden contratar a hacer (lado freelance). [pendiente]
Sobre mí        → historia corta, con voz. No un CV repetido.       [pendiente]
```

**"Casos" está hecho en su versión de lista compacta, no en el formato caso de
estudio del §2.** Esa versión larga —problema → decisión → resultado— sigue
pendiente porque `problem.short` y `outcome.short` tienen `TODO` en dos de los
tres proyectos, y llenarlos a ojo viola el invariante 4. Los `links` de los tres
también están vacíos: el componente renderiza el link solo cuando existe, así
que cargarlos es editar el dataset, no tocar código.

El contacto sigue en el hero y no en el pie: en una sola página, bajarlo lo
esconde detrás de todo el CV.

**El Stack no es una grilla de logos.** Ver §7: es un grafo, y el tamaño de cada
tecnología es un dato derivado, no una opinión.

**Blog:** opcional, pero si se abre hay que sostenerlo. Un blog con tres posts viejos resta más de lo que suma.

## 2. Formato de caso de estudio

```
[Nombre]  ·  [Rol]  ·  [Año]

El problema     → 2 frases sobre el negocio, no sobre la tecnología.
Qué construí    → 3 bullets.
Decisiones      → 2 decisiones técnicas con su porqué y su trade-off.
Resultado       → número, o antes/después cualitativo.
Stack           → lista.
Links           → demo en vivo + repo si es público.
Evidencia       → captura, GIF corto o video de 20s. No un mockup vacío.
```

**El bloque de decisiones es el diferencial.** Casi ningún portfolio lo tiene, y es lo único que un hiring manager técnico lee con atención de verdad. En el schema es `TechnicalDecision`, y el campo `tradeoff` es obligatorio: si no hay trade-off, no era una decisión.

### Los tres casos

| Proyecto | Qué demuestra |
|---|---|
| **JWD Maderas** | Producto completo para un negocio real, con resultado medible. Next.js + Sanity. |
| **Mapas de distritos** | Profundidad técnica poco común: datos geoespaciales, Mapbox GL JS, resolución de problemas de renderizado. |
| **Plugins de WordPress con tooling moderno** | Trabajar en entornos legacy sin romperlos. En freelance esto vende muchísimo. |

Los tres están cargados en el dataset con `featured: true` y su `slug`. Faltan los `problem` y `outcome` de dos de ellos, y todo el material visual.

**Proyectos privados:** se pueden mostrar sin links. `links: []` y `clientDescription` en vez de `client`. Vale la pena si el caso técnico es fuerte.

## 3. Capa legible por máquinas

Cada vez más reclutadores pegan la URL del portfolio en un LLM y preguntan si el candidato sirve. Que la respuesta sea buena depende de esto — y de paso es una demostración de la habilidad que se está vendiendo.

- **JSON-LD `Person` server-rendered** en el `<head>`. No inyectado por JS: los crawlers no lo ejecutan.
  - `name`, `jobTitle` (usar `searchTitle`), `knowsAbout` con el stack, `sameAs` con LinkedIn y GitHub, `@id` estable.
- **`schema.org/CreativeWork`** en cada caso de estudio.
- **`/llms.txt`** en la raíz: resumen en markdown de quién sos, stack y proyectos, con links.
- **`/cv` en HTML** además del PDF. El HTML se parsea perfecto; el PDF es para adjuntar.
- **`/cv.json`** con el dataset filtrado por la superficie `public-api`.
- Semántica real: un solo `<h1>` con nombre y rol, headings jerárquicos, `alt` descriptivo en cada imagen (regla 5 del contrato lo valida).

Todo esto se genera del mismo dataset. La superficie `public-api` ya excluye los datos de contacto privados.

## 4. Lado freelance

El cliente que llega al portfolio buscando contratar no mira la arquitectura: mira si resolviste un problema parecido al suyo. Para ese visitante:

- **Servicios** (`Service` en el schema): qué hacés, para quién, qué entregás. El campo `idealFor` filtra los leads malos antes de que escriban.
- **Rango de precios**: publicarlo filtra consultas; no publicarlo genera más volumen de peor calidad. Decisión abierta.
- **Testimonios** (`Testimonial`): solo con `approved: true`. La regla 6 lo valida.
- **JWD Maderas es el caso principal para este público**, no los mapas.

## 5. Advertencia

Un portfolio con backend propio no impresiona por existir: hay miles. Impresiona si el caso de estudio explica las decisiones. Y el backend es invisible para el cliente freelance — a ese lo convence el resultado de JWD Maderas.

Por eso el orden es: portfolio online primero con JSON en el repo, backend después. Ver [CONTRATO.md](./CONTRATO.md), sección 5.

## 6. Pendiente de investigar

Quedó abierta una segunda investigación sobre patrones de portfolios de referentes: estructura, tipografía y paletas, cómo presentan proyectos, qué errores se repiten en portfolios senior, cómo incorporan la IA a su marca.

**Se decidió avanzar sin ella** (2026-08). El plan original era investigar antes de tocar el diseño visual; en cambio se construyó primero el mapa de conocimiento (§7) y se lo puso de portada. El motivo: el mapa no es una decisión estética sino la única superficie que muestra el grafo de datos, y postergarlo por una investigación de tipografías era postergar lo que diferencia al sitio por lo que lo hace parecido a otros.

Lo que la investigación **sigue** teniendo que resolver, y hoy está sin decidir: tipografía y paleta más allá de los tokens actuales, y cómo se presentan los casos de estudio. Hacerla antes de escribir el §2, no después.

## 7. El mapa de conocimiento

Es la portada. Cruza logros, roles, proyectos y tecnologías como grafo — la única vista que aprovecha que los `Achievement` viven sueltos (CONTRATO §3) en vez de anidados en cada trabajo.

**Qué dice el dibujo:**

- **El tamaño de una tecnología** = años de uso × cantidad de conexiones, por raíz (el ojo compara área, no radio). Los años salen de `Skill.since` o, si no está, del span de la evidencia fechada que la respalda. Nunca se estiman (invariante 4).
- **La posición** = los trabajos en la corteza, las tecnologías en el núcleo. Núcleo = lo que sé, corteza = dónde lo usé.
- **Las tecnologías sin evidencia** se dibujan chicas y huecas, agrupadas en el centro. Son las que declarás pero todavía no tienen un logro que las demuestre. **El mapa muestra el hueco en vez de taparlo** — y eso es a propósito: es el mismo criterio que la advertencia del §5.

**Por qué esto convence y una grilla de logos no:** una grilla afirma; el grafo muestra la evidencia. Un nodo grande lo es porque hay logros fechados detrás, y se puede clickear para ver cuáles.

**Costo:** es la única página del sitio con JavaScript. El camino crítico son 4 KB gzip; `three` (127 KB) baja recién cuando el mapa entra en pantalla, y solo si el dispositivo lo aguanta. Sin JavaScript el mapa sigue completo en SVG, hover cruzado incluido. `/cv` sigue en cero — de ahí sale el PDF.
