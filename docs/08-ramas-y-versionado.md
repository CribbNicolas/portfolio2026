# 08 — Ramas y versionado

Decidido el 2026-08-25, al agregar `develop`.

---

## 1. Las cuatro ramas

```
feature/*  ──►  develop  ──►  staging  ──►  main
   |              |             |            |
 trabajo      acumula       preview      producción
              sin deploy    en Pages     cribbnicolas.pages.dev
                            + smoke
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
| `version-gate.yml` | Sólo PRs que apuntan a `staging` |
| `smoke-deploy.yml` | Cada deploy con éxito de Pages (o sea: `staging` y `main`) |

---

## 2. `package.json` es la única fuente de verdad de la versión

**Revisado el 2026-08-25:** `package.json:3` es hoy la única declaración de
versión del repo. No hay otra en `content/`, `src/`, `scripts/` ni
`astro.config.mjs`, y **nada la consume**: no sale en `/cv.json`, ni en
`/llms.txt`, ni en un `<meta>`. Es bookkeeping interno, a propósito.

**Por qué no se expone.** Un número de versión en la salida es una promesa: que
alguien lo va a poder usar para decidir algo. Hoy no hay quién. Cuando lo haya
—un consumidor del dataset que quiera saber si cambió, por ejemplo— se agrega
ahí y se dice para quién es. Exponerlo "por las dudas" sería inventar un
contrato sin contraparte.

**Si algún día aparece una segunda fuente**, la regla es que se derive de
`package.json` en build time, nunca que se escriba a mano en dos lados. Dos
números escritos a mano se desincronizan; la única duda es cuándo.

---

## 3. La versión sube al mergear a `staging`

**La regla:** todo PR que apunta a `staging` sube `package.json.version`. Sin
excepción, y lo hace cumplir `version-gate.yml`.

**Por qué ahí y no en `main`.** `staging` es donde algo se vuelve mirable por
alguien que no lo escribió. Ese es el evento que un número de versión tiene que
identificar. El merge a `main` no vuelve a tocarlo: arrastra el número que ya
trae, así que la versión en producción es idéntica a la que se verificó en
preview — que es toda la gracia.

**Por qué a mano y no automático.** Elegir entre patch, minor y major es una
decisión semántica sobre qué cambió para quien consume el sitio, y una máquina
que mira diffs no la puede tomar bien. Un bot que siempre sube el patch produce
números que suben pero no significan nada.

Las alternativas se descartaron por razones concretas, no por gusto:

- **Bot que commitea a `staging`**: necesita un token con escritura sobre una
  rama protegida, y deja a `staging` con un commit que `develop` no tiene →
  conflicto en el próximo merge, todas las veces.
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
**estrictamente mayor** que la de `staging`. Eso es duro y bloquea.

Además clasifica el salto y, si no es un escalón limpio —`0.1.0 → 0.3.0`,
`1.2.3 → 2.0.1`— lo dice **sin bloquear**. Saltar a veces es a propósito, pero
es también la firma exacta de un typo, y callarlo sería peor que avisar de más.

**Correrlo antes de abrir el PR:**

```bash
git fetch origin staging
pnpm run test:version
```

La lógica pura está en `scripts/version.ts` y se testea en `pnpm test`
(`version.test.ts`), sin necesidad de un repo git alrededor. El check
(`version-bump.check.ts`) es sólo la capa que lee git y el archivo.

---

## 4. El flujo, en orden

1. Ramificar de `develop`. Trabajar. PR **a `develop`**.
   `content-validation.yml` corre. No se deploya nada.
2. Cuando lo acumulado valga la pena publicar: PR **`develop` → `staging`**,
   **con el bump de versión en el mismo PR**. `version-gate.yml` lo verifica.
3. Al mergear, Pages deploya la preview y `smoke-deploy.yml` corre `test:pdf`
   contra el `/cv.pdf` publicado. Mirar que pase.
4. PR **`staging` → `main`**. Sin tocar la versión. Al mergear, producción.
   El smoke corre de nuevo, ahora contra producción.

**El único paso que se puede olvidar es el 2**, y es el único que tiene un check
propio.
