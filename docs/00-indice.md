# Documentación — portfolio2026

Todo lo que sabemos y todo lo que decidimos. Si algo no está acá, no existe.

| Documento | Qué contiene |
|---|---|
| [01-filtros-y-seleccion.md](./01-filtros-y-seleccion.md) | Cómo funcionan los filtros hoy, qué dice la evidencia, qué sube el puntaje |
| [02-branding.md](./02-branding.md) | Posicionamiento, titular, About, voz, LinkedIn |
| [03-cv.md](./03-cv.md) | Formato, contenido, bullets, checklist por postulación |
| [04-portfolio.md](./04-portfolio.md) | Estructura, casos de estudio, capa legible por máquinas |
| [CONTRATO.md](./CONTRATO.md) | Reglas del sistema de contenido |

---

## Decisiones tomadas

Fechadas, para saber qué revisar cuando cambie el contexto.

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-08 | Mercado: **Argentina/LatAm en español + clientes freelance propios** | Define idioma, formato y keywords de todo el material |
| 2026-08 | Posicionamiento: **Product Engineer** (marca) / **Desarrollador Full Stack** (búsqueda) | La identidad memorable y el término buscable son cosas distintas |
| 2026-08 | La IA es **un pilar visible, no el eje** | En freelance LatAm, "AI-powered" en el titular acerca al ruido; el diferencial es entregar producto |
| 2026-08 | `careerStart = 2020-04` | Resuelve las tres antigüedades distintas que circulaban |
| 2026-08 | Hogarth: `contract` + `concurrent: true`, inicio 2023-07 | Como full-time se superponía con Adsmovil. **Pendiente de confirmar** |
| 2026-08 | Contenido como datos, backend después (Fase 0 → JSON en repo) | El contrato de datos da la independencia, no el backend |
| 2026-08 | Sin dataset en inglés por ahora | Traducir un CV produce inglés traducido, que es peor que inglés escrito |
| 2026-08 | Frontend en **Astro estático**, PDF en build con **Playwright** desde la misma página `/cv` | Un solo layout para HTML y PDF: no se pueden desincronizar |
| 2026-08 | Solo se renderiza `cv-ats`; el CV diseñado (CV-A) queda para después | Un artefacto = nunca dudar cuál mandar. La maquinaria de superficies ya soporta agregar el otro |
| 2026-08 | `cv-ats` sale de `publishPhoneOn` | `/cv` HTML y el PDF comparten superficie: publicarlo ahí lo ponía en la web abierta |
| 2026-08 | El **mapa de conocimiento es la portada**; `/lab` se borró | Era una ruta aparte mientras la home era un placeholder. Mantener dos páginas con el mismo hero era duplicación sin lector |
| 2026-08 | Se avanzó con el mapa **antes** de la investigación de diseño de [04 §6](./04-portfolio.md#6-pendiente-de-investigar) | El mapa es la única superficie que muestra el grafo de datos; postergarlo por tipografías era postergar lo que diferencia el sitio. La investigación sigue pendiente para los casos de estudio |
| 2026-08 | La **home envía JavaScript**; `/cv` sigue en cero | El mapa lo necesita. `/cv` no es negociable: el PDF se imprime desde ahí y un script cambia el render en silencio. Lista blanca en `no-client-js.check.ts` |
| 2026-08 | Tamaño de nodo = **años de uso × conexiones**, por raíz | Un tamaño fijo por tipo no decía nada. Los años se derivan de `since` o de la evidencia fechada — nunca se estiman |

## Estado

- [x] Schema y contrato de datos
- [x] Validación (Zod + reglas duras) — `npm run validate`
- [x] Tests de las reglas que el schema no valida (visibility, locale) — `npm test`
- [x] Dataset semilla con datos reales
- [x] Repo bajo control de versiones (git)
- [x] Repo en GitHub
- [x] `formatMetric()` — hace cumplir la regla 4
- [x] Frontend consumiendo `getView()`
- [x] Generadores de salida: CV PDF, `/cv` HTML, JSON-LD, `llms.txt`, `/cv.json`
- [x] Mapa de conocimiento en la home (SVG server-rendered + WebGL opcional)
- [ ] **Métricas** — el hueco más importante. Ver [03-cv.md](./03-cv.md#métricas-pendientes)
- [ ] Confirmar datos de Hogarth
- [ ] Bloques de texto para LinkedIn
- [ ] Casos de estudio en el portfolio — antes hay que hacer la investigación de [04 §6](./04-portfolio.md#6-pendiente-de-investigar)
- [ ] Logros del rol Freelance (2020-04 → 2022-06): hoy tiene uno solo y sus `skillIds` son `["javascript"]`. Esos 2.2 años no le aportan una conexión a ninguna otra tecnología, y por eso WordPress —declarada `core`— queda chica en el mapa
- [ ] Migración a Sanity (Fase 1, sin apuro)

## Nota sobre las fuentes

Los datos de la sección de filtros vienen de investigación hecha en agosto de 2026. Mucho del contenido que circula sobre "ATS 2026" es marketing de herramientas de CV, así que en el documento se distingue explícitamente lo que tiene fuente primaria de lo que es folklore. Cuando pasen unos meses, revalidar antes de tomar decisiones sobre esa base.
