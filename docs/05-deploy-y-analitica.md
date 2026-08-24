# 05 — Deploy y analítica

Decidido el 2026-08-24. El stack entero es gratuito salvo el dominio.

| Capa | Servicio | Costo | Estado |
|---|---|---|---|
| Hosting | Cloudflare Pages | Gratis | Pendiente |
| Build + PDF | GitHub Actions | Gratis (repo privado: 2.000 min/mes) | Ya corre; falta el step de deploy |
| Heatmap y sesiones | Microsoft Clarity | Gratis ilimitado | Pendiente |
| Tráfico y Web Vitals | Cloudflare Web Analytics | Gratis | Pendiente |
| Dominio | A definir | ~10-15 USD/año | **Bloqueante** |

---

## 1. Por qué este stack

**Cloudflare Pages y no Azure Static Web Apps ni GitHub Pages.** Pages da banda
y requests ilimitados en el tier gratuito, 500 builds al mes y dominios propios
sin tope. Azure Free corta en 100 GB de banda y 2 dominios. GitHub Pages queda
afuera directamente: el repo es privado y Pages sobre repo privado exige GitHub
Pro.

**El build no puede correr en el host.** `pnpm run build` levanta Playwright y
Chromium para imprimir `dist/cv.pdf` desde `/cv`. Ni el builder de Cloudflare ni
el de Azure lo traen. Por eso el build vive en GitHub Actions —que ya instala
Chromium y ya corre la secuencia completa— y a Pages se le sube `dist/` ya
armado. Elegir otro host no evita este paso.

**Clarity y no solo Cloudflare Web Analytics.** No son alternativas: CWA no hace
heatmaps. Da pageviews, referrers, país, navegador y Core Web Vitals. La pregunta
que se quiere contestar —qué partes del CV se leen y cuáles no— la contesta
Clarity con heatmaps de click, scroll y área, más grabaciones de sesión. Los dos
son gratis y miden cosas distintas, así que van los dos.

**Clarity va en la landing, no en `/cv`.** Desde el 2026-08-24 el CV completo
vive en `#cv` de la home, y `/cv` quedó con `noindex` y sin links entrantes
(ver [00-indice](./00-indice.md), decisiones del 2026-08-24). Poner el script en
`/cv` además de inútil violaría el invariante de cero JS en esa página: de ahí
sale el PDF con Playwright esperando `networkidle`, y un script de terceros
cambiaría el render en silencio.

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

## 2. Pasos para conectar todo

Van en orden: cada uno depende del anterior.

### Paso 0 — El dominio (bloqueante)

Sin dominio, `SITE_URL` no se puede definir y el JSON-LD y el canonical salen
apuntando a `https://portfolio.invalid`. Ese valor es a propósito: el TLD
`.invalid` está reservado por RFC 2606, así que un deploy sin `SITE_URL` rompe
visiblemente en vez de publicar una URL equivocada que parece buena
(`astro.config.mjs:6`).

Comprarlo en Cloudflare Registrar sale a precio de costo y queda en la misma
cuenta. Cualquier registrador sirve, pero entonces hay que apuntar los
nameservers a Cloudflare.

### Paso 1 — Crear el proyecto en Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets** (no "Connect to Git": el build lo hace Actions).
2. Nombre del proyecto: algo estable, va a ser parte de `*.pages.dev`.
3. Subir cualquier `index.html` de prueba para que el proyecto exista. Los
   deploys reales los va a pisar el workflow.

### Paso 2 — Credenciales

1. **Account ID:** Dashboard → Workers & Pages → panel derecho.
2. **API token:** My Profile → API Tokens → Create Token → **Custom token**.
   - Permiso: `Account` → `Cloudflare Pages` → `Edit`. Nada más.
   - Sin fecha de expiración o con recordatorio de renovación.

El token da permiso de escritura sobre los deploys de la cuenta. **Va como
secret de GitHub, nunca en el repo ni en un archivo de config.** Si alguna vez
aparece en un log o en un commit, revocalo y generá otro: rotarlo cuesta dos
minutos, limpiar el historial de git no.

### Paso 3 — Secrets en GitHub

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Nombre | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | El token del paso 2 |
| `CLOUDFLARE_ACCOUNT_ID` | El Account ID del paso 2 |

Y como **variable** (no secret, no es sensible y conviene verla en los logs):

| Nombre | Valor |
|---|---|
| `SITE_URL` | `https://tudominio.com` |

### Paso 4 — El step de deploy

En `.github/workflows/content-validation.yml`, después de `audit:todos` y del
upload del artifact. Solo en `main`: una rama de trabajo no debe pisar
producción.

```yaml
      - name: Deploy a Cloudflare Pages
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=<nombre-del-proyecto>
```

Y el `build` pasa a recibir la URL real:

```yaml
      - run: pnpm run build
        env:
          SITE_URL: ${{ vars.SITE_URL }}
```

El deploy va **después** de toda la secuencia de verificación. Ese orden es la
garantía: si el PDF no parsea o la landing volvió a linkear `/cv`, no se
publica.

### Paso 5 — Dominio propio en Pages

Pages → el proyecto → **Custom domains** → **Set up a domain**. Si el dominio
está en la misma cuenta de Cloudflare, el registro DNS se crea solo y el
certificado sale en minutos.

### Paso 6 — Cloudflare Web Analytics

Dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site**.

Si el sitio se sirve por Cloudflare con dominio propio, se puede activar sin
tocar el HTML. Si pide el beacon, es un `<script defer>` que va en
`src/layouts/Base.astro`, **condicionado a que no sea `/cv`** — ver el paso 7,
mismo mecanismo.

### Paso 7 — Microsoft Clarity

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
para atajar.

---

## 3. Privacidad

Clarity usa cookies y graba sesiones; CWA no usa ninguna. El sitio no tiene
formularios y Clarity enmascara inputs por defecto, así que el riesgo real es
bajo — pero si llega tráfico de la UE, técnicamente hace falta consentimiento.
Lo mínimo razonable es una línea en el pie diciendo que se mide el uso de la
página con Clarity, con link a su política.

---

## 4. Expectativas sobre los datos

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

## 5. Estado

- [ ] Dominio comprado y `SITE_URL` definido — **bloquea todo lo demás**
- [ ] Proyecto de Cloudflare Pages creado
- [ ] Secrets y variable cargados en GitHub
- [ ] Step de deploy en el workflow
- [ ] Dominio propio apuntado a Pages
- [ ] Cloudflare Web Analytics activo
- [ ] Clarity en la landing + `test:js` verde
- [ ] Línea de privacidad en el pie
