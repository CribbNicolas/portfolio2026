# 02 — Branding: posicionamiento, voz y LinkedIn

---

## 1. Las dos identidades

Conviven y no se mezclan:

| | Qué es | Dónde vive |
|---|---|---|
| **Identidad de marca** | `Product Engineer` — construyo productos web completos, no pantallas | About, portfolio, conversación |
| **Identidad de búsqueda** | `Desarrollador Full Stack` | Primera posición del titular y del CV |

En LatAm nadie tipea "Product Engineer" en Computrabajo, Bumeran ni en LinkedIn Recruiter. **El título buscable arranca la cadena; la identidad va después.** Invertir el orden gana carácter y pierde apariciones — y con freelance + mercado local, las apariciones son el activo.

En el schema: `identity.searchTitle`, `identity.brandTitle`, `identity.titleAliases`.

## 2. Regla de idioma

Copy en español, **términos técnicos siempre en inglés**. Las búsquedas booleanas se hacen con "React", "Node.js", "TypeScript". Escribir "Desarrollador Full Stack" pero "React · Next.js · TypeScript · Node.js".

## 3. El diferencial

No es React: eso lo tienen cientos de miles de personas. Es que **entregás productos web completos para negocios reales** — frontend con profundidad, más CMS, infraestructura, deploy y datos. Y dentro de eso, dos cosas que casi nadie tiene:

- **Datos geoespaciales** (Mapbox GL JS, capas de polígonos, feature-state).
- **Entornos legacy modernizados sin romperlos** (plugins de WordPress con React + TypeScript, build migrado a Vite). En freelance esto vende muchísimo.

## 4. Titular de LinkedIn

**Opción A — buscable + identidad (recomendada)**
```
Desarrollador Full Stack (Product Engineer) | React · Next.js · TypeScript · Node.js | Construyo productos web completos: del repo a producción | Docker · CI/CD · headless CMS
```

**Opción B — con señal freelance activa**
```
Desarrollador Full Stack | React · Next.js · TypeScript · Node.js | Productos web end-to-end para negocios reales | Disponible para proyectos freelance
```

**Opción C — con el diferencial de datos/mapas**
```
Desarrollador Full Stack · React · Next.js · TypeScript | Interfaces con datos pesados y mapas (Mapbox) | Del frontend al deploy: Node · Docker · CI/CD
```

Máximo 220 caracteres. Ninguna palabra repetida — repetir keywords baja el score en matchers semánticos.

## 5. About / extracto

Los primeros ~220 caracteres son los que se ven sin hacer clic y los que más pesan.

```
Construyo productos web completos, no solo la interfaz.

Soy desarrollador full stack con foco en producto: React, Next.js y TypeScript
del lado del frontend, y el backend, la infraestructura y el deploy necesarios
para llevar algo de una idea a producción real.

Pasé por agencias, adtech y proyectos propios. Eso me dejó una forma de trabajar
bastante concreta: entender primero qué problema de negocio hay detrás de la
pantalla, elegir la tecnología más aburrida que lo resuelva bien, y dejar el
código en un estado donde el próximo que lo toque —a veces yo, seis meses
después— no tenga que adivinar nada.

Algunas cosas que hice:
· [Proyecto]: [qué resolvía] — [resultado o número]
· [Proyecto]: [qué resolvía] — [resultado o número]
· [Proyecto]: [qué resolvía] — [resultado o número]

Trabajo cómodo en todo el recorrido: React, Next.js, TypeScript, Solid, Vue 3,
Tailwind, Node, PHP/WordPress, Playwright, Docker, Cloudflare, CI/CD y monorepos.
Uso desarrollo asistido por IA (Claude Code, Cursor) como parte del flujo diario,
con revisión propia de todo lo que entra al repo.

Me interesan los equipos donde se puede discutir criterio técnico sin ego.

Tomo también proyectos freelance: [tipo de proyecto que querés atraer].
📩 [mail] · 🔗 [portfolio]
```

Qué hace cada parte: la primera línea es identidad (humano). Los bullets con números son la personalización que evita el descarte de la capa 3. El párrafo de stack es densidad de keywords para la capa 2. La línea de IA es honesta y verificable, sin ser el centro.

**Nota:** no escribir la antigüedad a mano acá. Se deriva de `careerStart` (regla 1 del contrato).

## 6. Skills en LinkedIn

**Top 3 fijadas:** React · TypeScript · Next.js

**Lista completa (15-20, no 50):** React, TypeScript, JavaScript, Next.js, Node.js, Desarrollo Full Stack, Tailwind CSS, REST APIs, Docker, CI/CD, Playwright, Mapbox, WordPress, PHP, Vue.js, SolidJS, Git, Cloudflare.

Pedir endorsements a 3-5 excompañeros **específicamente sobre las top 3**. Una skill con endorsements rankea por encima de la misma skill sin ellos.

## 7. Higiene de perfil

- URL personalizada (`/in/nicolascribb`).
- Foto profesional + banner con la propuesta de valor en texto.
- Sección **Destacado**: portfolio, caso de estudio principal, GitHub.
- Actividad: 2-3 intervenciones sustantivas por semana. No hace falta postear original; comentarios técnicos con criterio alcanzan.
- Coherencia total con el CV: mismas fechas, mismos títulos, mismas skills. La capa 2 cruza secciones.

## 8. Voz: la regla que gobierna todo el copy

Estructura y vocabulario pueden ser "de máquina" — eso ayuda en la capa 2. **Los hechos tienen que ser tuyos y verificables** — eso salva en la capa 3.

Test antes de publicar cualquier línea:

> ¿Otra persona con mi mismo stack podría haber escrito esta frase idéntica?

Si la respuesta es sí, la frase no está haciendo nada. Reescribirla con un nombre propio, un número o una decisión.

### Palabras prohibidas

`apasionado` · `proactivo` · `resultados` · `soluciones innovadoras` · `aprovechar` · `liderar` (sin objeto) · `buenas prácticas` (sin decir cuáles) · `stack moderno` · `escalable` (sin decir a qué escala) · `cutting-edge` · `dinámico` · `orientado a resultados`

### Patrón de escritura de un logro

```
[verbo en pasado] + [objeto técnico concreto] + [para qué] + [resultado o número]
```

Mal: *"Implementé buenas prácticas para garantizar la escalabilidad."*
Bien: *"Migré el tooling de build de Webpack a Vite, reduciendo el tiempo de build de X a Y."*
