/**
 * El mapa en WebGL. ÚNICO archivo del proyecto que importa `three`.
 *
 * Toda la escena son 2 draw calls: un `InstancedMesh` con todos los nodos y un
 * `LineSegments` con todas las aristas. El costo es la librería, no el render.
 *
 * Lo que NO se importa, y por qué:
 * - `OrbitControls`: registra `wheel` y llama `preventDefault`. Eso es scroll
 *   hijacking, prohibido por el spec §3.4. Se descarta por comportamiento.
 * - postprocessing / `EffectComposer`: render targets a pantalla completa por
 *   frame. En un celular de gama media es fill-rate puro.
 * - `Raycaster`: el hit-test se hace proyectando a NDC, que ya hay que calcular
 *   para ubicar el tooltip. Traerlo sería pagar dos veces.
 * - cualquier `TextGeometry` / atlas de fuente: el texto vive en el SVG y en el
 *   tooltip del DOM. Nítido, seleccionable y accesible.
 */

import {
  WebGLRenderer, Scene, PerspectiveCamera,
  BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, CircleGeometry, MeshBasicMaterial,
  LineSegments, LineBasicMaterial,
  Color, Matrix4, Vector3,
} from "three";

import { medidorDeFrames } from "./capacidad";
import { crearInteraccion } from "./interaccion";
import type { LabDatos, LabNodo, Escena } from "./types";
import type { BusHover } from "./hover-bus";

/**
 * Radios base. Más grandes que los del SVG a propósito: en el SVG el nodo se
 * apoya en etiquetas y en un contorno nítido, y acá compite con la niebla.
 */
const RADIO: Record<string, number> = { role: 17, project: 14, skill: 10, achievement: 9 };
/** Cuánto orbita la cámara con el cursor. ±8°: se nota y no marea. */
const ORBITA = 0.14;

/** Opacidad de lo que queda FUERA del vecindario enfocado. */
const ATENUADO = 0.12;

interface Opciones {
  canvas: HTMLCanvasElement;
  datos: LabDatos;
  bus: BusHover;
  tooltip: HTMLElement | null;
  panel: HTMLElement | null;
  /** Etiquetas de roles y proyectos, server-rendered. Se posicionan por frame. */
  etiquetas: HTMLElement[];
}

export async function montarGrafo({ canvas, datos, bus, tooltip, panel, etiquetas }: Opciones): Promise<Escena | null> {
  let renderer: WebGLRenderer;
  try {
    // `antialias` solo con puntero fino: en un teléfono es el primer costo que
    // conviene no pagar, y el medidor de frames lo verifica igual.
    const finoYCapaz = matchMedia("(pointer: fine)").matches;
    renderer = new WebGLRenderer({ canvas, antialias: finoYCapaz, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }

  const contenedor = canvas.parentElement ?? canvas;
  const escena = new Scene();
  const camara = new PerspectiveCamera(42, 1, 1, 6000);

  // Los colores salen de los tokens: cero hex en JS, y el modo oscuro sale
  // gratis porque `tokens.css` ya lo resuelve por media query.
  const leerColores = () => {
    const css = getComputedStyle(document.documentElement);
    const c = (n: string) => new Color().setStyle(css.getPropertyValue(n).trim() || "#888");
    return {
      acento: c("--acento"), tinta: c("--tinta"), suave: c("--tinta-suave"),
      linea: c("--linea"), fondo: c("--fondo-elevado"),
    };
  };
  let colores = leerColores();

  /**
   * Cuatro tipos con UN acento (spec §4). El tipo se distingue por tamaño y por
   * valor —qué tan oscuro es— no por matiz: así sobrevive en blanco y negro,
   * que es el criterio 2 del §5. El acento queda reservado para los logros, que
   * son la evidencia.
   *
   * Las skills se aclaran mezclando con el fondo en vez de hardcodear un gris:
   * el color sigue saliendo de los tokens y el modo oscuro sigue funcionando.
   */
  const colorDe = (kind: string, grado: number): Color => {
    if (grado === 0) return colores.suave.clone().lerp(colores.fondo, 0.45);
    if (kind === "achievement") return colores.acento;
    if (kind === "role") return colores.tinta;
    if (kind === "project") return colores.suave;
    return colores.suave.clone().lerp(colores.fondo, 0.25);
  };

  // --- Nodos: 1 draw call --------------------------------------------------
  const nodos = datos.nodes;
  // 20 segmentos: con 12 el polígono se nota a estos radios. 20 es donde deja
  // de verse el borde recto y todavía son 740 triángulos en total.
  const geoNodo = new CircleGeometry(1, 20);

  /**
   * Niebla por ALPHA, no por color.
   *
   * `Fog` funde el fragmento hacia un color, y con el panel transparente ese
   * color no existe: un nodo lejano quedaría como un disco pálido sólido en vez
   * de dejar ver el campo de atrás. Lo correcto es que se desvanezca a nada.
   *
   * `MeshBasicMaterial` no tiene opacidad por instancia, así que se inyecta un
   * atributo instanciado en el shader. Son ~10 líneas contra escribir un
   * `ShaderMaterial` entero y perder todo lo que three ya resuelve.
   */
  const alphas = new InstancedBufferAttribute(new Float32Array(nodos.length).fill(1), 1);
  const matNodo = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  matNodo.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float instanceAlpha;\nvarying float vAlpha;\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vAlpha = instanceAlpha;");
    shader.fragmentShader = `varying float vAlpha;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= vAlpha;");
  };

  const malla = new InstancedMesh(geoNodo, matNodo, nodos.length);
  malla.geometry.setAttribute("instanceAlpha", alphas);
  // Las aristas van abajo; los nodos, encima.
  malla.renderOrder = 1;
  const m4 = new Matrix4();

  // Billboarding: los discos tienen que MIRAR a la cámara. Sin esto son planos
  // en el espacio y al orbitar se ven como elipses aplastadas, no como nodos.
  const posInst = new Vector3();
  const escalaInst = new Vector3();
  const orden = nodos.map((_, i) => i);
  const distancias = new Float32Array(nodos.length);

  /**
   * Escribe matriz, color y alpha de las 37 instancias, de atrás hacia adelante.
   *
   * El orden importa por el alpha: con `depthWrite: false` el blending depende
   * del orden de dibujo, y el orden de dibujo de un `InstancedMesh` es el orden
   * del buffer. Si un nodo cercano se dibujara primero, los de atrás se
   * mezclarían encima. Ordenar 37 índices por frame no se nota.
   */
  const escribirInstancias = () => {
    const { hover, foco, vecindario } = interaccion.estado;
    const hayFoco = foco !== null;

    for (let i = 0; i < nodos.length; i++) {
      const n = nodos[i]!;
      distancias[i] = camara.position.distanceTo(posInst.set(n.x, n.y, n.z));
    }
    orden.sort((a, b) => distancias[b]! - distancias[a]!);

    for (let slot = 0; slot < orden.length; slot++) {
      const i = orden[slot]!;
      const n = nodos[i]!;
      const esFoco = foco === n.i;
      const resaltar = esFoco || hover === n.i;
      // Con foco activo, todo lo que no sea el vecindario se apaga. Eso es lo
      // que convierte el grafo en una respuesta: "esto es lo que sostiene a X".
      const apagado = hayFoco && !vecindario.has(n.i);

      // `n.r` viene del build: 1 salvo en las skills, donde codifica años de
      // uso × conexiones. El radio por tipo queda como base, no como respuesta.
      const base = (RADIO[n.k] ?? 5) * n.r;
      const r = base * (esFoco ? 2.1 : resaltar ? 1.6 : 1);
      posInst.set(n.x, n.y, n.z);
      escalaInst.set(r, r, r);
      m4.compose(posInst, camara.quaternion, escalaInst);
      malla.setMatrixAt(slot, m4);

      malla.setColorAt(slot, resaltar ? colores.acento : colorDe(n.k, n.d));
      // Lo lejano se va a transparente y deja ver el campo. Lo señalado nunca se
      // desvanece: si lo estás mirando, tiene que verse.
      alphas.array[slot] = resaltar ? 1 : desvanecer(distancias[i]!) * (apagado ? ATENUADO : 1);
    }

    malla.instanceMatrix.needsUpdate = true;
    alphas.needsUpdate = true;
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
  };

  escena.add(malla);

  // --- Aristas: 1 draw call ------------------------------------------------
  const indice = new Map(nodos.map((n, i) => [n.i, i]));
  const posiciones: number[] = [];
  const extremos: Array<[number, number, boolean]> = [];
  for (const e of datos.edges) {
    const a = indice.get(e.s);
    const b = indice.get(e.t);
    if (a === undefined || b === undefined) continue;
    const A = nodos[a]!;
    const B = nodos[b]!;
    posiciones.push(A.x, A.y, A.z, B.x, B.y, B.z);
    extremos.push([a, b, e.a]);
  }

  const geoAristas = new BufferGeometry();
  geoAristas.setAttribute("position", new Float32BufferAttribute(posiciones, 3));
  // itemSize 4, no 3: con RGBA three activa USE_COLOR_ALPHA y cada vértice
  // lleva su propia transparencia. Es lo que permite que una arista se
  // desvanezca con la profundidad en vez de cortarse de golpe.
  const coloresArista = new Float32BufferAttribute(new Float32Array(extremos.length * 8), 4);
  geoAristas.setAttribute("color", coloresArista);

  const lineas = new LineSegments(
    geoAristas,
    new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
  );
  lineas.renderOrder = 0;
  escena.add(lineas);

  /** Color y alpha por extremo. El alpha sale de la misma niebla que los nodos. */
  const escribirAristas = () => {
    const { foco, vecindario } = interaccion.estado;
    const hayFoco = foco !== null;
    const arr = coloresArista.array as Float32Array;

    for (let e = 0; e < extremos.length; e++) {
      const [a, b, afinidad] = extremos[e]!;
      // Una arista pertenece al foco solo si TOCA el nodo enfocado. Con "los dos
      // extremos en el vecindario" alcanzaría para colar aristas entre vecinos
      // que no pasan por el foco, y el dibujo dejaría de responder la pregunta.
      const delFoco = hayFoco && (nodos[a]!.i === foco || nodos[b]!.i === foco);
      const apagada = hayFoco && !delFoco;

      const c = delFoco ? colores.acento : afinidad ? colores.acento : colores.linea;
      // Las de afinidad son las derivadas: más presentes, pero nunca por encima
      // de la estructura declarada en el dataset.
      const base = delFoco ? 0.95 : afinidad ? 0.6 : 0.4;

      for (const [k, nodoIdx] of [[0, a], [1, b]] as const) {
        const o = e * 8 + k * 4;
        arr[o] = c.r; arr[o + 1] = c.g; arr[o + 2] = c.b;
        arr[o + 3] = desvanecer(distancias[nodoIdx]!) * base * (apagada ? ATENUADO : 1);
      }
    }
    coloresArista.needsUpdate = true;
  };

  // --- Cámara y encuadre ---------------------------------------------------
  // Encuadre sobre el anillo, que es el borde real del dibujo. `layoutGraph`
  // normaliza el cuerpo a un radio fijo, así que este número no se mueve cuando
  // crece el dataset.
  const dist = datos.radio / Math.tan((42 * Math.PI) / 360) * 0.92;
  let ancho = 1, alto = 1;

  /**
   * Niebla de profundidad, en alpha.
   *
   * Es LO que separa un grafo con volumen de una nube de puntos: la perspectiva
   * sola no alcanza para leer qué está atrás. Va sobre alpha y no sobre color
   * porque el panel es transparente — fundir hacia un color dejaría discos
   * pálidos sólidos tapando el campo.
   */
  const CERCA = dist - datos.radio * 1.05;
  const LEJOS = dist + datos.radio * 1.35;

  function desvanecer(distancia: number): number {
    const t = (distancia - CERCA) / (LEJOS - CERCA);
    return Math.max(0.14, Math.min(1, 1 - t));
  }

  const redimensionar = () => {
    const r = contenedor.getBoundingClientRect();
    ancho = Math.max(1, r.width);
    alto = Math.max(1, r.height);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(ancho, alto, false);
  };
  redimensionar();
  // `ResizeObserver` y no `window.resize`: el contenedor puede cambiar de
  // tamaño sin que la ventana lo haga.
  const ro = new ResizeObserver(redimensionar);
  ro.observe(contenedor);

  // --- Interacción ---------------------------------------------------------
  // El canvas sigue en `pointer-events: none`: quien escucha es el CONTENEDOR.
  // Por eso el mapa puede recibir clicks sin quedarse con los que no le tocan, y
  // por eso no puede capturar el scroll ni queriendo.
  const vProy = new Vector3();
  const interaccion = crearInteraccion({
    contenedor,
    datos,
    panel,
    tooltip,
    proyectar: (n: LabNodo) => {
      vProy.set(n.x, n.y, n.z).project(camara);
      if (vProy.z > 1) return null; // detrás de la cámara
      return { x: (vProy.x * 0.5 + 0.5) * ancho, y: (-vProy.y * 0.5 + 0.5) * alto };
    },
    despertar: () => despertar(),
  });

  // Giro autónomo lento mientras nadie toca nada. Es lo que insinúa que el mapa
  // es tridimensional antes de que el usuario descubra que puede arrastrarlo.
  const DERIVA = 0.0009;
  let interactuado = false;

  const alScroll = () => despertar();
  addEventListener("scroll", alScroll, { passive: true });

  // --- Etiquetas en DOM ----------------------------------------------------
  // No van en WebGL: un atlas de fuente o `TextGeometry` costaría más que toda
  // la escena, y el texto saldría borroso y no seleccionable. Estas son 7
  // elementos que ya vienen en el HTML; acá solo se los mueve.
  const anclas = etiquetas
    .map((el) => {
      const id = el.dataset.node;
      const nodo = nodos.find((n) => n.i === id);
      return nodo ? { el, nodo } : null;
    })
    .filter((x): x is { el: HTMLElement; nodo: (typeof nodos)[number] } => x !== null);

  // Anchos medidos: `offsetWidth` es exacto y cuesta un solo reflow, contra
  // estimar por cantidad de caracteres como hace el SVG.
  const anchoDe = new Map<HTMLElement, number>();
  const medirAnchos = () => {
    for (const { el } of anclas) anchoDe.set(el, el.offsetWidth);
  };
  medirAnchos();
  // Si Manrope todavía no cargó, la primera medición es la de la fuente de
  // respaldo y las cajas quedan mal. Se remide cuando la tipografía está lista.
  document.fonts?.ready.then(() => { medirAnchos(); despertar(); });

  const vEtiqueta = new Vector3();
  const ubicarEtiquetas = () => {
    // Se resuelve la superposición igual que en el SVG: de adelante hacia atrás,
    // el más cercano se queda con la etiqueta. Sin esto "Plugins de WordPress
    // con tooling moderno" tapa "Dinkum Interactive". Como el loop se duerme al
    // converger, en reposo no parpadea.
    const candidatos = anclas
      .map(({ el, nodo }) => {
        vEtiqueta.set(nodo.x, nodo.y, nodo.z);
        const distancia = camara.position.distanceTo(vEtiqueta);
        vEtiqueta.project(camara);
        return {
          el, nodo, distancia,
          detras: vEtiqueta.z > 1,
          sx: (vEtiqueta.x * 0.5 + 0.5) * ancho,
          sy: (-vEtiqueta.y * 0.5 + 0.5) * alto,
        };
      })
      // Los roles ganan la etiqueta ante un empate de espacio, aunque un
      // proyecto esté más cerca: son cuatro y ordenan la lectura del mapa. Que
      // "Dinkum Interactive" desaparezca porque le pasó por delante el nombre
      // largo de un proyecto es perder lo más importante primero.
      .sort((a, b) =>
        (a.nodo.k === "role" ? 0 : 1) - (b.nodo.k === "role" ? 0 : 1) ||
        a.distancia - b.distancia,
      );

    const puestas: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

    for (const c of candidatos) {
      // Detrás de la cámara: `project` da coordenadas espejadas y sin sentido.
      if (c.detras) { c.el.style.opacity = "0"; continue; }

      const y = c.sy - RADIO[c.nodo.k]! - 14;
      const w = anchoDe.get(c.el) ?? 80;
      // La caja es más alta que el texto a propósito: dos etiquetas en renglones
      // casi contiguos no "chocan" por geometría pero se leen como una sola.
      const caja = { x1: c.sx - w / 2 - 10, x2: c.sx + w / 2 + 10, y1: y - 22, y2: y + 16 };

      if (puestas.some((p) => caja.x1 < p.x2 && caja.x2 > p.x1 && caja.y1 < p.y2 && caja.y2 > p.y1)) {
        c.el.style.opacity = "0";
        continue;
      }
      puestas.push(caja);

      // La opacidad sigue la misma niebla que la escena, así el texto no flota
      // nítido sobre un nodo que se está desvaneciendo.
      const t = (c.distancia - (dist - datos.radio * 1.15)) / (datos.radio * 2.65);
      c.el.style.opacity = Math.max(0.2, Math.min(1, 1 - t)).toFixed(2);
      c.el.style.transform = `translate3d(${c.sx.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
    }
  };

  // El hover del canvas se publica al bus para que la lista del DOM lo refleje;
  // el bus deduplica, así que esto no genera un loop con el sentido inverso.
  const soltarBus = bus.alCambiar((id, fuente) => {
    // Hover llegado DESDE la lista: enfocar no, resaltar sí. Enfocar es una
    // decisión y requiere click.
    if (fuente === "dom") despertar();
  });

  // --- Loop que se apaga ---------------------------------------------------
  // Un mapa quieto dibuja 0 frames por segundo. Es la mayor ganancia de batería
  // de todo esto, más que cualquier optimización de shader.
  const medir = medidorDeFrames();
  let vivo = true;
  let visible = true;
  let rafId = 0;
  let quieto = false;

  const frame = (ahora: number) => {
    rafId = 0;
    if (!vivo || !visible) return;

    const veredicto = medir(ahora);
    if (veredicto === false) { apagar(); return; }

    // Inercia del arrastre, y deriva lenta hasta que el usuario toque algo.
    const conInercia = interaccion.avanzar();
    if (!interactuado && !interaccion.estado.arrastrando) {
      if (conInercia || interaccion.estado.foco || interaccion.estado.hover) interactuado = true;
      else interaccion.estado.camara.yaw += DERIVA;
    }

    const rx = interaccion.estado.camara.pitch;
    const ry = interaccion.estado.camara.yaw;
    camara.position.set(
      Math.sin(ry) * Math.cos(rx) * dist,
      Math.sin(rx) * dist,
      Math.cos(ry) * Math.cos(rx) * dist,
    );
    camara.lookAt(0, 0, 0);
    // `lookAt` escribe el quaternion, pero `matrixWorldInverse` —lo ÚNICO que
    // usa `Vector3.project`— recién se recalcula dentro de `renderer.render()`.
    // Sin esta línea, el hit-test y las etiquetas proyectan con la vista del
    // frame anterior mientras el canvas ya dibujó con la nueva. Como los
    // `pointermove` no reparten el mismo delta en cada frame, ese desfase
    // cambia de tamaño frame a frame: las etiquetas tiemblan sobre los nodos.
    camara.updateMatrixWorld();

    // El hover se recalcula DESPUÉS de mover la cámara: si no, el hit-test usa
    // la proyección del frame anterior y el nodo bajo el cursor va un frame
    // atrasado. Se nota al arrastrar.
    interaccion.actualizarHover();
    if (interaccion.estado.hover !== bus.actual()) {
      bus.activar(interaccion.estado.hover, "canvas");
    }

    // Se reescribe todo por frame: el billboard depende de la orientación de la
    // cámara y el orden de dibujo depende de la profundidad. Son 37 `compose` y
    // un sort de 37: irrelevante frente al render.
    escribirInstancias();
    escribirAristas();
    ubicarEtiquetas();
    renderer.render(escena, camara);

    // Se corta el loop cuando no queda nada moviéndose. Mientras se mide
    // (veredicto === null) nunca se duerme, o la medición no termina.
    quieto = veredicto !== null && !conInercia && !interaccion.estado.arrastrando && interactuado;
    if (!quieto) rafId = requestAnimationFrame(frame);
  };

  const despertar = () => {
    if (!vivo || !visible || rafId) return;
    quieto = false;
    rafId = requestAnimationFrame(frame);
  };

  const alCambiarVisibilidad = () => {
    visible = !document.hidden;
    if (visible) despertar();
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  const ioVisible = new IntersectionObserver((xs) => {
    visible = xs.some((x) => x.isIntersecting) && !document.hidden;
    if (visible) despertar();
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  });
  ioVisible.observe(contenedor);

  const mqTema = matchMedia("(prefers-color-scheme: dark)");
  const alCambiarTema = () => {
    colores = leerColores();
    despertar(); // el frame reescribe colores y alphas con la paleta nueva
  };
  mqTema.addEventListener("change", alCambiarTema);

  const alPerderContexto = (e: Event) => { e.preventDefault(); apagar(); };
  canvas.addEventListener("webglcontextlost", alPerderContexto);

  function apagar(): void {
    if (!vivo) return;
    vivo = false;
    if (rafId) cancelAnimationFrame(rafId);
    // El SVG nunca se sacó del DOM: revertir es quitar una clase.
    contenedor.classList.remove("lab__mapa--3d");
    interaccion.destruir();
    removeEventListener("scroll", alScroll);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    canvas.removeEventListener("webglcontextlost", alPerderContexto);
    mqTema.removeEventListener("change", alCambiarTema);
    ioVisible.disconnect();
    ro.disconnect();
    soltarBus();
    geoNodo.dispose();
    matNodo.dispose();
    geoAristas.dispose();
    lineas.material.dispose();
    malla.dispose();
    renderer.dispose();
  }

  // Recién acá se oculta el SVG: la cámara arranca en la misma pose que usó la
  // proyección del servidor, así que no hay salto visual.
  contenedor.classList.add("lab__mapa--3d");
  despertar();

  return { destruir: apagar, enfocar: interaccion.enfocar };
}
