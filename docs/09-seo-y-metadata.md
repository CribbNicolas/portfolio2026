# 09 — SEO y metadata social

Escrito el 2026-08-25 al cerrar la fase 1.1 de [`06`](./06-proxima-sesion.md).

Este documento existe para una cosa: que la próxima persona que se pregunte
*«¿falta algo de SEO?»* no tenga que volver a investigarlo. Abajo está lo que el
sitio emite, **lo que deliberadamente no emite y por qué**, y qué tendría que
pasar para reconsiderar cada omisión.

La deuda que sí hay que arreglar vive en [`07`](./07-deuda-tecnica.md). Acá van
las decisiones de **no hacer**, que son distintas: una deuda se paga, una
decisión se revisa cuando cambia el supuesto que la sostenía.

---

## 1. Lo que se emite hoy

Medido sobre `dist/` el 2026-08-25.

| Qué | Dónde se genera | Dónde se hace cumplir |
|---|---|---|
| `title`, `description`, `canonical`, `lang="es"` | `Base.astro` | — |
| Open Graph: `type`, `title`, `description`, `url`, `locale` | `Base.astro`, tras la prop `compartible` | `og-output.check.ts` |
| `og:image` + `type`, `width`, `height`, `alt` | `Base.astro` sobre `public/og.jpg` | `og-output.check.ts` |
| Twitter Card `summary_large_image` + `title`, `description`, `image`, `image:alt` | `Base.astro` | `og-output.check.ts` |
| JSON-LD `Person` (15 claves, con `sameAs`, `worksFor`, `alumniOf`, `knowsAbout`) | `src/lib/jsonld.ts` | — |
| `favicon.svg` | `public/`, geometría de `src/lib/marca.ts` | `og-output.check.ts` |
| `apple-touch-icon.png` 180×180 | `pnpm run og:local` | `og-output.check.ts` |
| `theme-color`, claro y oscuro | `Base.astro` | `og-output.check.ts` |
| `robots.txt` con la línea `Sitemap:` | `src/pages/robots.txt.ts` | — |
| `sitemap-index.xml`, con `/cv` excluida | `@astrojs/sitemap` en `astro.config.mjs` | — |
| `404.html` propia | `src/pages/404.astro` | `single-landing.check.ts` |
| Landing indexable, `/cv` con `noindex` y sin links entrantes | — | `single-landing.check.ts` |

**Las etiquetas sociales son opt-in**, no un default con excepciones: `/cv` y el
404 no las emiten porque nadie se acordó de apagarlas, sino porque hay que pedir
`compartible` explícitamente. Olvidarse en una página nueva significa no
emitirlas, que es el lado seguro del error.

---

## 2. Lo que NO se emite, a propósito

Cada uno con la condición que lo haría valer la pena. **Ninguno cambia si el
link previsualiza bien**: eso ya funciona.

### 2.1 `og:site_name`

**Por qué no.** La etiqueta existe para distinguir una página del sitio que la
contiene («este artículo» dentro de «Wikipedia»). Acá el sitio *es* la persona,
y `og:title` ya arranca con el nombre completo. Slack y LinkedIn lo renderizan
apilado arriba del título, así que emitirlo daría:

```
Nicolás Agustín Cribb Barbaro
Nicolás Agustín Cribb Barbaro — Desarrollador Full Stack
```

El nombre dos veces seguidas se lee como un error de la tarjeta, no como
metadata.

**Cuándo reconsiderarlo.** Si el sitio pasa a tener un nombre de marca distinto
del nombre de la persona, o si se agregan páginas de destino además de la
landing (casos de estudio, por ejemplo): ahí `og:site_name` empieza a hacer el
trabajo para el que existe.

### 2.2 `profile:first_name` y `profile:last_name`

**Por qué no.** `og:type` es `profile`, así que estas propiedades aplican. El
problema es que `identity` guarda `fullName` como un solo campo, y partir
«Nicolás Agustín Cribb Barbaro» en nombre y apellido es **adivinar** dónde
cortan dos nombres y dos apellidos. Un `split(" ")` daría `first_name: "Nicolás"`
y `last_name: "Agustín"`, que es sencillamente incorrecto.

Inventar un dato para llenar un campo va contra el invariante 4, y ningún
consumidor conocido usa estas dos propiedades para renderizar la tarjeta.

**Cuándo reconsiderarlo.** Si el schema gana campos `givenName` / `familyName`
—que además `Person` de schema.org también aprovecharía—, salen gratis y sin
adivinar. Eso es trabajo del editor de la fase 2, no de acá.

### 2.3 `hreflang`

**Por qué no.** Hay un solo idioma. No existe dataset EN y la decisión de no
cargarlo está fechada en [`00`](./00-indice.md). Un `hreflang` que apunta a una
sola variante no le dice nada a nadie.

**Cuándo reconsiderarlo.** El día que exista `content.en.json`. Ahí es
obligatorio, junto con `x-default`.

### 2.4 `twitter:site` y `twitter:creator`

**Por qué no.** No hay cuenta de Twitter: `identity.links` tiene GitHub y
LinkedIn y nada más. La tarjeta funciona igual —`summary_large_image` no
necesita una cuenta—; lo único que se pierde es el «vía @usuario».

**Cuándo reconsiderarlo.** Si aparece una cuenta en `identity.links`. Conviene
derivarlo del dataset y no escribirlo a mano, como todo lo demás.

### 2.5 Una imagen social por plataforma

**Por qué no.** Es la confusión más común del tema y la respuesta es que **no
hace falta**: Facebook, LinkedIn, WhatsApp, Slack, Discord y Twitter leen la
MISMA etiqueta `og:image`. Lo que cambia entre ellas es cómo la recortan, no qué
archivo piden. Una imagen de 1200×630 las cubre a todas.

El caso que sí queda descubierto es el recorte cuadrado que algunos clientes de
mensajería usan para la miniatura chica de la lista de chats: ahí se pierde el
borde del texto. Es la variante menos vista de la tarjeta, y diseñar la principal
para sobrevivir ese recorte la empeoraría en las seis plataformas donde se ve
entera.

**Cuándo reconsiderarlo.** Si alguna vez se mide que el tráfico entra sobre todo
por miniaturas cuadradas. Hoy no hay ningún dato que lo sugiera.

### 2.6 `favicon.ico`

**Por qué no.** El SVG lo soportan todos los navegadores actuales. Los que no
—Safari anterior a 15— no muestran **ningún** ícono, que es exactamente lo que
pasaba antes de que existiera el favicon. El `.ico` sería un archivo binario más
en el repo para una cola de compatibilidad que se achica sola.

**Cuándo reconsiderarlo.** Si aparece analítica que muestre tráfico real desde
navegadores viejos. El generador ya existe: emitirlo sería agregar un tamaño más
a `build-og.ts`.

### 2.7 `manifest.webmanifest` y PWA

**Por qué no.** Un manifest sirve para instalar una app. Esto es un portfolio de
una sola página que se visita una vez, desde un link que alguien mandó. Nadie lo
instala. `apple-touch-icon` cubre el único caso real —guardarlo en la pantalla de
inicio— sin el resto de la maquinaria.

**Cuándo reconsiderarlo.** No, salvo que el sitio se convierta en otra cosa.

### 2.8 Más schema.org que `Person`

**Por qué no.** `BreadcrumbList` describe una jerarquía de navegación, y la
landing única no tiene jerarquía: es una página. `WebSite` + `SearchAction`
declara un buscador interno, y no hay buscador. Emitir structured data que
describe algo que no existe es peor que no emitirlo — Google lo marca como
inconsistente.

**Cuándo reconsiderarlo.** Si aparecen los casos de estudio como páginas
propias, ahí `BreadcrumbList` empieza a describir algo real.

---

## 3. Pendiente de verificar contra un deploy

Ninguna de las dos se puede comprobar desde `dist/`. Se miran en la preview de
`staging`, antes de que esto llegue a `main`.

1. **Que `src/pages/robots.txt.ts` le gane al `robots.txt` gestionado de
   Cloudflare.** Hoy Cloudflare sirve uno que son solo comentarios, cero
   directivas. Si le gana el gestionado, el sitemap hay que anunciarlo por
   Search Console y anotarlo acá como limitación.
2. **Cómo se ve la tarjeta de verdad.** Pegar la URL de la preview en un chat y
   en el validador de LinkedIn.

Lo que sí está confirmado: **`SITE_URL` está configurado en Cloudflare Pages**.
Producción emite el canonical con el host real y no con el `portfolio.invalid`
de fallback, así que las URLs absolutas de `og:image` y `og:url` van a salir
bien. Si no lo estuviera, toda la metadata social apuntaría a un dominio
inexistente y nada lo habría delatado hasta compartir el link.

---

## 4. El gate

`public/og.jpg` y `public/apple-touch-icon.png` son artefactos **commiteados**:
se generan con `pnpm run og:local` y no en el build, porque rasterizar necesita
Chromium y el builder de Cloudflare no lo tiene (mismo motivo que sacó al PDF del
build, ver [`07`](./07-deuda-tecnica.md) §18).

Un artefacto commiteado se desincroniza en silencio. Por eso `og.lock.json`
guarda la huella de **todo** lo que se ve en ellos —los textos del dataset, la
foto, el fuente de la plantilla y el de `src/lib/marca.ts`— y `pnpm run test:og`
falla cuando dejan de coincidir.

`marca.ts` está en la huella por algo concreto: sin él, ajustar una curva del
logo dejaba la tarjeta y el ícono de iOS dibujando la marca vieja y nada
fallaba.

El mismo check cubre dos cosas que no son la tarjeta pero son la misma clase de
bug silencioso: que `favicon.svg` siga dibujando el aro de `marca.ts` —no puede
importarlo, es un archivo estático— y que sus comentarios parseen como XML, que
es lo que lo tuvo sin renderizar durante tres commits.
