/**
 * Microsoft Clarity. Heatmaps, scroll depth y grabaciones de sesión.
 *
 * Lo que se bundlea de acá son ~800 bytes: `@microsoft/clarity` es un wrapper
 * que inyecta `<script async src="https://www.clarity.ms/tag/<id>">` y después
 * delega todo en `window.clarity(...)`. El payload real se sirve desde
 * `clarity.ms`, así que no cuenta contra `TECHO_CRITICO_KB` de
 * `bundle-budget.check.ts` — que mide chunks de `dist/_astro/`.
 *
 * Se eligió el paquete y no el snippet inline por dos razones concretas: viene
 * tipado, y `init()` chequea `getElementById("clarity-script")` antes de
 * inyectar, así que llamarlo dos veces no duplica el tag.
 *
 * SOLO se llama desde `src/pages/index.astro`. Nunca desde `Base.astro`: `/cv`
 * tiene que quedar en cero JavaScript porque de ahí imprime Browser Rendering
 * el PDF, y un script de terceros cambiaría el render sin que nadie lo note.
 * `no-client-js.check.ts` lo verifica sobre todo `dist/`.
 *
 * Este archivo NO importa de `@content`, igual que todo lo de `src/scripts/`:
 * `json-source.ts` arrastra zod y el dataset entero al browser.
 *
 * SIN Subresource Integrity, y no por olvido: el tag de `clarity.ms` es un
 * artefacto que Microsoft actualiza del lado del servidor, así que un hash fijo
 * lo rompería en la primera versión nueva. Lo que sí acota el riesgo es dónde
 * corre: solo en la landing, nunca en `/cv`, y la landing no tiene formularios
 * ni credenciales que un script comprometido pudiera llevarse.
 */

import Clarity from "@microsoft/clarity";

/**
 * Vite inlinea esto en build. Un `PUBLIC_` sin definir queda como `undefined`,
 * y entonces no se llama a Clarity: en `pnpm run dev` y en cualquier build sin
 * la variable, la analítica sencillamente no existe.
 *
 * El ID no es secreto —viaja en el HTML de cada visita— pero se lee de una
 * variable igual, para no tocar código si cambia de proyecto.
 */
const ID: string | undefined = import.meta.env.PUBLIC_CLARITY_ID;

/**
 * Arranca Clarity si hay un proyecto configurado.
 *
 * No tira nunca: `injectScript` del paquete envuelve todo en un try/catch que
 * devuelve en silencio. Por eso se puede llamar antes que el resto del boot sin
 * riesgo de que un fallo de analítica se lleve puesto el mapa.
 */
export function iniciarAnalitica(): void {
  if (!ID) return;
  Clarity.init(ID);
}
