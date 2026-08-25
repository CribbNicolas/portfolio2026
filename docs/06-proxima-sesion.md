# 06 — Próxima sesión

Handoff del 2026-08-25. Qué quedó a medias, qué está bloqueado y en qué orden
conviene atacarlo. El estado completo del proyecto vive en
[`00-indice.md`](./00-indice.md); acá está solo lo accionable y ordenado.

Al cerrar esta sesión: **PR [#3](https://github.com/CribbNicolas/portfolio2026/pull/3)
abierto contra `main`, CI en verde.** La rama es `slice-2-landing-unica`.

---

## 1. Antes que nada: verificar a ojo

Lo único de este slice que **no está verificado de verdad**. Ningún test lo
cubre y los dos se ven en dos minutos con `pnpm run dev`.

- [ ] **El hover cruzado tarjeta↔mapa.** Pasar el mouse por una tarjeta de
      proyecto: el nodo correspondiente tiene que encenderse en el mapa, y al
      revés. Verificado por código que los ids del DOM coinciden 3/3 con las
      reglas `:has()` que emite `buildHoverCss`, y que no hay huérfanos — pero
      eso no prueba que se vea.
- [ ] **La inercia de la barra flotante.** Simulada en Node: arrastra 19.9 px
      con scroll sostenido, cruza el cero 200 ms después de frenar y rebota
      3.5 px. Los cinco parámetros están arriba de `src/scripts/lab/pildora.ts`
      con un comentario cada uno. Si hay que ajustar:
      - más pesada → bajar `RIGIDEZ` (0.055 → 0.04)
      - que rebote más → subir `AMORTIGUACION` (0.88 → 0.91; cerca de 1 marea)
      - que arrastre más lejos → subir `AMPLITUD` (0.35) y `TOPE_PX` (22)

**Hueco conocido de testing:** ningún check mira cómo resuelve la cascada de
CSS. En esta sesión un bloque `.pildora` duplicado con su propio
`position: fixed` dejó el botón de descarga detrás de la píldora, y los cinco
checks pasaron igual — miran el HTML de `dist/`, no el layout renderizado. Un
test de layout necesitaría un browser, que es exactamente lo que `test:pdf`
hace para `/cv` y no existe para la landing. **Candidato real de próxima
sesión:** un `landing-layout.check.ts` con Playwright que abra `/` y afirme
sobre `getBoundingClientRect()` — que la descarga esté a la derecha de la
píldora y no encima, que las cuatro secciones compartan `left` y `width`.

---

## 2. Deploy — bloqueado en el dominio

Todo el detalle en [`05-deploy-y-analitica.md`](./05-deploy-y-analitica.md).
El stack está decidido y documentado; falta ejecutarlo.

**El dominio bloquea al resto.** Sin él no hay `SITE_URL`, y el JSON-LD y el
canonical salen apuntando a `https://portfolio.invalid`.

- [ ] Comprar el dominio y definir `SITE_URL`
- [ ] Crear el proyecto en Cloudflare Pages
- [ ] Cargar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como **secrets de
      GitHub** (no alcanza el `.env` local: Actions no lo ve) y `SITE_URL` como
      variable
- [ ] Agregar el step de deploy al workflow — **después** de toda la secuencia
      de verificación y solo en `main`
- [ ] Apuntar el dominio propio a Pages
- [ ] Cloudflare Web Analytics
- [ ] Clarity en la landing, y correr `pnpm run test:js` para confirmar que
      `/cv` sigue en cero JS
- [ ] Línea de privacidad en el pie (Clarity usa cookies y graba sesiones)

Ya está hecho: `.env` en `.gitignore` y `.env.example` con los nombres exactos.

---

## 3. Datos — el hueco más importante

Nada de esto se puede hacer sin el autor (invariante 4: no se inventan datos).

### Métricas: cero en todo el dataset

`grep -c '"metric"' content/data/content.es.json` → **0**. Los candidatos y qué
medir están en [`03-cv.md`](./03-cv.md#5-métricas-pendientes):

| Logro | Qué medir |
|---|---|
| `dinkum-vite` | Tiempo de build antes/después |
| `dinkum-mapbox` | Volumen de datos o usuarios del mapa |
| `adsmovil-datos` | Tiempo, volumen o tasa de error en la recolección |
| `adsmovil-react` | Tamaño del equipo, productos migrados |
| `freelance-build` | Peso del bundle o tiempo de carga antes/después |
| `hogarth-i18n` | Mercados o idiomas |

Un rango honesto con `confidence: "estimated"` sirve — se renderiza con "~"
(regla 4). Un número inventado se cae en la entrevista.

### Los 8 TODO publicados

Son 8 entradas en el dataset; `audit:todos` reporta **9** porque cuenta
apariciones en `dist/` y una misma entrada se publica en más de una salida
(`/cv.json`, `/llms.txt`, el HTML). No es una discrepancia: son 8 datos.

Cada uno es texto que un lector ve hoy en el sitio. Línea en
`content/data/content.es.json`:

| Línea | Qué falta |
|---|---|
| 38 | Versión larga del summary, para LinkedIn y portfolio |
| 135 | `dinkum-mapbox`: volumen de datos, qué resolvía al usuario final |
| 229 | `jwd-maderas`: arquitectura, modelado en Sanity, SEO local |
| 232 | `jwd-maderas`: consultas recibidas, tiempo ahorrado por cotización |
| 258 | `mapas-distritos`: qué necesitaba resolver el usuario |
| 264 | `mapas-distritos`: volumen de datos o impacto |
| 287 | `wp-plugins`: tiempo de build antes/después, plugins entregados |
| 340 | **Nivel real de inglés** — hoy está declarado sin confirmar |

### Links de los proyectos

Los tres tienen `links: []`. La sección los renderiza **solo si existen**, así
que cargarlos es editar el dataset y buildear — no toca código.

### Otros datos a confirmar

- [ ] **Hogarth**: `employmentType` y `start: 2023-07` (ver `00-indice.md`)
- [ ] **Logros del rol Freelance (2020-04 → 2022-06)**: hoy tiene uno solo y sus
      `skillIds` son `["javascript"]`. Esos 2.2 años no conectan con ninguna
      otra tecnología, y por eso WordPress —declarada `core`— sale chica en el
      mapa

---

## 4. Contenido que falta en la landing

- [ ] **Casos de estudio en formato largo** (`04-portfolio.md` §2: problema →
      decisión → resultado). Hoy los proyectos van en lista compacta. Bloqueado
      en que se escriban `problem.short` y `outcome.short`: faltan en
      `mapas-distritos` (los dos) y el `outcome` de `jwd-maderas` y
      `wp-plugins`.
- [ ] **Sección Servicios** (lado freelance). `services` está vacío a propósito
      en el schema — no llenar con placeholders.
- [ ] **Sección Sobre mí.**
- [ ] **Investigación de patrones de portfolios** (`04-portfolio.md` §6):
      estructura, tipografía, paletas, cómo presentan proyectos los referentes.
      Conviene **antes** de diseñar los casos de estudio, no después.

---

## 5. Más adelante

- [ ] **Migración a Sanity** (Fase 1, sin apuro). Escribir `sanity-source.ts`
      que implemente `ContentSource`, traiga el dataset y llame a `resolveView`.
      Después, cambiar una línea en `content/source/index.ts`. Nada más.
- [ ] **CV diseñado (CV-A)**. La maquinaria de superficies ya lo soporta.
- [ ] **Bloques de texto para LinkedIn.**

**Decidido que NO se hace:** dataset en inglés. Traducir un CV produce inglés
traducido, que es peor que inglés escrito. Decisión fechada en `00-indice.md`.

---

## 6. Estado de la verificación

Al cerrar la sesión, con `pnpm run build` previo:

```
typecheck     0 errors
validate      Dataset válido
test          44 pass / 0 fail
test:pdf      10 pass / 0 fail
test:js        6 pass / 0 fail
test:bundle   10 pass / 0 fail
test:landing   5 pass / 0 fail
audit:todos    9 TODOs publicados (datos que faltan, no fallas)
```

Presupuesto: la landing mide **9.9 KB gzip** contra un techo de 30. El camino
crítico está en **2.10 KB** contra un techo de 4.
