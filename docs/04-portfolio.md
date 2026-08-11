# 04 — Portfolio

Dos objetivos a la vez: convencer a un equipo que contrata y cerrar clientes freelance. Y dos lectores: el humano y el agente.

---

## 1. Estructura

```
1. Hero          → quién sos + qué construís + CTA. Una frase, no un párrafo.
2. Casos         → 3 proyectos en formato problema → decisión → resultado.
3. Servicios     → qué te pueden contratar a hacer (lado freelance).
4. Sobre mí      → historia corta, con voz. No un CV repetido.
5. Stack         → agrupado, escaneable.
6. Contacto      → mail + WhatsApp + LinkedIn. Sin formulario de 8 campos.
```

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

Quedó abierta una segunda investigación sobre patrones de portfolios de referentes: estructura, tipografía y paletas, cómo presentan proyectos, qué errores se repiten en portfolios senior, cómo incorporan la IA a su marca. Vale la pena hacerla **antes** de decidir el diseño visual, no después.
