# 08 — Ramas y versionado

Decidido el 2026-08-25, al agregar `develop` y hacer el repo público.

---

## 1. Las cuatro ramas

```
feature/*  ──►  develop  ──►  staging  ──►  main
   |              |             |            |
 trabajo      integración    preview      producción
              sin deploy     en Pages     cribbnicolas.pages.dev
              + bump         + smoke
```

| Rama | Qué es | Deploya |
|---|---|---|
| `feature/*` | Un cambio. Vive lo que dura | No |
| `develop` | **Integración.** Junta PRs hasta que valga la pena publicar | **No** |
| `staging` | Lo que va a salir. Preview real, con la Function andando | Sí, preview |
| `main` | Lo publicado | Sí, producción |

**Por qué existe `develop`.** Sin ella, cada PR chico dispara un deploy de
preview: un build de Cloudflare y, en cuanto alguien abre `/cv.pdf`, un render
de Browser Rendering. El presupuesto no es el problema real —a este volumen
sobra— pero el ruido sí: veinte deploys por semana hacen que mirar el historial
de deploys deje de decir nada. `develop` acumula, y `staging` publica cuando hay
algo que valga la pena mirar.

**`develop` no deploya, y eso hay que configurarlo.** Cloudflare Pages, con
Preview deployments en "All non-Production branches", deployaría `develop` y
cada rama de feature — que es exactamente lo que se está evitando. La config
correcta es **Custom branches, incluyendo sólo `staging`**. Ver
[05](./05-deploy-y-analitica.md) §3 paso 2b.

**Qué corre en cada una.** `content-validation.yml` corre en todas: el gate de
calidad no depende de si algo se publica. Lo que cambia es lo demás:

| Workflow | Cuándo |
|---|---|
| `content-validation.yml` | Todo push y todo PR |
| `version-gate.yml` | Sólo PRs que apuntan a `develop` |
| `smoke-deploy.yml` | Cada deploy con éxito de Pages (o sea: `staging` y `main`) |

---

## 2. Nadie pushea directo a las tres ramas

Se hace cumplir con **rulesets de GitHub**, no con hooks locales.

Se evaluó un hook `pre-push` y se descartó: un hook corre en la máquina de quien
pushea, y el botón "Merge pull request" corre en los servidores de GitHub. O sea
que el hook tapaba el caso chico —el push por distracción— y dejaba abierto el
grande. Los rulesets tapan los dos, del lado del servidor, sin que nadie tenga
que instalar nada.

**Por eso el repo es público.** Los rulesets no están disponibles en repos
privados con plan Free; en repos públicos andan en todos los planes. Esa es la
razón técnica del cambio, y el motivo por el que el teléfono salió del dataset
antes (ver §3).

Configuración, un ruleset por rama:

| Rama | Reglas |
|---|---|
| `main` | Require a pull request (0 approvals) · Require status checks: `validate` · Block force pushes · Restrict deletions |
| `staging` | Igual que `main` |
| `develop` | Igual, más el status check **`bump`** |

**`Required approvals` en 0, no en 1.** GitHub no deja aprobar el propio PR. Con
1, un repo de una sola persona queda trabado sin salida.

**`Require linear history`: no.** Prohíbe merge commits, y el historial de este
repo los usa.

---

## 3. `package.json` es la única fuente de verdad de la versión

**Revisado el 2026-08-25:** `package.json:3` es la única declaración de versión
del repo. No hay otra en `content/`, `src/`, `scripts/` ni `astro.config.mjs`, y
**nada la consume**: no sale en `/cv.json`, ni en `/llms.txt`, ni en un `<meta>`.
Es bookkeeping interno, a propósito.

**Por qué no se expone.** Un número de versión en la salida es una promesa: que
alguien lo va a poder usar para decidir algo. Hoy no hay quién. Cuando lo haya
—un consumidor del dataset que quiera saber si cambió, por ejemplo— se agrega
ahí y se dice para quién es. Exponerlo "por las dudas" sería inventar un
contrato sin contraparte.

**Si algún día aparece una segunda fuente**, la regla es que se derive de
`package.json` en build time, nunca que se escriba a mano en dos lados. Dos
números escritos a mano se desincronizan; la única duda es cuándo.

### El teléfono, y por qué ya no está

El dataset llevaba un teléfono con `publishPhoneOn: ["cv", "cv-short"]` — o sea,
declarado para el CV diseñado y el de una página, y filtrado de todo lo demás
por la regla 8. Ninguna de esas dos superficies está construida todavía, así que
no se imprimía en ningún lado.

Al hacer el repo público, ese número habría quedado en texto plano en un JSON
indexable. Se sacó el **valor**; la maquinaria queda intacta: el campo `phone?`
sigue en el schema, el filtro sigue en `resolveView`, y el test de la regla 8
ahora inyecta un número obviamente falso y verifica el filtro en vez de depender
de que el dataset lleve uno. Cargar un teléfono mañana no requiere tocar código.

Hay un segundo test que ancla la decisión: si alguien vuelve a poner un número
en el dataset, falla y explica que el repo es público y que eso entra al
historial de git, de donde no sale sin reescribirlo.

---

## 4. La versión sube al entrar a `develop`

**La regla:** todo PR que apunta a `develop` sube `package.json.version`. Sin
excepción, y lo hace cumplir `version-gate.yml`.

**Por qué en `develop` y no más adelante.** Es donde entra cada cambio, de a
uno. Si se versionara en `staging`, un lote de seis PRs compartiría un solo
número y la versión dejaría de identificar cuál de los seis rompió algo. Los
PRs de `develop` → `staging` y `staging` → `main` **no vuelven a tocar el
número: lo arrastran.** Así la versión que se ve en producción es exactamente la
que se verificó en preview, y antes en integración.

**Por qué a mano y no automático.** Elegir entre patch, minor y major es una
decisión semántica sobre qué cambió para quien consume el sitio, y una máquina
que mira diffs no la puede tomar bien. Un bot que siempre sube el patch produce
números que suben pero no significan nada.

Las alternativas se descartaron por razones concretas, no por gusto:

- **Bot que commitea a la rama**: necesita un token con escritura sobre una rama
  protegida, y deja la rama con un commit que la de origen no tiene → conflicto
  en el próximo merge, todas las veces.
- **Derivarlo de conventional commits**: hace que el versionado dependa de que
  los mensajes de commit sean siempre correctos. Cambia un problema de
  disciplina por otro, y suma una dependencia.

**Qué sube qué:**

| Salto | Cuándo |
|---|---|
| `patch` | Un arreglo. Nada nuevo, nada que se lea distinto |
| `minor` | Algo nuevo: una sección, un endpoint, un dato que antes no estaba |
| `major` | Algo que ya existía cambia de forma. Una URL que se va, un campo de `/cv.json` que cambia de nombre |

En un sitio personal, `major` va a ser raro. Ese es el punto: que cuando pase,
se note.

**Qué verifica el gate, exactamente.** Que la versión del PR sea
**estrictamente mayor** que la de `develop`. Eso es duro y bloquea.

Además clasifica el salto y, si no es un escalón limpio —`0.1.0 → 0.3.0`,
`1.2.3 → 2.0.1`— lo dice **sin bloquear**. Saltar a veces es a propósito, pero
es también la firma exacta de un typo, y callarlo sería peor que avisar de más.

**Correrlo antes de abrir el PR:**

```bash
git fetch origin develop
pnpm run test:version
```

La lógica pura está en `scripts/version.ts` y se testea en `pnpm test`
(`version.test.ts`), sin necesidad de un repo git alrededor. El check
(`version-bump.check.ts`) es sólo la capa que lee git y el archivo.

---

## 5. El flujo, en orden

1. Ramificar de `develop`. Trabajar. PR **a `develop`**, **con el bump de
   versión en el mismo PR**. Corren `content-validation.yml` y
   `version-gate.yml`. No se deploya nada.
2. Cuando lo acumulado valga la pena publicar: PR **`develop` → `staging`**, sin
   tocar la versión.
3. Al mergear, Pages deploya la preview y `smoke-deploy.yml` corre `test:pdf`
   contra el `/cv.pdf` publicado. Mirar que pase.
4. PR **`staging` → `main`**. Tampoco toca la versión. Al mergear, producción.
   El smoke corre de nuevo, ahora contra producción.

**El único paso que se puede olvidar es el bump del 1**, y es el único que tiene
un check propio.
