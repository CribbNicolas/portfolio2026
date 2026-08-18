# Spec — Sistema visual: 3 direcciones a explorar

Fecha: 2026-08-14
Estado: **resuelto. Dirección elegida: C — «Producto»** (2026-08-14).

Las tres se maquetaron con datos reales y viven en `docs/design/`. La elegida
está implementada en la Task 3 del plan
`docs/superpowers/plans/2026-08-13-cv-como-sistema.md`, y se aplica tanto a
`/cv` como a la home. Las direcciones A y B quedan en el repo como registro de
lo que se descartó y por qué — sirven si más adelante hay que revisar la
decisión.

Documento para entregarle a un agente de diseño. Define lo **no negociable**, el
**sistema base compartido**, y **tres direcciones** que difieren en personalidad,
no en fundamentos. El objetivo es poder comparar tres cosas que se diferencian
por lo que comunican, no por lo que arreglan.

---

## 0. Advertencia sobre el proceso

`docs/04-portfolio.md` §6 dice que la investigación de portfolios de referencia
conviene hacerla **antes** de decidir el diseño visual. No se hizo.

Consecuencia honesta: estas tres direcciones son **hipótesis**, no conclusiones.
Sirven para descubrir qué le gusta al autor viendo cosas concretas —que es más
rápido que describirlo en abstracto— pero no reemplazan esa investigación. Si al
ver las tres ninguna cierra, el paso siguiente es la investigación, no una cuarta
propuesta.

## 1. Qué se está diseñando

Solo dos superficies. El portfolio con casos de estudio es otro slice.

| Superficie | Qué es | Quién la lee |
|---|---|---|
| `/cv` | El CV completo en HTML. **De esta misma página se imprime el PDF** | Un parser, un LLM, y un humano con 10-30 segundos |
| `/` | Home mínima: quién sos, qué construís, links, descarga del CV | Un visitante que llegó por LinkedIn o por el mail de una postulación |

El sistema tiene que **anticipar** los casos de estudio (problema → decisión →
resultado, con imágenes y bloques de código) sin diseñarlos ahora.

## 2. A quién le habla — la tensión central

Dos lectores con expectativas opuestas, y el diseño tiene que servir a los dos:

| Lector | Qué lo convence | Qué lo espanta |
|---|---|---|
| **Hiring manager técnico** | Densidad, precisión, decisiones técnicas con trade-offs | Marketing, adjetivos, decoración sin función |
| **Cliente freelance** (ej. una maderera del interior) | Que el sitio se vea prolijo y cargue rápido en un celular con mala señal | Jerga, oscuridad, cosas que parecen "de programador" |

`docs/02-branding.md` nombra la misma tensión en el copy: **Product Engineer** es
la identidad de marca, **Desarrollador Full Stack** es la identidad de búsqueda.
Las tres direcciones de la §6 son tres formas distintas de resolver esa tensión.

## 3. No negociables

Una propuesta que rompa cualquiera de estos puntos no se evalúa, se descarta.

### 3.1 Estructura de `/cv` — porque de ahí sale el PDF

`docs/01-filtros-y-seleccion.md` §1 documenta que si el parseo falla, nada más
importa. `docs/01` §3 también desarma el mito opuesto: **el diseño no rompe el
parseo, lo rompe la estructura.** Se puede tener un CV lindo. No se puede tener
un CV en dos columnas.

- **Una sola columna.** El orden del DOM es el orden en que se extrae el texto.
- **Prohibidos en `/cv`:** `display: flex`, `display: grid`, `<table>` para
  maquetar, `position: absolute`, sidebars, headers/footers de página.
  No porque flex sea malo, sino porque prohibirlo elimina el juicio caso por caso
  sobre si el orden visual sigue coincidiendo con el orden del DOM.
- **Un solo `<h1>`**, con nombre y título buscable.
- **`<h2>` con nombres estándar:** `Perfil`, `Habilidades técnicas`,
  `Experiencia`, `Educación`, `Idiomas`. Un parser mapea esos títulos a campos.
  "Mi stack" no mapea a nada.
- **Ningún ícono carga significado.** `Email:` escrito, no un sobrecito.
- **Nada de barras de progreso ni puntos de nivel** para skills. Ningún parser
  los lee y a un técnico le generan desconfianza.
- **Máximo 2 páginas A4** impresas.
- **La versión impresa es siempre clara** (fondo claro, tinta oscura),
  independientemente del modo en pantalla.

La decoración disponible es: tipografía, peso, tamaño, color, espaciado y
líneas divisorias. Alcanza. La restricción es el ejercicio.

### 3.2 Tipografía

- **Máximo 2 familias, máximo 4 pesos en total.** Cada peso es un archivo que
  se embebe en el PDF.
- **Self-hosteadas y disponibles como `woff2` vía npm** (`@fontsource/*` o
  equivalente). Nada de Google Fonts por CDN: el PDF tiene que salir idéntico en
  Windows y en el Ubuntu de CI, y el sitio no puede depender de un tercero.
- **Ligaduras apagadas en `/cv`** (`font-variant-ligatures: none`): un `fi`
  ligado se extrae como un glifo raro y ensucia el texto que lee el parser.

### 3.3 Accesibilidad y performance

- **Contraste WCAG AA**: 4.5:1 en texto de cuerpo, 3:1 en texto grande y en
  bordes que comunican estado. En los dos modos si hay dos modos.
- **Foco visible** en todo lo interactivo. No `outline: none` sin reemplazo.
- **`prefers-reduced-motion` respetado.** Toda animación es opcional.
- **Cero JavaScript de cliente por defecto.** El stack es Astro estático. Si una
  propuesta necesita JS, tiene que degradar a algo usable sin él.
- **Mobile-first real.** El cliente freelance entra desde un celular.

### 3.4 Anti-checklist — lo que ninguna de las tres puede hacer

- Barras de progreso, radar charts o porcentajes de skill.
- Ilustraciones de stock, blobs, gradientes de moda sin función.
- Un hero que diga algo que otro dev con el mismo stack podría firmar idéntico
  (es el test de voz de `docs/02` §8, aplicado al diseño).
- Carruseles, scroll hijacking, cursores custom, splash de carga.
- Modo oscuro que en `/cv` se imprima oscuro.
- Fotos con texto adentro.

## 4. Sistema base compartido

Las tres direcciones comparten esta estructura y la rellenan distinto. Se
entrega como CSS custom properties.

```css
:root {
  /* Color por ROL, nunca por nombre de color. Cada dirección da sus valores. */
  --fondo:            /* superficie de la página */
  --fondo-elevado:    /* tarjetas, bloques destacados */
  --tinta:            /* texto principal */
  --tinta-suave:      /* metadatos, fechas, contexto */
  --acento:           /* UN solo acento. Links y énfasis */
  --acento-tenue:     /* fondos de énfasis */
  --linea:            /* divisores y bordes */

  /* Tipografía */
  --fuente-titulo:
  --fuente-cuerpo:
  --escala:           /* razón de la escala modular: 1.2 densa, 1.333 aireada */

  /* Espaciado: una sola unidad base y múltiplos. Nada de valores sueltos. */
  --espacio-base:     /* 4px u 8px */

  /* Forma */
  --radio:            /* 0 a 12px. Comunica más de lo que parece */
  --sombra:           /* o ninguna */
}
```

Reglas del sistema, iguales para las tres:

- **Un acento, no una paleta.** Un color que hace algo, el resto neutros.
- **Escala modular**, no tamaños arbitrarios.
- **Espaciado en múltiplos de la unidad base**, sin excepciones.
- **La jerarquía se hace con tamaño, peso y espacio antes que con color.** Si el
  diseño sobrevive en blanco y negro, la jerarquía es real.

## 5. Cómo se decide entre las tres

Criterios de evaluación, en orden de peso:

1. **Test de voz aplicado al diseño.** ¿Otro dev con el mismo stack podría haber
   elegido esto? Si sí, no está diferenciando nada.
2. **¿Sobrevive impreso en blanco y negro?** Si la jerarquía se cae sin color,
   estaba sostenida por decoración.
3. **¿Sirve a los dos lectores** de la §2, o elige uno y abandona al otro?
4. **¿El contenido manda?** El CV tiene poco contenido y sin métricas todavía.
   Un diseño que necesita mucho contenido para verse bien va a verse mal hoy.
5. **Contraste AA verificado**, no estimado.

---

## 6. Las tres direcciones

Cada una responde distinto a la misma pregunta: **¿qué señal manda el sitio
antes de que alguien lea una palabra?**

### Dirección A — «Documento»

> **Principio:** el contenido es el diseño. Todo lo demás se corre del camino.

Referencia mental: un paper bien tipografiado, un memo de consultora, la
tipografía de un libro. Blanco dominante, márgenes generosos, una serif de texto
con buen color de página, líneas hairline como único ornamento, casi nada de
color.

| | |
|---|---|
| **Tipografía** | Serif de texto para cuerpo y títulos (Source Serif 4, Newsreader o Literata). Opcionalmente una sans neutra solo para metadatos |
| **Color** | Papel cálido (`#faf9f6`-ish) o blanco puro, tinta casi negra, **un** acento sobrio (azul tinta o borgoña) solo en links |
| **Escala** | Aireada (1.333). Line-height alto. Medida de línea 65-75 caracteres |
| **Forma** | `--radio: 0`. Sin sombras. Divisores de 1px |
| **Densidad** | Baja. El espacio en blanco es el recurso principal |
| **Movimiento** | Ninguno, o solo transición de color en links |

**Qué señala:** criterio, calma, alguien que respeta el tiempo del lector. Es la
dirección que mejor le queda al CV, porque el CV *es* un documento.

**Riesgo:** puede leerse como académico o anticuado, y no comunica "construyo
productos". El cliente freelance puede percibirlo como poco moderno.

**Cómo se ve el fracaso:** una plantilla de currículum de Word con mejor fuente.

---

### Dirección B — «Consola»

> **Principio:** el sitio es una demostración de la habilidad que vende.

Referencia mental: documentación técnica buena, un dashboard sobrio, un editor de
código. Monoespaciada para todo lo que es dato (fechas, IDs, stack, métricas),
sans neutra para la prosa. Oscuro por defecto con claro disponible, alto
contraste, un acento saturado, grilla visible.

| | |
|---|---|
| **Tipografía** | Mono para datos y metadatos (JetBrains Mono, IBM Plex Mono) + sans neutra para prosa (Inter, IBM Plex Sans) |
| **Color** | Oscuro por defecto: fondo `#0d1117`-ish, tinta clara, acento saturado (verde terminal, cyan o ámbar). **Claro obligatorio para imprimir** |
| **Escala** | Densa (1.2). Line-height ajustado. Más información por pantalla |
| **Forma** | `--radio: 2-4px`. Bordes visibles en vez de sombras |
| **Densidad** | Alta. Etiquetas explícitas, datos alineados en columnas visuales (sin usar grid en `/cv`: con tabulación tipográfica) |
| **Movimiento** | Mínimo y funcional: estados de foco y hover marcados |

**Qué señala:** profundidad técnica. Conecta directo con el diferencial de
`docs/02` §3 (datos geoespaciales, entornos legacy) y con el hiring manager
técnico.

**Riesgo:** es el cliché más frecuente del portfolio de desarrollador — mucha
gente hace exactamente esto, así que puede fallar el criterio 1. Y el cliente
freelance de una maderera puede no conectar con una estética de terminal.

**Cómo se ve el fracaso:** verde neón sobre negro, efecto typewriter en el hero,
y la sensación de haber visto el mismo sitio doscientas veces.

---

### Dirección C — «Producto»

> **Principio:** el sitio se ve como el producto que el autor construiría para un
> cliente.

Referencia mental: una landing de producto hecha con criterio. Sans geométrica o
humanista, superficies claras con un elevado sutil, un color cálido como acento,
jerarquía por tamaño y peso, espaciado consistente y evidente.

| | |
|---|---|
| **Tipografía** | Una sans de buen carácter para todo (Manrope, Plus Jakarta Sans, Instrument Sans), con los pesos haciendo la jerarquía |
| **Color** | Neutro claro de base, un acento cálido (terracota, ámbar, índigo cálido). Modo oscuro opcional |
| **Escala** | Intermedia (1.25). Títulos con presencia real, cuerpo cómodo |
| **Forma** | `--radio: 8-12px`. Sombras suaves permitidas en `/`, ninguna en `/cv` |
| **Densidad** | Media. Bloques claramente separados |
| **Movimiento** | Micro-transiciones en hover y foco. Nada de scroll-triggered |

**Qué señala:** Product Engineer. Es la que mejor le habla al cliente freelance
y la que mejor va a envejecer cuando lleguen los casos de estudio con imágenes.

**Riesgo:** es la más fácil de que termine pareciéndose a mil templates de SaaS.
Todo depende de que el carácter tipográfico y el acento sean elecciones y no
defaults.

**Cómo se ve el fracaso:** gradiente violeta, tarjetas con sombra, y un hero que
dice "Construyo experiencias digitales".

---

## 7. Qué entregar por cada dirección

Lo mismo para las tres, para que sean comparables:

1. **Bloque de tokens** en CSS custom properties, con los valores concretos de la
   §4, incluyendo la variante de impresión.
2. **`/cv` completa**, en dos vistas: desktop y A4 impreso. Con las secciones
   `Perfil`, `Habilidades técnicas`, `Experiencia`, `Educación`, `Idiomas`.
3. **Home `/`**: hero, links, bloque de descarga del CV.
4. **Un detalle en primer plano**: un bloque de rol con su título, fechas,
   duración, contexto y 3 bullets — uno de ellos con una métrica destacada. Es
   el elemento que más se repite y el que decide si el CV se ve bien.
5. **Nota de 5 líneas**: qué señal manda esta dirección, a cuál de los dos
   lectores le habla mejor, y qué resigna.

**Datos a usar:** los reales del dataset (`content/data/content.es.json`). Nicolás
Agustín Cribb Barbaro, Desarrollador Full Stack, Rosario. Roles: Dinkum
Interactive, Adsmovil, Hogarth, Independiente. **No inventar métricas** — hoy el
dataset no tiene ninguna, así que las maquetas deben verse bien **sin números**,
y mostrar aparte cómo se vería un bullet con métrica cuando existan.

## 8. Después de elegir

La dirección elegida se traduce a `src/styles/cv.css` y a los componentes de
`src/components/cv/` de la Task 3 del plan
`docs/superpowers/plans/2026-08-13-cv-como-sistema.md`. Ese plan ya tiene una
implementación de referencia deliberadamente neutra: se reemplaza por la
dirección ganadora, no se mezclan.

Lo que **no** cambia al elegir: la estructura del DOM, los nombres de las
secciones, y las verificaciones de parseo del PDF. El diseño entra por CSS y por
los tokens; si una dirección exige cambiar el orden del DOM de `/cv`, esa
dirección está mal.
