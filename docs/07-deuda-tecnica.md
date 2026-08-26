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

## 1. Soft-404: una ruta inexistente devuelve `200` — **RESUELTO 2026-08-25**

Arreglado con `src/pages/404.astro`. Astro lo emite como `dist/404.html` y
Pages lo sirve con el estado correcto. Queda anclado por dos tests en
`single-landing.check.ts`: que el archivo exista, y que ninguna página linkee
`/cv` —el test viejo miraba sólo la landing, y desde que hay más de una página
eso dejaba de cubrir lo que el invariante prometía—.

De paso apareció un bug en otro test: **"la landing NO repite el encabezado del
CV" venía pasando por casualidad.** Buscaba `cv__name` en el HTML entero, así
que matcheaba también el selector dentro de un `<style>`. Astro decide inlinear
o dejar externa una hoja según el chunking, o sea que el resultado dependía de
cuántas páginas tuviera el sitio: al agregar la 404, `cv.css` pasó a inline y el
test empezó a fallar sin que la landing cambiara una línea. Ahora mira el
marcado, no las hojas.

El registro de por qué existía queda abajo.

**Severidad: era media.** Era la única de la lista que un tercero podía ver.

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
`single-landing.check.ts` verifica que nadie linkee a `/cv`, así que el 404 no
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

---

## 7. La API pública publica campos internos

**Severidad: media.** Es contrato con terceros, y ahora el repo es público.

`/cv.json` sirve la superficie `public-api`, pero `resolveView` sólo filtra
`phone` y `streetAddress`. Todo lo demás pasa entero. Medido sobre
`dist/cv.json` del build del 2026-08-25:

```
publishPhoneOn expuesto: true
claves "priority"  en la salida: 40
claves "visibility" en la salida: 40
```

`visibility` y `priority` son **decisiones editoriales internas**: dicen qué
logro considerás de primera línea y cuál de tercera, y en qué superficies
decidiste no mostrar algo. Un reclutador que abra el JSON ve el ranking que
hiciste de tu propio trabajo. `publishPhoneOn` además describe una política de
privacidad que no le importa a nadie afuera.

**Por qué no se arregló acá.** Tocar `resolveView` es tocar el archivo del que
depende la regla 8, y hacerlo en medio de un cambio de deploy es pedirla.

**Arreglo.** En `resolveView`, para la superficie `public-api`, mapear los
`Achievement` y `Skill` a una forma sin `visibility` ni `publishPhoneOn`. Es
una proyección, no un filtro: el tipo de salida tendría que ser distinto del de
las superficies internas, y ahí está el trabajo real.

---

## 8. `/cv.json` y `/llms.txt` no tienen un solo test

**Severidad: media.** Son las dos superficies que consumen agentes, y las dos
únicas sin gate.

`/cv` tiene diez tests sobre el PDF, la landing tiene tres checks, el bundle
tiene presupuesto. Estos dos endpoints no tienen nada. Por ahí ya entró un bug
real de `formatRoleTitle` en `llms.txt` (registrado en el PR #1).

**Comprobarlo:**

```bash
ls src/pages/*.test.ts        # no existe ninguno
grep -rl "cv.json" --include="*.check.ts" scripts/   # solo single-landing, y de refilón
```

**Arreglo.** Un `endpoints.check.ts` que, sobre `dist/`, verifique que
`cv.json` parsea, que trae las claves que el contrato promete, y que
`llms.txt` no tiene campos vacíos ni títulos de rol partidos. Encaja con los
otros checks que ya leen `dist/`.

---

## 9. El agrupado de skills está duplicado, y divergió

**Severidad: baja.** Nadie se rompe; el CV y el JSON dicen lo mismo distinto.

Dos lugares agrupan skills por categoría, sin compartir nada:

| Dónde | Cómo |
|---|---|
| `src/components/cv/SkillList.astro:22` | Array `GRUPOS`, etiquetas en español y **orden editorial** — primero lo que más se busca en un aviso |
| `src/pages/llms.txt.ts:32` | `Object.entries(view.skills)` crudo: claves en inglés, orden de inserción |

O sea que el CV dice `Lenguajes: ...` y `/llms.txt` dice `- language: ...`, en
otro orden. Un agente que compare las dos superficies ve dos taxonomías.

**Arreglo.** Mover `GRUPOS` a `content/schema/` y que los dos importen de ahí.
Es el mismo patrón que ya se aplicó con `formatMetric` (regla 4) y con
`pdf-options.ts`: cuando dos salidas tienen que decir lo mismo, la definición
va en un solo lado.

---

## 10. Nada verifica que las fuentes estén embebidas en el PDF

**Severidad: baja, con cola larga.**

Se comprobó a mano una vez y se embeben. Pero si algún día dejaran de
embeberse, el PDF se vería bien en tu máquina —que tiene Manrope instalada— y
saldría con una fuente de fallback en la de cualquier otro. Ninguno de los diez
tests del PDF lo mira: todos verifican el TEXTO extraído, que no cambia.

**Riesgo nuevo desde el 2026-08-25:** el PDF ahora lo imprime Browser Rendering,
otro Chromium en otra máquina. Es exactamente el cambio que podría romper esto
sin que nada avise.

**Arreglo.** `pdfjs` expone las fuentes de cada página; un test que afirme que
todas están embebidas entra en `pdf-output.check.ts`, y como ese archivo ya
corre contra el PDF publicado (`PDF_SOURCE`), cubriría los dos caminos de una.

---

## 11. `pnpm audit`: 5 vulnerabilidades transitivas, una high

**Severidad: baja en la práctica, alta en el papel.**

Medido el 2026-08-25 — y son más que las 3 que registraba el PR #1:

```
5 vulnerabilities found
Severity: 2 low | 2 moderate | 1 high
```

La high es `sharp <0.35.0`, por la cadena `. > astro > sharp`.

**Por qué la exposición real es chica.** La salida es HTML estático: no hay
runtime del lado del servidor que un atacante pueda alcanzar. `sharp` corre en
build time, sobre imágenes que ponés vos.

**Por qué es deuda igual.** `pnpm run audit:deps` está en los comandos del
repo, y hoy siempre falla. Un comando que siempre falla deja de leerse — el
mismo problema del punto 2, con otra cara.

**Arreglo.** El fix de fondo es subir Astro, que es un major. Mientras tanto,
`pnpm.overrides` para forzar `sharp >= 0.35.0` y ver si el árbol lo aguanta.

---

## 12. Tres criterios de aceptación viven en un plan, no en CI

**Severidad: baja.**

El plan `docs/superpowers/plans/2026-08-13-cv-como-sistema.md` deja tres
criterios como comandos sueltos para pegar en la terminal. Un criterio de
aceptación que no corre solo es una intención, que es justo lo que
`docs/CONTRATO.md` §7 dice que no se hace.

Uno de los tres, el que verificaba que el teléfono no llegara a `dist/`, quedó
sin objeto el 2026-08-25: el dataset ya no lleva teléfono. Los otros dos hay
que leerlos y decidir si valen un check o si ya los cubre otro.

---

## 13. Dos cosas nunca se miraron a ojo

**Severidad: no medible, y por eso está acá.**

- **El hover cruzado tarjeta ↔ mapa.** Está verificado que los ids del DOM
  coinciden 3/3 con las reglas `:has()` y que no hay huérfanos. Eso prueba que
  el CSS apunta a algo, no que se vea bien.
- **La inercia de la píldora.** Simulada antes de commitear —arrastra 19.9 px,
  cruza el cero 200 ms después de frenar, rebota 3.5 px— y apagada bajo
  `prefers-reduced-motion`. Los números son correctos; la sensación hay que
  sentirla.

No hay test que reemplace abrir el navegador. Queda anotado para que no se
confunda "verde en CI" con "revisado".

---

## 14. `smoke-deploy.yml` nunca corrió — **RESUELTO 2026-08-25**

**Severidad: era alta.** Un gate que no corre es peor que no tener gate: igual
da la sensación de estar cubierto.

El workflow escuchaba `deployment_status`, asumiendo que Cloudflare Pages creaba
GitHub Deployments. **No los crea:** publica un *check run* llamado
`Cloudflare Pages`. El evento nunca se disparó.

Medido antes de arreglarlo:

```
corridas de smoke-deploy.yml:  0
deployments en la API del repo: 0
check runs sobre main:          Cloudflare Pages (app: cloudflare-workers-and-pages)
                                validate        (app: github-actions)
```

O sea que el PDF publicado nunca pasó por su gate, mientras la lista de Actions
mostraba todo en verde.

**Es la segunda vez que pasa lo mismo con otra cara.** La primera fue un CR
literal que dejó el YAML inválido (§ del arreglo en el mismo archivo). Aquella
la ataja ahora `workflows.check.ts`; esta no la ataja nadie, porque el YAML era
válido y el disparador simplemente no existía. **No hay forma de verificar
estáticamente que un evento se dispare** — solo mirar si el workflow corrió
alguna vez.

**Arreglo.** Dispara con `push` a `main`/`staging`, que sí ocurre siempre. Como
el push y el deploy no son el mismo momento, se agregó `src/pages/build.json.ts`
con `CF_PAGES_COMMIT_SHA`: el workflow poletea esa URL hasta que el commit
servido coincide con el pusheado, y recién entonces corre los tests.

Dormir un rato fijo hubiera sido la versión frágil: verificaría el deploy
anterior cada vez que el build tardara de más, **y pasaría en verde**.

---

## 15. Los checks miran `dist/`, no lo que se sirve — **CUBIERTO 2026-08-25**

**Severidad: era media, y con un caso concreto encima.**

`no-client-js.check.ts`, `bundle-budget.check.ts` y `single-landing.check.ts`
leen archivos de `dist/`. Todo lo que pase **después** del build es invisible
para ellos: una inyección en el borde, una regla de transformación, un
`_headers` mal puesto.

El caso que lo hizo urgente no es hipotético: habilitar Cloudflare Web Analytics
desde el dashboard de Pages inyecta su beacon en **todo** el sitio en el próximo
deploy. Eso pondría JavaScript en `/cv` —de donde Browser Rendering imprime el
PDF— y los cinco checks seguirían en verde, porque el `dist/` no cambió.

**Cubierto con `scripts/servido.check.ts`**, que corre desde el smoke contra la
URL publicada y verifica lo que el dist no puede decir:

- `/cv` servida no carga ningún `<script src>`
- `/cv` servida no menciona ninguna de las tres huellas de analítica
- una ruta inventada devuelve `404` y no `200`

Verificado contra producción el 2026-08-25: 3/3. Y contra un sitio cualquiera
que sí sirve JS, falla — o sea que el test distingue, no pasa siempre.

**Lo que queda abierto:** la cobertura es de tres afirmaciones, no de todos los
invariantes. El presupuesto de bytes y la sincronía landing↔PDF se siguen
midiendo solo sobre `dist/`. Ampliarlo es sumar tests a ese archivo; no hace
falta arquitectura nueva.

---

## 16. El smoke trataba un 429 como un PDF roto — **RESUELTO 2026-08-25**

**Severidad: era media.** No rompía el sitio; rompía la confianza en el gate.

La primera corrida real del smoke sobre `main` falló así:

```
https://cribbnicolas.pages.dev/cv.pdf devolvió 429 Too Many Requests
```

El sitio estaba perfecto: la verificación manual contra esa misma URL, minutos
después, pasaba 13/13.

**Qué había pasado.** La cadena `staging` → `main` son **dos deploys seguidos
por diseño**, y cada uno pide un render en frío a Browser Rendering. Corrieron
con 105 segundos de diferencia (21:43 y 21:44:58) y se cruzaron con los límites
del plan gratuito: 3 browsers concurrentes, una instancia nueva cada 20 s.

**La incoherencia.** `functions/cv.pdf.ts` maneja el 429 explícitamente —lo
propaga con su `Retry-After` en vez de devolver un PDF roto— y esa parte
funcionó. Pero el smoke trataba cualquier respuesta distinta de 200 como fallo.
Un 429 dice "esperá", no "está roto", y el gate no distinguía.

Eso importa más de lo que parece: **un gate que se pone en rojo por cuota
entrena a ignorarlo**, y un gate que se ignora ya no existe. Es la misma familia
de problemas que las entradas 14 y 15, con otra cara — no que no corra, sino que
corra y mienta.

**Arreglo.** Un paso previo en `smoke-deploy.yml` que calienta el PDF tolerando
el 429: reintenta hasta 6 veces respetando el `Retry-After` que propaga la
Function, y distingue el 429 (cuota, paciencia larga) de un 5xx (fallo real,
paciencia corta). Como efecto secundario deja el PDF en el caché de borde del
colo que le tocó al runner, así que el test siguiente pega caché y **no gasta
otro render**.

`pdf-output.check.ts` además separa el mensaje del 429 del resto, para que
alguien que lo corra a mano no salga a depurar la Function cuando no hay nada
que depurar.

**Lo que queda abierto:** si algún día los 10 minutos diarios de browser se
agotan de verdad, el smoke va a fallar y va a tener razón. No hay forma de
distinguir "cuota diaria agotada" de "cuota momentánea" desde afuera; el
mensaje de error lo dice para que quien lo lea sepa dónde mirar.

---

## 17. El `<head>` tiene siete etiquetas — **RESUELTO 2026-08-25**

Hecho: Open Graph y Twitter Card en la landing, favicon SVG, `sitemap-index.xml`
con `/cv` excluida, y un `robots.txt` propio que anuncia el sitemap y los dos
endpoints para agentes.

La imagen social era lo único que quedaba, y también está hecha: ver §18, que
se cerró el mismo día.

**Una corrección a lo que decía esta entrada:** afirmaba que *"sin `og:image` no
hay tarjeta aunque estén las etiquetas"*. Es falso. LinkedIn, Slack y WhatsApp
muestran una tarjeta de título y descripción sin imagen; lo que falta es el
bloque visual, no la tarjeta. Por eso se emitieron las etiquetas ahora en vez de
esperar a la imagen, y por eso `twitter:card` va en `summary` y no en
`summary_large_image`: el grande reserva el espacio de la imagen y sin ella se
degrada peor.

**Dos cosas sin verificar contra un deploy:**

- Que `src/pages/robots.txt.ts` le gane al `robots.txt` gestionado de
  Cloudflare. Se comprueba abriendo `/robots.txt` en la preview de `staging`.
- Cómo se ve la tarjeta de verdad. Se comprueba pegando la URL de la preview en
  un chat.

Lo de abajo queda como registro de por qué existía.

**Severidad: era alta para un portfolio.**

Medido sobre producción el 2026-08-25:

```
etiquetas en <head>:  7   (charset, viewport, title, description,
                           canonical, 2 hojas de estilo)
og:*                  0
twitter:*             0
JSON-LD               1   (Person, server-rendered)
/favicon.ico          404
/favicon.svg          404
/sitemap.xml          404
```

**Por qué es alta y no cosmética.** El canal por el que un portfolio se
distribuye es pegar el link: LinkedIn, WhatsApp, un mail, un mensaje a un
reclutador. Sin Open Graph, todos esos lugares muestran **una URL pelada**, sin
título, sin descripción y sin imagen — al lado de cualquier otro link que sí
tiene tarjeta. Es la primera impresión, y hoy no existe.

Y no alcanza con agregar las etiquetas: **no hay ni un solo asset de imagen en
el repo**. Sin `og:image` no hay tarjeta aunque el resto esté.

**Lo que sí está bien**, para no tocarlo de más: `canonical` correcto desde que
`SITE_URL` se aplicó, `lang="es"`, `/cv` con `noindex` a propósito, y ningún
`x-robots-tag` que bloquee la indexación de `pages.dev`.

**Sobre `robots.txt`:** hoy Cloudflare sirve uno gestionado que son **solo
comentarios** —cero `User-agent`, cero `Disallow`, cero `Sitemap:`—. O sea que
no restringe nada, pero tampoco anuncia nada. Al agregar `public/robots.txt` hay
que **verificar contra un deploy si el nuestro le gana al gestionado**: no está
probado.

**Para búsqueda por IA el contenido ya está** —`/llms.txt`, `/cv.json` y el
JSON-LD—; lo que falta es descubrimiento. Sin sitemap ni `robots.txt` que los
referencie, esas tres salidas dependen de que alguien las adivine.

**Arreglo, por orden de impacto:**

1. `og:*` + `twitter:*` en `Base.astro`, derivados del `title`/`description` que
   ya recibe. Cuidado: `/cv` **no** debe llevarlos — es `noindex` y no es un
   destino compartible.
2. Una imagen social. Puede generarse en build desde el nombre y el título con
   el mismo criterio tipográfico del sitio; no hace falta diseñarla a mano.
3. Favicon.
4. `@astrojs/sitemap` y un `public/robots.txt` con la línea `Sitemap:`.


---

## 18. Falta la imagen social — **RESUELTO 2026-08-25**

**Resuelto.** `public/og.jpg` existe, lo genera `pnpm run og:local` y está
commiteado. Salió el camino que la entrada anotaba como "el más probable":
Playwright en local, el archivo al repo.

Lo que se decidió al hacerlo, y que esta entrada no preveía:

- **JPEG y no PNG.** No es preferencia: WhatsApp no llega a mostrar la
  previsualización si la imagen pesa de más, y un PNG de 1200×630 con una foto
  adentro se va bien arriba de ese techo. El JPEG a calidad 84 pesa 61 KB contra
  un tope de 300 KB, y el techo es un test, no un comentario.
- **UNA sola imagen para todas las redes.** Facebook, LinkedIn, WhatsApp, Slack,
  Discord y Twitter leen la MISMA etiqueta `og:image`. Lo que cambia entre ellas
  es cómo la recortan, no qué archivo piden. No hacía falta una por plataforma.
- **`twitter:card` pasó a `summary_large_image`.** Con una imagen de 1.91:1, el
  `summary` que había la recortaría a un cuadradito.
- **La huella normaliza los saltos de línea.** El repo corre con
  `core.autocrlf=true`: sin normalizar, el hash de la plantilla daba distinto en
  Windows y en el runner de CI, y el gate fallaba sin que nada hubiera cambiado.

También salió de acá `src/lib/marca.ts`: la geometría de la marca la dibujaban
el logo del header y la tarjeta social, y una `d=` copiada diverge la primera
vez que alguien ajusta una curva. `public/favicon.svg` no puede importarla —es
un archivo estático— así que `og-output.check.ts` verifica que su path siga
siendo el del módulo.

Lo de abajo queda como registro de la decisión.

**Severidad: era media.** Salía de partir la §17: las etiquetas ya estaban, la
imagen no, y no había **ni un solo asset de imagen en el repo**.

Con título y descripción la tarjeta ya sale. Con imagen ocupa cuatro veces más
espacio en un feed, que es la diferencia entre que el link se note y que pase.

**La decisión que hay adentro**, y por eso no se hizo de una:

| Camino | A favor | En contra |
|---|---|---|
| Generarla en build desde el dato | Se mantiene sola cuando el nombre o el título cambian; usa los mismos tokens tipográficos | Rasterizar necesita un browser, y el builder de Cloudflare no tiene Chromium — el mismo problema que sacó al PDF del build |
| Un PNG a mano en `public/` | Diez minutos | Se desactualiza en silencio |
| Una Function como `/cv.pdf` | Consistente con lo que ya existe | Un crawler que espera 3-5 s puede cortar, y gasta presupuesto de Browser Rendering en cada scrape |

**SVG no es opción:** LinkedIn, Facebook y WhatsApp no renderizan `og:image` en
SVG. Tiene que ser PNG o JPEG.

El camino más probable es el primero con una vuelta: generarla con
`pnpm run og:local` —Playwright, igual que `pdf:local`— y **commitear el PNG**.
Así no hay costo en runtime ni dependencia del builder, y un check puede avisar
si el dato cambió y la imagen no se regeneró.

Al agregarla hay que cambiar también `twitter:card` a `summary_large_image` y
sumar `og:image`, `og:image:width`, `og:image:height` y `og:image:alt` en
`Base.astro`.
