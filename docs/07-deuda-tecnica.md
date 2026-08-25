# 07 — Deuda técnica

Abierto el 2026-08-25, durante el pase del PDF a runtime (ver
[05](./05-deploy-y-analitica.md)).

Cosas que se encontraron trabajando en otra cosa. **Ninguna se arregló ahí
mismo a propósito:** meter arreglos no relacionados en un PR de deploy hace que
el diff deje de contar una sola historia, y que la revisión de lo que sí
importaba se diluya.

Este archivo es para que no se pierdan. Cada entrada dice qué es, **cómo se
comprueba** —para que la próxima sesión no tenga que creerme— y qué costaría
arreglarla. El orden es por impacto, no por esfuerzo.

Lo que **no** va acá: los pendientes de producto y de datos, que viven en
[00-indice](./00-indice.md) y [06-proxima-sesion](./06-proxima-sesion.md). Esto
es solo deuda del código y de la infra.

---

## 1. Soft-404: una ruta inexistente devuelve `200`

**Severidad: media.** Es la única de la lista que un tercero puede ver.

Cloudflare Pages no encuentra un `404.html` en `dist/` —Astro no lo genera
porque no hay una página `404`— y sirve HTML con estado `200` para cualquier
ruta que no exista.

```bash
curl -sI https://cribbnicolas.pages.dev/no-existe-xyz
# HTTP/1.1 200 OK
# Content-Type: text/html; charset=utf-8
```

**Por qué importa.** Un crawler que pide una URL rota recibe "todo bien, acá hay
una página". Google llama a esto *soft 404* y lo trata como señal de calidad
baja: indexa basura o deja de confiar en el sitio. En un sitio de dos páginas el
daño es chico, pero el costo de arreglarlo también.

**Cómo se encontró.** Comparando el `HEAD /cv.pdf` roto contra una ruta de
control. La ruta de control devolvió lo mismo que la ruta rota, y ahí se vio que
el problema era doble.

**Arreglo.** Un `src/pages/404.astro`. Astro lo emite como `dist/404.html` y
Pages lo sirve con el estado correcto sin más configuración. Es una página, no
un cambio de arquitectura.

**Ojo al arreglarlo:** esa página entra en el radar de dos checks. Va a tener
que estar en la lista de `no-client-js.check.ts` si lleva JS —no debería—, y
`landing-unica.check.ts` verifica que nadie linkee a `/cv`, así que el 404 no
puede ofrecer "¿buscabas el CV?" con un link ahí.

---

## 2. Vite avisa que un chunk pasa los 500 kB

**Severidad: baja, pero el ruido tapa.**

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Medido en el build del 2026-08-25:

| Chunk | Crudo | gzip |
|---|---|---|
| `grafo-3d.<hash>.js` | 509 KB | **129 KB** |
| todo lo demás junto | ~12 KB | ~6 KB |

Es `three`, y **está donde tiene que estar**. El invariante del mapa
(`CLAUDE.md` §Frontend del mapa, regla 2) es que `three` tenga un solo
importador y se cargue con `import()` dinámico, fuera del camino crítico.
`bundle-budget.check.ts` lo verifica con un techo de 4 KB para los chunks
críticos, y pasa. O sea: **el warning describe exactamente el diseño buscado, y
Vite no tiene forma de saberlo.**

**Por qué es deuda igual.** Un warning que siempre está es un warning que nadie
lee. El día que un chunk crítico se pase de 500 kB, la línea va a ser idéntica a
la de hoy y va a pasar de largo.

**Dos arreglos posibles, y no son equivalentes:**

- **Subir `build.chunkSizeWarningLimit`** por encima de 509 KB en
  `astro.config.mjs`, con un comentario que diga por qué y que el techo real lo
  pone `bundle-budget.check.ts`. Honesto: reconoce que el gate propio es más
  estricto y más informado que el genérico. Una línea.
- **Partir `three` en varios chunks** con `manualChunks`. Suena a mejora pero no
  cambia un byte de lo que baja el visitante: son los mismos módulos repartidos
  en más pedidos. Solo tiene sentido si algún día se carga *parte* de `three` en
  un caso y parte en otro.

Recomendado el primero. Hoy no se hizo ninguno porque tocar `astro.config.mjs`
en un PR de deploy es exactamente el tipo de cambio no relacionado que conviene
no mezclar.

---

## 3. Tres símbolos muertos en `grafo-3d.ts`

**Severidad: baja.** No rompe nada. Son hints de `astro check`, no errores, así
que CI pasa.

```
src/scripts/lab/grafo-3d.ts:37:7    'ORBITA' is declared but its value is never read
src/scripts/lab/grafo-3d.ts:215:19  'vecindario' is declared but its value is never read
src/scripts/lab/grafo-3d.ts:383:36  'id' is declared but its value is never read
```

Los tres son restos de iteraciones anteriores del mapa 3D.

**Por qué no es solo prolijidad.** `ORBITA = 0.14` es una constante de
configuración con un nombre que suena a que hace algo. Alguien que lea el
archivo en seis meses va a asumir que la órbita del mapa se ajusta ahí, y no.
Una constante muerta con nombre creíble desinforma más que la ausencia de
constante.

**Arreglo.** Borrar `ORBITA`; en los otros dos, prefijar con `_` los parámetros
y destructurados que se ignoran a propósito —que es la convención que TypeScript
entiende— o sacarlos si no se ignoran a propósito sino por olvido. Requiere leer
el código alrededor para saber cuál de las dos cosas es, y por eso no se tocó de
paso.

---

## 4. Tres `<script>` con hint `astro(4000)`

**Severidad: cosmética.**

```
src/pages/cv.astro:43:11
src/pages/index.astro:85:11
src/pages/index.astro:283:11
```

Son los `<script type="application/ld+json">` del JSON-LD y el
`type="application/json"` con los datos del grafo. Astro avisa que, al tener un
atributo `type`, no los procesa y los deja inline — que es exactamente lo que se
quiere: son datos, no código.

**Arreglo.** Agregar `is:inline` explícito a los tres. Silencia el hint
declarando la intención, sin cambiar la salida. Cinco caracteres por etiqueta.

Vale la pena por lo mismo que el punto 2: el ruido constante tapa la señal
nueva. Los seis hints de hoy son inofensivos, y por eso nadie va a leer el
séptimo.

---

## 5. El merge a `main` no dejó su propia corrida de CI

**Severidad: baja. Anotado porque es confuso, no porque esté roto.**

El merge del PR #4 produjo `afdbfe2`. Corridas para ese SHA:

```
afdbfe2 | content-validation | staging | push | success
```

Una sola, atribuida a `staging` —la que disparó el push que sincronizó la rama
al mismo commit—. El push a `main` del merge no generó una corrida propia.

**El árbol está verificado**: mismo SHA, mismos checks, verde. Pero si alguien
filtra el historial de Actions por `main`, no la va a encontrar, y la conclusión
fácil y equivocada es que el merge se saltó la validación.

**Por qué no se investigó.** No cambia el mecanismo real: al proteger `main` con
el check `validate` requerido, el check que cuenta viene del evento
`pull_request`, y ese sí corre siempre (el de `74267cb` corrió y pasó).

Si alguna vez importa tener la corrida por rama, la sospecha a confirmar es que
GitHub no re-dispara `push` para un SHA que ya tiene una corrida del mismo
workflow. No está verificado.

---

## 6. La Function no se puede probar de punta a punta en local

**Severidad: baja. Es una limitación, no un defecto — queda anotada para que no
se redescubra.**

`pnpm dlx wrangler pages dev dist` levanta `/cv.pdf` y sirve para verificar el
ruteo, el caché y los caminos de error. Lo que **no** puede verificar es el
render: la Function le pide a Browser Rendering que imprima
`http://localhost:8788/cv`, y esa URL no resuelve desde la nube de Cloudflare.

O sea que el render solo se prueba deployando. Hoy eso está cubierto por
`smoke-deploy.yml`, que corre `test:pdf` contra cada deploy con éxito —previews
incluidas—, así que el ciclo es "pushear a `staging` y mirar el smoke", no
"pushear a producción y rezar".

**Salida, si alguna vez molesta:** un túnel (`cloudflared tunnel`) que exponga el
`wrangler pages dev` local con una URL pública. Es infra para un problema que
hoy se resuelve esperando un minuto a una preview. No parece que valga la pena.
