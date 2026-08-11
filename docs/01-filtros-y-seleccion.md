# 01 — Filtros de selección: cómo funcionan y qué hacer

Investigación de agosto 2026. Separado en lo que tiene fuente primaria y lo que es folklore repetido.

---

## 1. El embudo real: tres capas, no una

Lo que se llama genéricamente "el ATS" son en realidad tres filtros distintos que premian cosas diferentes. Entender esto resuelve las contradicciones que uno lee por ahí.

### Capa 1 — Parser + keywords

El ATS clásico parsea el CV en campos estructurados y lo matchea contra la descripción del puesto. **Si el parseo falla, nada de lo que sigue importa.** Es la capa más tonta y la más letal, y corre primero.

Qué la rompe:
- Dos columnas, sidebars, tablas, cajas de texto
- Headers y footers
- Íconos y gráficos con texto adentro
- PDFs exportados como imagen

Qué la satisface: una columna, secciones con nombres estándar, texto seleccionable.

### Capa 2 — LLM que resume y rankea

Se sienta encima del parser, sobre el texto ya extraído. Resume, puntúa y a veces genera un ranking. Es la capa que creció más rápido en los últimos dos años y la que introduce comportamientos nuevos — entre ellos el sesgo de la sección 2.

Qué la satisface: estructura clara, vocabulario del dominio, densidad semántica, coherencia entre secciones (cruza fechas, títulos y skills entre sí).

### Capa 3 — El humano

Lee 10 a 30 segundos. Busca motivos para descartar, no para avanzar.

Qué lo hace descartar: prosa genérica, ausencia de números, cosas que suenan a plantilla.

**El punto clave: las capas 2 y 3 premian cosas casi opuestas.** Toda la estrategia sale de ahí.

---

## 2. La paradoja de la IA, resuelta

Circulan dos afirmaciones que parecen contradictorias. Las dos son ciertas, en capas distintas.

### A favor de escribir "estilo IA": el sesgo de self-preference

Un experimento controlado ([Xu, Li & Jiang, arXiv:2509.00462](https://arxiv.org/abs/2509.00462)) encontró que los LLMs prefieren currículums generados por LLM por encima de los escritos por humanos, controlando la calidad del contenido, con un sesgo de entre **67% y 82%**. Simulando pipelines reales en 24 ocupaciones, un candidato que usa el mismo modelo que el evaluador tiene entre **23% y 60% más chances** de quedar preseleccionado.

### En contra: el filtro humano

- **49%** de los hiring managers descarta lo que identifica como generado por IA.
- **62%** rechaza específicamente lo que no tiene personalización.
- Cerca de **20%** rechaza cualquier postulación asistida por IA, sin matices.

### Lo que reconcilia las dos cosas

Cuando se les pidió a hiring managers identificar cartas escritas por ChatGPT, **solo el 18% acertó las tres**. Un 82% de fallo.

**No están detectando IA. Están detectando texto genérico.** Y como el texto genérico y el texto de IA suelen ser lo mismo, confunden una cosa con la otra.

El ensayo controlado aleatorizado de MIT/NBER ([WP 30886](https://www.nber.org/papers/w30886)), con 480.948 buscadores de empleo, midió **+7,8% de contrataciones** cuando la IA edita prosa humana — con el efecto más grande entre escritores no nativos de inglés. Ese estudio mide **IA como editora**, no como autora generando desde cero.

### La regla operativa

> **La IA arma el esqueleto y el vocabulario. Vos ponés los hechos que nadie más puede escribir.**

Un nombre de producto, un número, una decisión técnica con su trade-off. Eso pasa las tres capas a la vez: la capa 2 ve estructura y densidad, la capa 3 ve algo que no podría haber salido de una plantilla.

### Riesgo específico para hispanohablantes

El análisis de Stanford HAI sobre más de 10.000 muestras mostró que los detectores de IA tienen **más de 20% de falsos positivos con escritores no nativos de inglés**. Si en algún momento se hace la versión en inglés, un texto correcto pero neutro expone doble. El antídoto es el mismo: especificidad verificable.

---

## 3. Mitos que hay que sacar del sistema operativo

| Mito | Realidad |
|---|---|
| "El ATS rechaza automáticamente el 75%" | No tiene fuente primaria. Viene de un pitch de ventas de 2012 de Preptel, startup que cerró en 2013. Se repite desde entonces. |
| "El ATS auto-rechaza por formato" | En una encuesta a reclutadores en EE.UU., **92%** confirmó que su ATS no auto-rechaza. Solo el 8% configura auto-rechazo, típicamente por umbral (menos de 75% de match, o menos de 7 de 10 skills requeridas). |
| "Hay que meter keywords escondidas en texto blanco" | Los ATS modernos marcan el texto oculto como manipulación. Es descarte directo. |
| "Cuantas más veces repita la keyword, mejor" | En matchers semánticos (Eightfold, Phenom), repetir un término **baja** el score. |
| "El diseño rompe el parseo" | Workday, iCIMS, Greenhouse y Lever parsean PDFs con formato correctamente, siempre que no haya tablas, cajas de texto, headers/footers ni columnas múltiples. El problema es la estructura, no la estética. |

**El enemigo real no es el filtro: es el volumen.** Los clientes de Workday procesaron 173 millones de postulaciones en el primer semestre de 2024, +31% interanual, mientras las vacantes crecieron solo 7%. No te descarta un algoritmo malvado; te diluye una pila.

---

## 4. Qué sube el puntaje, por superficie

### CV
- Una columna, secciones estándar (`Perfil`, `Habilidades técnicas`, `Experiencia`, `Educación`), PDF con texto seleccionable.
- Keywords **literales** donde son nombres propios de herramienta (si el aviso dice "Vue.js", poner "Vue.js"), y por sinónimo donde la capa 2 ya razona.
- Coherencia entre secciones: las fechas, los títulos y las skills tienen que cerrar entre sí y con LinkedIn.
- Una versión adaptada por familia de puesto. Ver [03-cv.md](./03-cv.md).

### LinkedIn
- La búsqueda de reclutadores rankea por **relevancia semántica**, no solo coincidencia literal.
- El peso de endorsements por skill afecta el ranking: **10-20 skills relevantes rinden más que 50 genéricas**.
- Los perfiles inactivos rankean por debajo de perfiles equivalentes activos. Dos o tres intervenciones sustantivas por semana alcanzan.
- El titular es el campo más pesado y aparece en cada búsqueda, comentario y mensaje.

### Portfolio
- Para el humano: formato **problema → decisión → resultado**, con 3-5 proyectos con demo en vivo y stack explícito.
- Para el agente (cada vez más reclutadores pegan la URL en un LLM): JSON-LD `Person` server-rendered, HTML semántico, `/llms.txt`, `/cv` en HTML además del PDF. Ver [04-portfolio.md](./04-portfolio.md).

---

## 5. Lo que esto significa para el sistema de contenido

Estas conclusiones están codificadas en el schema, no solo escritas acá:

| Conclusión | Cómo se hace cumplir |
|---|---|
| Coherencia entre secciones | `careerStart` único, duraciones derivadas (regla 1) |
| Nada de full-time superpuestos sin explicar | Regla 2, validada en CI |
| No reclamar skills sin evidencia | Regla 3, validada en CI |
| Números honestos | `Metric.confidence`, renderizado con "~" si es estimado |
| Keywords literales por aviso | `Skill.aliases` |
| Marca vs. búsqueda | `brandTitle` / `searchTitle` |
| Salida parseable | Superficie `cv-ats`, una columna |

---

## 6. Fuentes

**Primarias (confiables):**
- Xu, Li & Jiang — *self-preference bias en screening con LLM*, [arXiv:2509.00462](https://arxiv.org/abs/2509.00462)
- MIT/NBER Working Paper 30886 — RCT sobre asistencia de IA en postulaciones, [nber.org/papers/w30886](https://www.nber.org/papers/w30886)
- Stanford HAI — sesgo de los detectores de IA contra escritores no nativos
- Harvard Business School, *Hidden Workers: Untapped Talent* (2021)

**Secundarias (encuestas de industria, tratar con más cuidado):**
- Encuestas a reclutadores sobre rechazo de material generado por IA (StandOut-CV / TopResume, Enhancv)
- Datos de volumen de Workday

**A desconfiar:** cualquier artículo titulado "ATS en 2026" publicado por una empresa que vende plantillas de CV o servicios de optimización. Casi todos citan el 75% de Preptel.
