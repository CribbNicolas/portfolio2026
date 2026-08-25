# 05 — Deploy y analítica

Decidido el 2026-08-24. **Revisado el 2026-08-25:** el build pasó de GitHub
Actions a Cloudflare Pages, y el PDF de build-time a runtime. El §1 viejo decía
que el build no podía correr en el host; eso dejó de ser cierto y por qué está
abajo. El stack entero sigue siendo gratuito salvo el dominio.

| Capa | Servicio | Costo | Estado |
|---|---|---|---|
| Hosting **y build** | Cloudflare Pages | Gratis (500 builds/mes) | Pendiente |
| PDF a demanda | Cloudflare Browser Rendering | Gratis (10 min de browser/día) | Pendiente |
| Gates de calidad | GitHub Actions | Gratis (repo privado: 2.000 min/mes) | Ya corre |
| Heatmap y sesiones | Microsoft Clarity | Gratis ilimitado | Pendiente |
| Tráfico y Web Vitals | Cloudflare Web Analytics | Gratis | Pendiente |
| Dominio | A definir | ~10-15 USD/año | No bloqueante |

---

## 1. Por qué este stack

**Cloudflare Pages y no Azure Static Web Apps ni GitHub Pages.** Pages da banda
y requests ilimitados en el tier gratuito, 500 builds al mes y dominios propios
sin tope. Azure Free corta en 100 GB de banda y 2 dominios. GitHub Pages queda
afuera directamente: el repo es privado y Pages sobre repo privado exige GitHub
Pro.

**El build corre en Cloudflare.** Antes no podía: `pnpm run build` levantaba
Playwright y Chromium para imprimir `dist/cv.pdf`, y ningún builder de host trae
un browser. La respuesta de entonces fue buildear en Actions y subirle `dist/`
ya armado a Pages. Eso funcionaba pero ataba dos cosas que no tienen por qué
estar atadas: **generar el sitio** y **generar el PDF**.

Se desataron. `pnpm run build` es hoy `astro build` y nada más. El PDF pasó a
`functions/cv.pdf.ts`, que lo imprime a demanda. Dos consecuencias, y la segunda
es la que importa a largo plazo:

1. El build corre en cualquier lado. Pages incluido, sin Chromium.
2. **El PDF deja de ser un artefacto del build.** El día que los datos vengan de
   una API en vez de `content.es.json`, el CV en PDF sale al día sin que nadie
   regenere un archivo. Lo único que tiene que estar al día es `/cv`.

**El PDF se imprime con Browser Rendering, no con una librería de PDF.** Armar
el PDF con `pdf-lib` o similar significaría escribir el layout dos veces —una en
CSS para `/cv`, otra en coordenadas para el PDF— y esas dos copias se
desincronizan. `src/pages/cv.astro` promete que HTML y PDF no pueden divergir
porque hay un solo layout. Browser Rendering mantiene esa promesa: imprime
exactamente la página que ya existe.

**Se usa la REST API y no el binding.** Pages Functions soporta un subconjunto
de bindings (KV, D1, R2, Durable Objects, Queues, Workers AI, service bindings)
y Browser Rendering **no** está en ese subconjunto. La REST API sí es un `fetch`
común, con un token. Si algún día hace falta Puppeteer completo, la salida es
migrar de Pages a Workers con assets estáticos, donde el binding sí existe.

**El presupuesto no es un problema a esta escala.** El plan gratuito da 10
minutos de browser por día y 3 browsers concurrentes. Un render de `/cv` tarda
3-5 s. Con el TTL de una hora del caché de borde, el costo real es del orden de
una render por deploy — un par por semana. Si algún día se agotara, la Function
propaga el 429 con su `Retry-After` en vez de devolver un PDF roto.

**Clarity y no solo Cloudflare Web Analytics.** No son alternativas: CWA no hace
heatmaps. Da pageviews, referrers, país, navegador y Core Web Vitals. La pregunta
que se quiere contestar —qué partes del CV se leen y cuáles no— la contesta
Clarity con heatmaps de click, scroll y área, más grabaciones de sesión. Los dos
son gratis y miden cosas distintas, así que van los dos.

**Clarity va en la landing, no en `/cv`.** Desde el 2026-08-24 el CV completo
vive en `#cv` de la home, y `/cv` quedó con `noindex` y sin links entrantes
(ver [00-indice](./00-indice.md)). Poner el script en `/cv` además de inútil
violaría el invariante de cero JS en esa página — y ese invariante **subió de
precio** con este cambio: antes un script que se colara rompía tu build local,
ahora rompe el PDF en producción, porque Browser Rendering imprime la página
publicada. `scripts/no-client-js.check.ts` lo sigue atajando en CI.

### Lo que ya está verificado

Clarity entra en la landing sin tocar los gates de CI:

- `scripts/no-client-js.check.ts:31` — `PAGINAS_CON_JS` ya contiene
  `index.html`. La home puede cargar scripts externos. **No hay que tocar la
  whitelist.**
- `scripts/bundle-budget.check.ts:34` — `TECHO_HTML_KB = 30`. La landing mide
  hoy 9.9 KB gzip y el snippet de Clarity es inline de ~500 bytes.
- `TECHO_CRITICO_KB = 4` mide chunks de `dist/_astro/`. Clarity se sirve desde
  `clarity.ms`, así que no cuenta contra ese techo.

---

## 2. Dónde corre cada cosa

```
push a cualquier rama
      |
      +--> GitHub Actions · content-validation.yml       <- GATE DE CALIDAD
      |      typecheck · validate · test · build
      |      pdf:local (Playwright) · test:pdf           <- el PDF pasa el ATS
      |      test:js · test:bundle · test:landing
      |      audit:todos (no bloquea)
      |
      +--> Cloudflare Pages · build automatico           <- PUBLICA
             pnpm run build -> dist/
             staging -> URL de preview
             main    -> produccion
                   |
                   +--> GitHub Actions · smoke-deploy.yml  <- GATE POST-DEPLOY
                          GET <url>/cv.pdf
                          test:pdf sobre esos bytes        <- el PDF SERVIDO pasa el ATS
```

**Por qué el gate está dos veces.** `pdf:local` imprime con Playwright en el
runner; producción imprime con Browser Rendering. Son dos Chromium distintos
sobre el mismo layout. El primero bloquea el merge sin depender de la red de
nadie; el segundo es lo único que prueba que lo que baja la gente parsea. Las
assertions son las mismas —`scripts/pdf-output.check.ts`— y lo único que cambia
es de dónde salen los bytes (`PDF_SOURCE`).

**Actions ya no deployea.** No hay token de Cloudflare en GitHub, y por lo tanto
no hay nada que rotar si un log se filtra. Pages buildea el repo por su cuenta.

**El flujo de trabajo es `staging` → `main`.** Se trabaja en `staging`, que tiene
su propia URL de preview con la Function funcionando; el smoke corre contra esa
preview. Recién cuando todo está verde se mergea a `main`, que es la rama de
producción. Para que "verde" signifique algo, hay que proteger `main` — paso 6.

---

## 3. Qué configurar en Cloudflare (checklist)

Van en orden: cada uno depende del anterior.

### Paso 1 — Crear el proyecto en Pages

Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.

> Es lo contrario de lo que decía la versión anterior de este doc, que mandaba
> "Upload assets" porque el build no podía correr en el host. Ahora sí puede.

| Campo | Valor |
|---|---|
| Repositorio | `CribbNicolas/portfolio2026` |
| Production branch | `main` |
| Framework preset | **None** (el preset de Astro fija el build command; acá interesa que sea explícito) |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| Root directory | *(vacío)* |

El nombre del proyecto va a ser parte de `*.pages.dev` y no se cambia fácil.
Elegilo pensando que se ve.

### Paso 2 — Variables de build (Settings → Variables and Secrets)

**Estas tres son obligatorias y sin ellas el build falla o publica mal.** Van
como *plaintext*, para el entorno **Production** y también para **Preview** (las
preview builds de `staging` las necesitan igual):

| Nombre | Valor | Por qué |
|---|---|---|
| `NODE_VERSION` | `24` | La build image v3 arranca en Node 18.17.1. `package.json` pide `>=22.12` y `astro sync` no levanta con 18. |
| `PNPM_VERSION` | `11.1.3` | La v3 trae pnpm 10.11.1. `packageManager` declara `pnpm@11.1.3` y `engines` pide `>=11`. |
| `SITE_URL` | tu URL | Sin esto el JSON-LD y el canonical salen apuntando a `https://portfolio.invalid` (`astro.config.mjs:6`). **Hasta que compres el dominio, poné la URL de `*.pages.dev`** — así el sitio queda coherente desde el primer deploy. En Preview conviene dejar la misma. |

### Paso 3 — El token de Browser Rendering

My Profile → **API Tokens** → **Create Token** → **Custom token**.

- Permiso: **Account → Browser Rendering → Edit**. Uno solo. Nada más.
- Sin fecha de expiración, o con recordatorio de renovación.

Este token **no** es el de deploy — ese ya no existe. Da permiso para pedir
renders en tu cuenta. Si aparece en un log o en un commit, revocalo y generá
otro: rotarlo cuesta dos minutos, limpiar el historial de git no.

También necesitás el **Account ID**: Dashboard → Workers & Pages → panel derecho.

### Paso 4 — Variables de runtime (Settings → Variables and Secrets)

Las lee `functions/cv.pdf.ts`. **Cargalas en Production Y en Preview**, o el
`/cv.pdf` de las previews de `staging` devuelve 503 y el smoke corta ahí.

| Nombre | Tipo | Valor |
|---|---|---|
| `BROWSER_RENDERING_ACCOUNT_ID` | Plaintext | El Account ID del paso 3 |
| `BROWSER_RENDERING_TOKEN` | **Secret** (encrypt) | El token del paso 3 |
| `PDF_FILENAME` | Plaintext, opcional | Con qué nombre se guarda el archivo. Ej: `CV-Nicolas-Cribb.pdf`. Default: `cv.pdf` |

### Paso 5 — Verificar `/cv.pdf` en la preview de `staging`

Pushear `staging`, esperar el deploy y abrir
`https://<hash>.<proyecto>.pages.dev/cv.pdf`.

**Esto es lo primero que hay que mirar, antes que cualquier otra cosa.** Lo que
está sin verificar contra Cloudflare real es si Pages rutea un archivo con punto
en el nombre: `functions/cv.pdf.ts` debería mapear a `/cv.pdf` (Pages saca solo
la última extensión), pero no está probado contra un deploy.

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| El PDF se abre | Todo bien | Seguir al paso 6 |
| HTML / 404 | La ruta no matcheó la Function | Renombrar a `functions/cv-pdf.ts` y agregar `/cv.pdf /cv-pdf 200` en `public/_redirects` (rewrite, no redirect: la URL sigue siendo `/cv.pdf`) |
| `503 El PDF no está configurado` | Faltan las variables del paso 4 en ese entorno | Cargarlas en **Preview** también |
| `502 No se pudo generar el PDF` | El token no tiene el permiso, o la cuenta no tiene Browser Rendering habilitado | Revisar el paso 3 |
| `429` | Se agotaron los 10 min del día | Esperar. A este volumen no debería pasar |

Si el PDF abre pero **sin tagging**, el smoke lo va a decir con el mensaje `el
PDF no está tagged`. Significaría que Browser Rendering ignora `tagged`/`outline`
en `pdfOptions`. La salida entonces es migrar el hosting a Workers con assets
estáticos, donde el binding da Puppeteer completo — no aflojar el test.

### Paso 6 — Proteger `main`

En GitHub: Settings → Branches → Add rule sobre `main`.

- Require a pull request before merging.
- Require status checks to pass → **`validate`** (el job de `content-validation.yml`).

Sin esto, "todo verde antes de mergear" es una intención, no un mecanismo — y el
orden viejo (deployar sólo después de la secuencia completa) se perdería sin
reemplazo, porque Pages publica apenas ve el push.

### Paso 7 — Dominio propio

Pages → el proyecto → **Custom domains** → **Set up a domain**. Si el dominio
está en la misma cuenta de Cloudflare, el registro DNS se crea solo y el
certificado sale en minutos. Después, actualizar `SITE_URL` (paso 2) y volver a
deployar: el canonical y el JSON-LD salen de ahí.

Comprarlo en Cloudflare Registrar sale a precio de costo y queda en la misma
cuenta. Cualquier registrador sirve, pero entonces hay que apuntar los
nameservers a Cloudflare.

### Paso 8 — Cloudflare Web Analytics

Dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site**.

Si el sitio se sirve por Cloudflare con dominio propio, se puede activar sin
tocar el HTML. Si pide el beacon, es un `<script defer>` que va en
`src/layouts/Base.astro`, **condicionado a que no sea `/cv`** — ver el paso 9,
mismo mecanismo.

### Paso 9 — Microsoft Clarity

1. Crear cuenta en `clarity.microsoft.com`, proyecto nuevo, anotar el
   **Project ID**.
2. El snippet va **solo en la landing**. Dos formas, en orden de preferencia:
   - En `src/pages/index.astro`, dentro del `<Base>` con `slot="head"`. Es la
     página que ya está en `PAGINAS_CON_JS`, así que no hay que tocar ningún
     check.
   - En `Base.astro` con una guarda por ruta. Más frágil: si mañana aparece otra
     página, hay que acordarse de la guarda.
3. El Project ID no es secreto —viaja en el HTML de cada visita— pero conviene
   leerlo de una variable de entorno igual, para no tener que tocar código si
   cambia de proyecto.

**Después de agregarlo, correr `pnpm run build && pnpm run test:js` y verificar
que `/cv` sigue en cero JS.** Es exactamente el escenario que ese check existe
para atajar, y ahora un fallo ahí sale impreso en el PDF.

---

## 4. Probar la Function en local

No hace falta para trabajar en el CV: `pnpm run dev` sirve `/cv` en HTML y
`pnpm run pdf:local` imprime el PDF con Playwright, los dos sin tocar la nube.
Esto es solo para probar `functions/cv.pdf.ts`.

```bash
cp .dev.vars.example .dev.vars   # y completar los dos valores
pnpm run build
pnpm dlx wrangler pages dev dist   # dlx: wrangler no es dependencia del repo
# -> http://localhost:8788/cv.pdf
```

Browser Rendering va a intentar imprimir `http://localhost:8788/cv`, que desde
la nube de Cloudflare no resuelve. O sea: en local la Function verifica el
ruteo, el caché y el manejo de errores, **no** el render. El render se prueba en
la preview de `staging` (paso 5).

---

## 5. Privacidad

Clarity usa cookies y graba sesiones; CWA no usa ninguna. El sitio no tiene
formularios y Clarity enmascara inputs por defecto, así que el riesgo real es
bajo — pero si llega tráfico de la UE, técnicamente hace falta consentimiento.
Lo mínimo razonable es una línea en el pie diciendo que se mide el uso de la
página con Clarity, con link a su política.

---

## 6. Expectativas sobre los datos

**Un heatmap con 30 visitas al mes es ruido.** Hacen falta varios cientos de
sesiones para que los puntos calientes signifiquen algo. En las primeras semanas
lo útil van a ser las **grabaciones de sesión** —cinco sesiones reales dicen más
que un heatmap con veinte clicks— y el **scroll depth**, que necesita mucho menos
volumen para ser legible.

Las tres preguntas que vale la pena mirar:

1. **¿Llegan al CV?** Si el scroll muere en el mapa, la landing es linda y no
   convierte.
2. **¿Bajan el PDF?** Click en el flotante contra click en el botón del hero.
   Si el flotante no se usa, sobra.
3. **¿Qué sección del CV retiene?** Es lo que dice qué logros están bien escritos
   y cuáles no.

---

## 7. Estado

- [ ] Proyecto de Cloudflare Pages creado, conectado al repo (§3 paso 1)
- [ ] `NODE_VERSION`, `PNPM_VERSION`, `SITE_URL` cargadas en Production y Preview (§3 paso 2)
- [ ] Token de Browser Rendering creado (§3 paso 3)
- [ ] `BROWSER_RENDERING_*` cargadas en Production y Preview (§3 paso 4)
- [ ] **`/cv.pdf` verificado en la preview de `staging`** (§3 paso 5) — bloquea el merge a `main`
- [ ] `main` protegida con el check `validate` (§3 paso 6)
- [ ] `smoke-deploy.yml` en `main` y disparando (solo funciona una vez que está en la rama por defecto)
- [ ] Dominio comprado, apuntado, y `SITE_URL` actualizado (§3 paso 7)
- [ ] Cloudflare Web Analytics activo (§3 paso 8)
- [ ] Clarity en la landing + `test:js` verde (§3 paso 9)
- [ ] Línea de privacidad en el pie
