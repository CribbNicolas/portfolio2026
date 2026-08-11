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

## Estado

- [x] Schema y contrato de datos
- [x] Validación (Zod + reglas duras) — `npm run validate`
- [x] Tests de las reglas que el schema no valida (visibility, locale) — `npm test`
- [x] Dataset semilla con datos reales
- [x] Repo bajo control de versiones (git)
- [ ] **Repo en GitHub** — habilita el workflow de CI (`.github/workflows/`). Hasta el push, la validación corre a mano.
- [ ] **Métricas** — el hueco más importante. Ver [03-cv.md](./03-cv.md#métricas-pendientes)
- [ ] Confirmar datos de Hogarth
- [ ] `formatMetric()` — hace cumplir la regla 4 (`~` para estimados). Hay un test en `todo` esperándolo.
- [ ] Frontend consumiendo `getView()`
- [ ] Generadores de salida (CV PDF, `/cv` HTML, JSON-LD, `llms.txt`)
- [ ] Bloques de texto para LinkedIn
- [ ] Migración a Sanity (Fase 1, sin apuro)

## Nota sobre las fuentes

Los datos de la sección de filtros vienen de investigación hecha en agosto de 2026. Mucho del contenido que circula sobre "ATS 2026" es marketing de herramientas de CV, así que en el documento se distingue explícitamente lo que tiene fuente primaria de lo que es folklore. Cuando pasen unos meses, revalidar antes de tomar decisiones sobre esa base.
