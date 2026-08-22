# Spec — Landing única: mapa, proyectos y CV en una sola página

Fecha: 2026-08-21
Estado: **aprobado**, pendiente de implementar.

Reemplaza la navegación de dos páginas por una landing sola. `/cv` deja de ser
un destino y pasa a ser lo que siempre fue por debajo: la fuente de impresión
del PDF.

---

## 1. Qué problema resuelve

Hoy el sitio son dos páginas linkeadas entre sí: la home con el mapa, y `/cv`.
Un CV no necesita navegación — el lector quiere leer y bajarse el PDF, no
elegir secciones de un menú. Dos páginas obligan a un ida y vuelta que no le
sirve a nadie, y parten en dos la única visita que vas a tener.

Además falta la sección que `docs/04` §1 tiene pendiente desde el principio:
un lugar donde los proyectos sean visibles y **linkeables**. Hoy los proyectos
existen en el dataset, salen en el mapa como nodos, y no hay una sola URL
pública apuntándoles.

## 2. Qué NO cambia, y por qué importa

**`/cv` sigue existiendo como ruta.** Esto es lo primero que hay que entender
del diseño, porque parece contradecir el objetivo.

`build-pdf.ts` levanta `dist/`, entra a `/cv` con Chromium y lo imprime. De esa
ruta cuelgan diez tests (`pdf-output.check.ts`) que garantizan que un ATS
extraiga el nombre, las empresas, los títulos de rol y los bullets enteros; que
el PDF salga tagged y con outline; que no exceda dos páginas; y que ni el
teléfono ni la dirección se filtren (regla 8). `cv.css` no usa flex, grid ni
tablas porque eso es lo que rompe el orden de extracción del texto.

La objeción del autor era de UX: **botones de navegación**, no rutas. Se
resuelve entera sacando los links, no la ruta:

- `/cv` no se linkea desde ningún lado.
- `/cv` lleva `<meta name="robots" content="noindex">`.
- Un test verifica las dos cosas. Sin ese test, en tres meses alguien agrega un
  link "ver CV completo" y la decisión se desarma sin que nadie se entere.

Se evaluaron dos alternativas y se descartaron:

| Alternativa | Por qué no |
|---|---|
| Imprimir el PDF desde la landing | Hay que esperar `networkidle` en una página con JS y dos canvas WebGL — frágil. Y la sección del CV necesitaría igual su propio CSS estricto, porque la landing usa flex/grid en todos lados |
| Subir el PDF a mano | El PDF y el sitio se desincronizan apenas cambie un dato. Es exactamente lo que todo el sistema de contenido existe para evitar |

## 3. Estructura de la landing

```
┌─ Hero          nombre, rol, tagline, contacto
│  Índice        Mapa · Proyectos · CV        (anchors)
├─ #mapa         Mapa de conocimiento
├─ #proyectos    Proyectos, con link público
├─ #cv           El CV completo
└─ [↓ PDF]       botón flotante, acompaña todo el scroll
```

El orden va de lo general a lo específico y sigue cómo lee un reclutador: el
mapa engancha porque no lo tiene nadie más, los proyectos son la evidencia
concreta, y el CV es el registro formal — el bloque más largo, y el que ya
sabés que vas a encontrar.

### Los botones del hero

Hoy el hero tiene dos: "Ver el CV" (apunta a `/cv`) y "Descargar en PDF".

- **"Ver el CV"** pasa a ser un ancla a `#cv`. Si quedara apuntando a `/cv`, el
  test de §9 falla — y con razón: es exactamente el link que la decisión saca.
- **"Descargar en PDF"** se queda en el hero. El botón flotante no lo reemplaza:
  el flotante existe para el que ya scrolleó, el del hero para el que decide en
  los primeros diez segundos. Los dos apuntan a `/cv.pdf`.

## 4. Superficies

La landing resuelve **dos vistas**, igual que `cv.astro` hoy resuelve `cv-ats`
más `public-api`.

| Sección | Superficie | Por qué |
|---|---|---|
| Hero, mapa, proyectos | `portfolio` | Sin recorte: el mapa necesita todos los logros para que el grafo tenga sentido |
| Sección CV | `cv-ats` | Tiene que ser **idéntica al PDF** |

Esto no es un detalle. Las dos superficies difieren de verdad:

```
              PRIORITY_CUTOFF   MAX_ACHIEVEMENTS_PER_ROLE
cv-ats              3                    5
portfolio           5                  null
```

Con `portfolio`, la sección CV mostraría más logros de los que salen impresos,
mientras el botón flotante promete descargar "el CV". Serían dos cosas
distintas con el mismo nombre. Con `cv-ats`, lo que ves es lo que descargás.

## 5. Componentes

**El CV se renderiza con los mismos `components/cv/*` en las dos páginas.** Son
componentes tontos: reciben props ya resueltas y no filtran nada (invariante 1).
Que el layout tenga una sola fuente es lo que impide que la sección de la
landing y el PDF se desincronicen.

`cv.css` se carga en las dos. Está acotado a `.cv` y a `@page`, así que no
derrama estilos sobre el resto de la landing.

El JSON-LD `Person` queda en la landing, que es la página que se indexa. `/cv`
lo conserva o lo pierde indistintamente: con `noindex` ningún crawler lo va a
leer. Se deja como está para no tocar `cv.astro` más de lo necesario.

**Proyectos** es un componente nuevo. Por proyecto: nombre, `solution.short`, el
stack, y el link público **solo si existe**.

Se eligió lista compacta y no el caso de estudio completo de `docs/04` §2
porque `problem.short` y `outcome.short` todavía tienen TODO en dos de los tres
proyectos. `solution.short` está limpio en los tres, así que la sección se llena
hoy con datos reales. El caso de estudio queda para cuando esos campos estén
escritos.

## 6. El puente con el mapa sale gratis

`buildHoverCss` ya genera reglas `:has()` para **todos** los nodos del grafo, no
solo para las skills de la lista — incluidos los tres `project:*`. Hoy nada en
el DOM tiene esos ids, así que esas reglas no se usan.

Dándole a cada tarjeta de proyecto `id={ID_ITEM(n.id)}` y `data-node`, pasar el
mouse por la tarjeta enciende su nodo en el mapa, y al revés. **Sin JavaScript**,
con código que ya está escrito y probado. Es la misma promesa del spec §3.3 que
ya cumple la lista de tecnologías.

## 7. Sin JavaScript nuevo

Ni el índice ni el botón flotante agregan un byte de JS:

- **Índice**: anchors (`#mapa`, `#proyectos`, `#cv`) más `scroll-behavior: smooth`
  en CSS, anulado bajo `prefers-reduced-motion` como ya hace `tokens.css`.
- **Botón flotante**: un `<a download>` con `position: fixed`. Vive fuera del
  contenedor del mapa, así que no le roba eventos de puntero. Escondido en
  `@media print`.

La landing sigue siendo la única página con JS, y ese JS sigue siendo solo el
del mapa. `/cv` sigue en cero.

## 8. Presupuesto

Medición previa a implementar:

```
dist/index.html      50.3 KB    8.7 KB gzip     (techo: 30 KB)
dist/cv/index.html    9.7 KB    3.2 KB gzip
```

Sumar el CV y los proyectos deja la landing cerca de **12 KB gzip**, bastante
por debajo del techo. `TECHO_HTML_KB` probablemente **no haga falta tocarlo**.

Si la medición real dice otra cosa, se sube al número medido más margen y se
escribe por qué — nunca a ojo, o el check deja de significar algo.

## 9. Checks

| Check | Cambia |
|---|---|
| `no-client-js.check.ts` | No. `/cv` sigue en cero, la landing ya está en la lista blanca |
| `pdf-output.check.ts` | No. Sigue imprimiendo `/cv` |
| `bundle-budget.check.ts` | Solo si la medición lo exige (§8) |
| **nuevo** | `/cv` no está linkeada desde la landing y tiene `noindex` |

## 10. Bloqueado por datos

Los tres proyectos tienen `links: []`:

```
jwd-maderas      in-progress   links: []
mapas-distritos  shipped       links: []
wp-plugins       shipped       links: []
```

La sección se construye igual y renderiza el link solo cuando existe, pero
**hasta que el autor pase las URLs reales va a ser una lista sin links**. No se
inventan (invariante 4).

Es lo único del spec que no se puede terminar sin él.

## 11. Reglas que esto rompe

- **`docs/04` §1** listaba "Casos" como pendiente y ponía Contacto al final. La
  estructura de §3 lo reemplaza. Hay que actualizarlo.
- **La home dejó de ser mínima** — ya estaba registrado el 2026-08-21 cuando el
  mapa pasó a ser la portada.
- Ninguna otra. El punto §2 es que la UX pedida se consigue **sin** romper la
  costura del PDF, que era lo único realmente caro de romper.
