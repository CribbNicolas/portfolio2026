/**
 * Lo ÚNICO de /lab que viaja en el camino crítico.
 *
 * Sin dependencias y sin importar three ni los módulos de render de forma
 * estática: los dos `import()` son dinámicos, así que Rollup los emite como
 * chunks aparte. Si algún día alguien agrega un import estático a `grafo-3d`,
 * three entra al bundle inicial sin que nadie se entere — por eso hay un check
 * de CI que busca `WebGLRenderer` en los chunks críticos.
 */

import { puedeIntentar } from "./capacidad";
import { seguirScroll } from "./pildora";
import { crearBusHover } from "./hover-bus";
import type { LabDatos, Escena } from "./types";

export function iniciar(): void {
  // Antes del early return del grafo: la píldora existe aunque el mapa no
  // llegue a montarse, y no depende de sus datos.
  const pildora = document.querySelector<HTMLElement>("[data-pildora]");
  if (pildora) seguirScroll(pildora);

  const datosEl = document.querySelector<HTMLScriptElement>("[data-lab-datos]");
  const canvasGrafo = document.querySelector<HTMLCanvasElement>("[data-lab-grafo]");
  const canvasCampo = document.querySelector<HTMLCanvasElement>("[data-lab-campo]");
  const lista = document.querySelector<HTMLElement>(".lab__lista");
  const tooltip = document.querySelector<HTMLElement>("[data-lab-tooltip]");
  if (!datosEl || !canvasGrafo) return;

  let datos: LabDatos;
  try {
    datos = JSON.parse(datosEl.textContent ?? "");
  } catch {
    return; // Queda el SVG, que ya está pintado.
  }

  const bus = crearBusHover();
  cablearLista(lista, bus);

  const panel = document.querySelector<HTMLElement>("[data-lab-panel]");

  if (!puedeIntentar()) return;

  // `rootMargin` generoso: el chunk empieza a bajar un poco antes de que la
  // sección entre en pantalla, así no se ve el salto de aparición.
  observarUnaVez(canvasGrafo, "300px", () => {
    ocioso(async () => {
      try {
        const { montarGrafo } = await import("./grafo-3d");
        // `Array.from` y no spread: el `lib` del tsconfig no trae `dom.iterable`.
        const etiquetas = Array.from(document.querySelectorAll<HTMLElement>("[data-lab-etiqueta]"));
        const escena = await montarGrafo({ canvas: canvasGrafo, datos, bus, tooltip, panel, etiquetas });
        registrar(escena);
        // Recién con el 3D montado la lista puede enfocar. Antes de eso el
        // click en un ítem no tiene a dónde ir, y un botón que no hace nada es
        // peor que un texto que no invita a clickearlo.
        if (escena?.enfocar) cablearFoco(lista, escena.enfocar);
      } catch {
        /* Sin mensaje y sin spinner: el SVG ya es la respuesta correcta. */
      }
    });
  });

  if (canvasCampo) {
    observarUnaVez(canvasCampo, "0px", () => {
      ocioso(async () => {
        try {
          const { montarCampo } = await import("./campo");
          registrar(await montarCampo(canvasCampo));
        } catch {
          /* El fondo plano de `--fondo` ya está debajo. */
        }
      });
    });
  }
}

// ---------------------------------------------------------------------------

const escenas: Escena[] = [];

function registrar(e: Escena | null): void {
  if (!e) return;
  escenas.push(e);
  // Una sola vez, no por escena: si la pestaña se descarta, se libera todo.
  if (escenas.length === 1) {
    addEventListener("pagehide", () => {
      for (const s of escenas) s.destruir();
      escenas.length = 0;
    }, { once: true });
  }
}

/**
 * El lado DOM del puente. Delegación: 4 listeners sin importar cuántos nodos
 * haya. `focusin`/`focusout` es lo que lo hace funcionar con teclado.
 */
function cablearLista(lista: HTMLElement | null, bus: ReturnType<typeof crearBusHover>): void {
  if (!lista) return;
  const idDe = (t: EventTarget | null): string | null =>
    (t as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node ?? null;

  lista.addEventListener("pointerover", (e) => bus.activar(idDe(e.target), "dom"), { passive: true });
  lista.addEventListener("pointerout", () => bus.activar(null, "dom"), { passive: true });
  lista.addEventListener("focusin", (e) => bus.activar(idDe(e.target), "dom"));
  lista.addEventListener("focusout", () => bus.activar(null, "dom"));
}

/**
 * Click y teclado en la lista enfocan el nodo en el mapa.
 *
 * Delegación otra vez: 2 listeners. Los ítems ya son `tabindex=0` para el hover
 * con teclado, así que Enter y Espacio tienen que hacer lo mismo que el click —
 * si no, el mapa queda accesible solo con mouse.
 */
function cablearFoco(lista: HTMLElement | null, enfocar: (id: string | null) => void): void {
  if (!lista) return;
  lista.classList.add("lab__lista--interactiva");

  const idDe = (t: EventTarget | null): string | null =>
    (t as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node ?? null;

  lista.addEventListener("click", (e) => {
    const id = idDe(e.target);
    if (id) enfocar(id);
  });

  lista.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = idDe(e.target);
    if (!id) return;
    e.preventDefault(); // Espacio scrollea la página; acá ya eligieron el ítem.
    enfocar(id);
  });
}

function observarUnaVez(el: Element, rootMargin: string, fn: () => void): void {
  const io = new IntersectionObserver((entradas) => {
    if (!entradas.some((x) => x.isIntersecting)) return;
    io.disconnect();
    fn();
  }, { rootMargin });
  io.observe(el);
}

/** `requestIdleCallback` no existe en Safari. El fallback no es opcional. */
function ocioso(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1200 });
  else setTimeout(fn, 1);
}
