/**
 * Interacción del mapa: arrastre para rotar, foco de vecindario, tooltip.
 *
 * La restricción que ordena todo este archivo: **el canvas nunca recibe eventos
 * de puntero**. Sigue en `pointer-events: none`; quien escucha es el contenedor.
 * Eso permite clickear nodos sin que el mapa se quede con los clicks que no le
 * corresponden, y hace imposible por construcción capturar el scroll.
 *
 * El scroll queda en manos del browser: no hay un solo `preventDefault` acá, y
 * en táctil lo arbitra `touch-action: pan-y` (deslizar vertical scrollea la
 * página, horizontal rota el mapa). Eso es el browser decidiendo, no nosotros
 * interceptando — que es la diferencia entre esto y el scroll hijacking que
 * prohíbe el spec §3.4.
 */

import type { LabDatos, LabNodo } from "./types";

/** Umbral en px para separar un click de un arrastre. */
const UMBRAL_ARRASTRE = 5;
/** Cuánto conserva la inercia por frame. 0.94 ≈ dos segundos de giro. */
const INERCIA = 0.94;
/** Por debajo de esto la inercia se considera terminada y el loop puede dormir. */
const INERCIA_MINIMA = 0.00002;
/** Radio de captura del puntero, en px de pantalla. */
const RADIO_CLICK = 26;

export interface Camara {
  /** Rotación acumulada. La escribe el arrastre, la lee el loop de render. */
  yaw: number;
  pitch: number;
}

export interface EstadoInteraccion {
  camara: Camara;
  /** Nodo bajo el puntero, o null. */
  hover: string | null;
  /** Nodo enfocado por click, o null. */
  foco: string | null;
  /** El foco y sus vecinos directos. Vacío si no hay foco. */
  vecindario: Set<string>;
  /** true mientras el usuario arrastra: el hover se suspende. */
  arrastrando: boolean;
}

interface Opciones {
  contenedor: HTMLElement;
  datos: LabDatos;
  panel: HTMLElement | null;
  tooltip: HTMLElement | null;
  /** Proyecta un nodo a coordenadas de pantalla. La provee el renderer. */
  proyectar: (n: LabNodo) => { x: number; y: number } | null;
  /** Pide un frame. */
  despertar: () => void;
}

export interface Interaccion {
  estado: EstadoInteraccion;
  /** Aplica la inercia. Devuelve true si todavía se está moviendo. */
  avanzar(): boolean;
  /** Recalcula el nodo bajo el puntero. La llama el loop tras mover la cámara. */
  actualizarHover(): void;
  /** Enfoca un nodo desde afuera (la lista del DOM, con teclado). */
  enfocar(id: string | null): void;
  destruir(): void;
}

export function crearInteraccion({
  contenedor, datos, panel, tooltip, proyectar, despertar,
}: Opciones): Interaccion {
  const porId = new Map(datos.nodes.map((n) => [n.i, n]));

  // Adyacencia: se deriva de las aristas que ya viajaron. Mandarla por separado
  // sería duplicar datos en el HTML.
  const vecinos = new Map<string, Set<string>>();
  for (const n of datos.nodes) vecinos.set(n.i, new Set());
  for (const e of datos.edges) {
    vecinos.get(e.s)?.add(e.t);
    vecinos.get(e.t)?.add(e.s);
  }

  const estado: EstadoInteraccion = {
    camara: { yaw: 0.62, pitch: -0.42 },
    hover: null,
    foco: null,
    vecindario: new Set(),
    arrastrando: false,
  };

  let punteroX = -1e9;
  let punteroY = -1e9;
  let velYaw = 0;
  let velPitch = 0;

  let idPuntero: number | null = null;
  let arranqueX = 0;
  let arranqueY = 0;
  let previoX = 0;
  let previoY = 0;
  let desplazado = 0;

  // --- Arrastre -----------------------------------------------------------

  const alBajar = (e: PointerEvent) => {
    // Solo botón principal: el secundario abre el menú contextual y no es nuestro.
    if (e.button !== 0) return;
    idPuntero = e.pointerId;
    arranqueX = previoX = e.clientX;
    arranqueY = previoY = e.clientY;
    desplazado = 0;
    velYaw = velPitch = 0;
    estado.arrastrando = false;
  };

  const alMover = (e: PointerEvent) => {
    const r = contenedor.getBoundingClientRect();
    punteroX = e.clientX - r.left;
    punteroY = e.clientY - r.top;

    if (idPuntero === e.pointerId) {
      const dx = e.clientX - previoX;
      const dy = e.clientY - previoY;
      previoX = e.clientX;
      previoY = e.clientY;
      desplazado += Math.abs(dx) + Math.abs(dy);

      // Recién acá se considera arrastre. Antes del umbral sigue siendo un click
      // en potencia, así que un temblor de mano no cancela el click.
      if (!estado.arrastrando && desplazado > UMBRAL_ARRASTRE) {
        estado.arrastrando = true;
        contenedor.classList.add("lab__mapa--arrastrando");
        // Capturar el puntero hace que el arrastre siga funcionando aunque el
        // cursor salga del mapa. Se libera al soltar.
        try { contenedor.setPointerCapture(e.pointerId); } catch { /* no crítico */ }
      }

      if (estado.arrastrando) {
        velYaw = -dx * 0.006;
        velPitch = -dy * 0.006;
        estado.camara.yaw += velYaw;
        estado.camara.pitch += velPitch;
        limitarPitch();
      }
    }

    despertar();
  };

  const alSubir = (e: PointerEvent) => {
    if (idPuntero !== e.pointerId) return;
    idPuntero = null;
    try { contenedor.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }

    if (estado.arrastrando) {
      estado.arrastrando = false;
      contenedor.classList.remove("lab__mapa--arrastrando");
      despertar();
      return;
    }

    // No hubo arrastre: es un click. Solo actúa si cayó sobre un nodo; si no,
    // limpia el foco — que es lo que uno espera al clickear el vacío.
    const total = Math.abs(e.clientX - arranqueX) + Math.abs(e.clientY - arranqueY);
    if (total <= UMBRAL_ARRASTRE) enfocar(nodoBajoPuntero());
    despertar();
  };

  const alCancelar = () => {
    idPuntero = null;
    estado.arrastrando = false;
    contenedor.classList.remove("lab__mapa--arrastrando");
  };

  const alSalir = () => {
    punteroX = punteroY = -1e9;
    estado.hover = null;
    ocultarTooltip();
    contenedor.classList.remove("lab__mapa--sobre-nodo");
    despertar();
  };

  function limitarPitch(): void {
    // Sin tope, al pasar por el polo la escena se da vuelta y se pierde el norte.
    const tope = Math.PI / 2 - 0.12;
    estado.camara.pitch = Math.max(-tope, Math.min(tope, estado.camara.pitch));
  }

  contenedor.addEventListener("pointerdown", alBajar);
  contenedor.addEventListener("pointermove", alMover, { passive: true });
  contenedor.addEventListener("pointerup", alSubir);
  contenedor.addEventListener("pointercancel", alCancelar);
  contenedor.addEventListener("pointerleave", alSalir);

  // --- Teclado ------------------------------------------------------------
  // El mapa es `tabindex=0`: se puede tabular hasta él y rotarlo con flechas.
  // Sin esto la interacción entera queda fuera del alcance de quien no usa mouse.
  const alTecla = (e: KeyboardEvent) => {
    const paso = 0.12;
    switch (e.key) {
      case "ArrowLeft": estado.camara.yaw -= paso; break;
      case "ArrowRight": estado.camara.yaw += paso; break;
      case "ArrowUp": estado.camara.pitch -= paso; break;
      case "ArrowDown": estado.camara.pitch += paso; break;
      case "Escape": enfocar(null); break;
      default: return;
    }
    // Solo acá: las flechas sobre un elemento enfocado scrollean la página, y
    // el usuario ya declaró su intención tabulando hasta el mapa.
    e.preventDefault();
    limitarPitch();
    despertar();
  };
  contenedor.addEventListener("keydown", alTecla);

  // --- Hit-test y hover ---------------------------------------------------

  function nodoBajoPuntero(): string | null {
    if (punteroX < -1e8) return null;
    let mejor: string | null = null;
    let mejorD = RADIO_CLICK;
    for (const n of datos.nodes) {
      const p = proyectar(n);
      if (!p) continue;
      const d = Math.hypot(p.x - punteroX, p.y - punteroY);
      if (d < mejorD) { mejorD = d; mejor = n.i; }
    }
    return mejor;
  }

  function actualizarHover(): void {
    // Durante el arrastre el hover distrae y además cambia con cada píxel.
    const id = estado.arrastrando ? null : nodoBajoPuntero();
    if (id === estado.hover) {
      if (id) moverTooltip();
      return;
    }
    estado.hover = id;
    // `cursor: pointer` es la única señal de que el nodo es clickeable.
    contenedor.classList.toggle("lab__mapa--sobre-nodo", id !== null);
    if (id) mostrarTooltip(id);
    else ocultarTooltip();
  }

  // --- Tooltip ------------------------------------------------------------

  function mostrarTooltip(id: string): void {
    if (!tooltip) return;
    const n = porId.get(id);
    if (!n) return;

    // Roles y proyectos ya llevan su etiqueta dibujada al lado del nodo: un
    // tooltip con el mismo texto es ruido. El tooltip existe para los nodos que
    // NO tienen etiqueta — skills y logros, que son la mayoría.
    const yaEtiquetado = (n.k === "role" || n.k === "project") && etiquetaVisible(id);
    if (yaEtiquetado) { ocultarTooltip(); return; }

    tooltip.textContent = n.k === "achievement" ? n.t : n.n;
    tooltip.classList.add("lab__tooltip--visible");
    moverTooltip();
  }

  /** El renderer apaga las etiquetas que se pisan; acá se respeta esa decisión. */
  function etiquetaVisible(id: string): boolean {
    const el = document.querySelector<HTMLElement>(`[data-lab-etiqueta][data-node="${CSS.escape(id)}"]`);
    return el !== null && parseFloat(el.style.opacity || "0") > 0.05;
  }

  function moverTooltip(): void {
    if (!tooltip) return;
    // Se voltea contra el borde derecho para no salirse del mapa.
    const ancho = tooltip.offsetWidth;
    const x = punteroX + ancho + 28 > contenedor.clientWidth ? punteroX - ancho - 14 : punteroX + 14;
    tooltip.style.transform = `translate3d(${x.toFixed(0)}px, ${(punteroY + 14).toFixed(0)}px, 0)`;
  }

  function ocultarTooltip(): void {
    tooltip?.classList.remove("lab__tooltip--visible");
  }

  // --- Foco ---------------------------------------------------------------

  function enfocar(id: string | null): void {
    // Volver a clickear el mismo nodo sale del foco.
    const nuevo = id && id === estado.foco ? null : id;
    estado.foco = nuevo;
    estado.vecindario = new Set();

    if (nuevo) {
      estado.vecindario.add(nuevo);
      for (const v of vecinos.get(nuevo) ?? []) estado.vecindario.add(v);
    }

    contenedor.classList.toggle("lab__mapa--enfocado", nuevo !== null);
    pintarPanel(nuevo);
    marcarLista(nuevo);
    despertar();
  }

  /** El panel es DOM: texto real, seleccionable y leído por lectores de pantalla. */
  function pintarPanel(id: string | null): void {
    if (!panel) return;
    if (!id) {
      panel.classList.remove("lab__panel--visible");
      panel.replaceChildren();
      return;
    }
    const n = porId.get(id);
    if (!n) return;

    const conectados = [...(vecinos.get(id) ?? [])]
      .map((v) => porId.get(v))
      .filter((v): v is LabNodo => v !== undefined)
      .sort((a, b) => b.d - a.d);

    const h = document.createElement("h4");
    h.className = "lab__panel-titulo";
    h.textContent = n.n;

    const meta = document.createElement("p");
    meta.className = "lab__panel-meta";
    meta.textContent = [ETIQUETA_TIPO[n.k], n.c, `${n.d} ${n.d === 1 ? "conexión" : "conexiones"}`]
      .filter(Boolean).join(" · ");

    const hijos: HTMLElement[] = [h, meta];

    // El detalle de una skill es su propio nombre: repetirlo no dice nada.
    if (n.t !== n.n) {
      const cuerpo = document.createElement("p");
      cuerpo.className = "lab__panel-texto";
      cuerpo.textContent = n.t;
      hijos.push(cuerpo);
    }

    // Los logros NO son chips: son oraciones. Meterlos en la misma lista que
    // "React" daba fichas de tres renglones y un panel de media pantalla.
    const logros = conectados.filter((v) => v.k === "achievement");
    const resto = conectados.filter((v) => v.k !== "achievement");

    if (logros.length) hijos.push(grupoLogros(logros));
    if (resto.length) hijos.push(grupoChips(resto));

    panel.replaceChildren(...hijos);
    panel.classList.add("lab__panel--visible");
  }

  /** El foco desde el mapa también marca la lista, y al revés. */
  function marcarLista(id: string | null): void {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-node]"))) {
      el.classList.toggle("lab__item--enfocado", el.dataset.node === id);
    }
  }

  return {
    estado,
    avanzar() {
      if (estado.arrastrando || (Math.abs(velYaw) < INERCIA_MINIMA && Math.abs(velPitch) < INERCIA_MINIMA)) {
        velYaw = velPitch = 0;
        return false;
      }
      velYaw *= INERCIA;
      velPitch *= INERCIA;
      estado.camara.yaw += velYaw;
      estado.camara.pitch += velPitch;
      limitarPitch();
      return true;
    },
    actualizarHover,
    enfocar,
    destruir() {
      contenedor.removeEventListener("pointerdown", alBajar);
      contenedor.removeEventListener("pointermove", alMover);
      contenedor.removeEventListener("pointerup", alSubir);
      contenedor.removeEventListener("pointercancel", alCancelar);
      contenedor.removeEventListener("pointerleave", alSalir);
      contenedor.removeEventListener("keydown", alTecla);
      contenedor.classList.remove(
        "lab__mapa--arrastrando", "lab__mapa--sobre-nodo", "lab__mapa--enfocado",
      );
      ocultarTooltip();
      pintarPanel(null);
      marcarLista(null);
    },
  };
}

const ETIQUETA_TIPO: Record<string, string> = {
  role: "Rol",
  project: "Proyecto",
  achievement: "Logro",
  skill: "Tecnología",
};

/**
 * Cuántos logros entran antes de que el panel deje de ser un panel.
 *
 * Dos y no tres: con tres, el tercero quedaba cortado a mitad de oración contra
 * el tope de alto. Una oración cortada se lee como un bug; "+2 más" se lee como
 * una decisión.
 */
const MAX_LOGROS = 2;

function grupoLogros(logros: LabNodo[]): HTMLElement {
  const cont = document.createElement("div");
  cont.className = "lab__panel-grupo";

  const titulo = document.createElement("p");
  titulo.className = "lab__panel-subtitulo";
  titulo.textContent = logros.length === 1 ? "Logro" : `Logros (${logros.length})`;
  cont.append(titulo);

  const lista = document.createElement("ul");
  lista.className = "lab__panel-logros";
  for (const l of logros.slice(0, MAX_LOGROS)) {
    const li = document.createElement("li");
    // El texto va entero: `Prose.short` ya está escrito para ser corto, y
    // recortarlo acá rompería la intención (invariante 6).
    li.textContent = l.t;
    lista.append(li);
  }
  cont.append(lista);

  if (logros.length > MAX_LOGROS) {
    const mas = document.createElement("p");
    mas.className = "lab__panel-mas";
    mas.textContent = `+${logros.length - MAX_LOGROS} más`;
    cont.append(mas);
  }
  return cont;
}

function grupoChips(nodos: LabNodo[]): HTMLElement {
  const cont = document.createElement("div");
  cont.className = "lab__panel-grupo";

  const lista = document.createElement("ul");
  lista.className = "lab__panel-lista";
  for (const v of nodos.slice(0, 12)) {
    const li = document.createElement("li");
    li.textContent = v.n;
    li.className = `lab__panel-chip lab__panel-chip--${v.k}`;
    lista.append(li);
  }
  if (nodos.length > 12) {
    const li = document.createElement("li");
    li.className = "lab__panel-chip lab__panel-chip--resto";
    li.textContent = `+${nodos.length - 12}`;
    lista.append(li);
  }
  cont.append(lista);
  return cont;
}
