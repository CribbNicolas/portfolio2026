/**
 * KnowledgeGraph → posiciones en 3D.
 *
 * Corre en el FRONTMATTER de la página, o sea en Node durante `astro build`.
 * Nunca se envía al browser. Eso es deliberado y es lo que permite que el
 * fallback sin JavaScript sea el MISMO mapa y no una aproximación: el `<svg>`
 * server-rendered y la escena de three.js leen las mismas coordenadas.
 *
 * Determinista por construcción: las posiciones iniciales salen de una esfera
 * de Fibonacci indexada por posición del nodo, no de un PRNG. No hay semilla
 * que sincronizar. Depende de que `buildKnowledgeGraph` emita los nodos en
 * orden estable — y eso lo afirma un test.
 */

import type { KnowledgeGraph, GraphEdge, GraphNode, GraphNodeKind } from "./knowledge-graph";

// ---------------------------------------------------------------------------
// PARÁMETROS
// ---------------------------------------------------------------------------

/** Iteraciones de la simulación. A 37 nodos son ~15 ms en build. */
export const LAYOUT_TICKS = 700;
/** Distancia de equilibrio entre nodos. Sube = grafo más disperso. */
export const LAYOUT_K = 62;
/** Radio de la esfera inicial. */
export const LAYOUT_RADIO_INICIAL = 170;
/**
 * Radio objetivo por tipo, como fracción del radio del cuerpo.
 *
 * Es lo que convierte la nube en una estructura legible: **núcleo = lo que sé,
 * corteza = dónde lo usé**. Los logros y proyectos quedan en el medio porque
 * son literalmente el puente entre una tecnología y un trabajo.
 */
export const LAYOUT_RADIO_TIPO: Record<GraphNodeKind, number> = {
  role: 1,
  project: 0.7,
  achievement: 0.55,
  skill: 0.28,
};
/**
 * Cuánto tira el sesgo radial. Es un SESGO, no una restricción: la atracción por
 * arista sigue mandando, así que un logro no se despega de su rol ni de sus
 * skills. Subirlo mucho aplana el grafo en capas y se pierde la estructura real.
 */
export const LAYOUT_SESGO_RADIAL = 2;
/**
 * Cuánto pesa el tamaño del nodo en la repulsión.
 *
 * Con 0 la repulsión es uniforme, que es como estaba cuando todos los nodos
 * medían casi lo mismo. Ahora van de 6 a 34: sin esto, React empuja igual que
 * Jotai y termina con una skill huérfana metida adentro del disco. La repulsión
 * de un par escala con el promedio de sus dos radios, así que un nodo grande se
 * hace lugar y uno chico casi no molesta.
 */
export const LAYOUT_REPULSION_POR_TAMANO = 1;
/**
 * Radio del núcleo de skills sin evidencia, como fracción del radio del cuerpo.
 */
export const LAYOUT_RADIO_NUCLEO = 0.14;
/** Iteraciones de la relajación del núcleo. Solo mueve 11 nodos: es gratis. */
export const LAYOUT_TICKS_NUCLEO = 120;
/**
 * Radio al que se normaliza el cuerpo del grafo. Fija el encuadre: sin esto, el
 * tamaño en pantalla depende de cuántos nodos haya y de qué tan lejos vuele el
 * más suelto, así que agregar un logro cambiaría el zoom de toda la página.
 */
export const LAYOUT_RADIO_OBJETIVO = 300;
/**
 * Percentil del que se toma el radio del cuerpo. 0.85 y no el máximo a
 * propósito: con el máximo, UN nodo poco conectado que se va lejos dicta la
 * escala y aplasta al resto contra el centro. Es exactamente lo que pasaba con
 * el rol "Independiente".
 */
export const LAYOUT_PERCENTIL_RADIO = 0.85;
/** Fuerza que tira todo hacia el origen. Evita que el grafo derive. */
export const LAYOUT_CENTRADO = 0.012;
/**
 * Cuánto tira una arista de afinidad respecto de una estructural, por unidad de
 * peso. Menor a 1 porque son muchas más: con 1 aplastarían la estructura.
 */
export const LAYOUT_TIRON_AFINIDAD = 0.55;

export interface Vec3 { x: number; y: number; z: number }

export interface PositionedNode extends GraphNode, Vec3 {
  /**
   * true si el nodo no tiene una sola arista: ninguna skill lo respalda y él no
   * respalda a nadie. El `<svg>` los dibuja distinto, y son el mapa mostrando
   * dónde falta contenido, no un bug del layout.
   */
  sinEvidencia: boolean;
}

export interface PositionedGraph {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  /**
   * Distancia del nodo más lejano al origen. La cámara la usa para el encuadre
   * inicial y para los planos de la niebla, así que TIENE que contener todo:
   * un nodo por fuera entra recortado o directamente no se ve.
   */
  radioEncuadre: number;
}

// ---------------------------------------------------------------------------
// LAYOUT
// ---------------------------------------------------------------------------

export function layoutGraph(graph: KnowledgeGraph): PositionedGraph {
  const conEvidencia = graph.nodes.filter((n) => n.degree > 0);

  const pos = new Map<string, Vec3>();

  // Esfera de Fibonacci: reparte N puntos casi uniformemente sin aleatoriedad.
  const total = conEvidencia.length;
  conEvidencia.forEach((n, i) => {
    const t = (i + 0.5) / total;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    pos.set(n.id, {
      x: Math.cos(theta) * Math.sin(phi) * LAYOUT_RADIO_INICIAL,
      y: Math.sin(theta) * Math.sin(phi) * LAYOUT_RADIO_INICIAL,
      z: Math.cos(phi) * LAYOUT_RADIO_INICIAL,
    });
  });

  // Solo las aristas entre nodos que están en la simulación.
  const activas = graph.edges.filter((e) => pos.has(e.source) && pos.has(e.target));

  for (let it = 0; it < LAYOUT_TICKS; it++) {
    // Temple: el paso máximo baja con las iteraciones para que converja en vez
    // de oscilar. Sin esto el grafo late para siempre.
    const paso = 26 * (1 - it / LAYOUT_TICKS);
    const disp = new Map<string, Vec3>(conEvidencia.map((n) => [n.id, { x: 0, y: 0, z: 0 }]));

    // Repulsión entre todos los pares. O(N²), y a N=37 eso son 666 pares:
    // Barnes-Hut no compra nada a esta escala y cuesta 200 líneas.
    for (let i = 0; i < conEvidencia.length; i++) {
      for (let k = i + 1; k < conEvidencia.length; k++) {
        const a = conEvidencia[i]!.id;
        const b = conEvidencia[k]!.id;
        const A = pos.get(a)!;
        const B = pos.get(b)!;
        let dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
        const d = Math.hypot(dx, dy, dz) || 0.01;
        // El tamaño entra acá: un nodo grande necesita más lugar libre, no más
        // fuerza de arista. `escalaRadio` es 1 fuera de las skills, así que para
        // roles, proyectos y logros esto es exactamente la repulsión de siempre.
        const tamano = 1 + LAYOUT_REPULSION_POR_TAMANO
          * ((conEvidencia[i]!.escalaRadio + conEvidencia[k]!.escalaRadio) / 2 - 1);
        const f = ((LAYOUT_K * LAYOUT_K) / d) * tamano;
        dx /= d; dy /= d; dz /= d;
        const dA = disp.get(a)!;
        const dB = disp.get(b)!;
        dA.x += dx * f; dA.y += dy * f; dA.z += dz * f;
        dB.x -= dx * f; dB.y -= dy * f; dB.z -= dz * f;
      }
    }

    // Atracción por arista.
    for (const e of activas) {
      const A = pos.get(e.source)!;
      const B = pos.get(e.target)!;
      let dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
      const d = Math.hypot(dx, dy, dz) || 0.01;
      const escala = e.kind === "afinidad" ? LAYOUT_TIRON_AFINIDAD * e.weight : 1;
      const f = ((d * d) / LAYOUT_K) * escala;
      dx /= d; dy /= d; dz /= d;
      const dA = disp.get(e.source)!;
      const dB = disp.get(e.target)!;
      dA.x -= dx * f; dA.y -= dy * f; dA.z -= dz * f;
      dB.x += dx * f; dB.y += dy * f; dB.z += dz * f;
    }

    // Centrado: sin esto el grafo entero deriva y queda descentrado en el cuadro.
    for (const n of conEvidencia) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      d.x -= p.x * LAYOUT_CENTRADO * LAYOUT_K;
      d.y -= p.y * LAYOUT_CENTRADO * LAYOUT_K;
      d.z -= p.z * LAYOUT_CENTRADO * LAYOUT_K;
    }

    // Sesgo radial por tipo: los trabajos hacia la corteza, las tecnologías
    // hacia el núcleo. La referencia es el MISMO percentil que usa la
    // normalización de más abajo, así el objetivo de cada tipo significa lo
    // mismo durante la simulación que después de escalar.
    const ref = percentilRadio(conEvidencia, pos);
    for (const n of conEvidencia) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      const r = Math.hypot(p.x, p.y, p.z) || 0.01;
      const f = (LAYOUT_RADIO_TIPO[n.kind] * ref - r) * LAYOUT_SESGO_RADIAL;
      d.x += (p.x / r) * f; d.y += (p.y / r) * f; d.z += (p.z / r) * f;
    }

    for (const n of conEvidencia) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      const m = Math.hypot(d.x, d.y, d.z) || 0.01;
      const s = Math.min(m, paso) / m;
      p.x += d.x * s; p.y += d.y * s; p.z += d.z * s;
    }
  }

  // --- Normalización: centroide al origen y escala fija ---------------------
  // Sin esto el encuadre depende del dataset: sumar un logro movería el zoom de
  // toda la página, y un nodo suelto que vuela lejos aplasta al resto.
  const centro = { x: 0, y: 0, z: 0 };
  for (const n of conEvidencia) {
    const p = pos.get(n.id)!;
    centro.x += p.x; centro.y += p.y; centro.z += p.z;
  }
  centro.x /= conEvidencia.length;
  centro.y /= conEvidencia.length;
  centro.z /= conEvidencia.length;

  for (const n of conEvidencia) {
    const p = pos.get(n.id)!;
    p.x -= centro.x; p.y -= centro.y; p.z -= centro.z;
  }

  // El percentil se mide sobre el CUERPO y no sobre todo: si las huérfanas
  // contaran, agregar una skill sin evidencia cambiaría el zoom de la página.
  const factor = LAYOUT_RADIO_OBJETIVO / percentilRadio(conEvidencia, pos);

  for (const n of conEvidencia) {
    const p = pos.get(n.id)!;
    p.x *= factor; p.y *= factor; p.z *= factor;
  }

  ubicarNucleo(graph.nodes.filter((n) => n.degree === 0), graph.nodes, pos);

  const nodes: PositionedNode[] = graph.nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      ...n,
      // Redondeo a 2 decimales: las coordenadas viajan en el HTML y la
      // precisión de más son bytes que no cambian ni un píxel.
      x: round2(p.x),
      y: round2(p.y),
      z: round2(p.z),
      sinEvidencia: n.degree === 0,
    };
  });

  // El encuadre sale del nodo más lejano REAL y no de una constante: ahora que
  // los roles se empujan hacia afuera, quién queda al borde lo decide la
  // simulación. Fijarlo a mano recortaría el mapa en cuanto se sume un rol.
  const radioEncuadre = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y, n.z)));

  return { nodes, edges: graph.edges, radioEncuadre: round2(radioEncuadre) };
}

/**
 * Las skills sin evidencia, en el núcleo.
 *
 * NO entran a la simulación de fuerzas: sin una sola arista, la repulsión de los
 * otros 36 nodos le gana a cualquier ancla radial y se escapan al borde — que es
 * exactamente lo contrario de "las tecnologías van al centro".
 *
 * En vez de eso, el radio es un dato fijo y la repulsión solo las reparte
 * ANGULARMENTE sobre esa esfera. Esa restricción es lo que hace que funcione:
 * el centro del mapa está ocupado por las skills grandes (React dibuja radio 34
 * y su disco cubre el origen), así que las huérfanas no necesitan alejarse, sino
 * correrse al lado libre de la esfera. Con la posición libre no encuentran ese
 * lado; con el radio clavado, sí.
 *
 * Corre después de normalizar: así el núcleo se mide contra el cuerpo ya escalado
 * y no contra las unidades arbitrarias de la simulación.
 */
function ubicarNucleo(nucleo: GraphNode[], todos: GraphNode[], pos: Map<string, Vec3>): void {
  if (nucleo.length === 0) return;
  const radio = LAYOUT_RADIO_OBJETIVO * LAYOUT_RADIO_NUCLEO;

  // Siembra de Fibonacci: reparte sin aleatoriedad, igual que el cuerpo.
  nucleo.forEach((n, i) => {
    const t = (i + 0.5) / nucleo.length;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    pos.set(n.id, {
      x: Math.cos(theta) * Math.sin(phi) * radio,
      y: Math.sin(theta) * Math.sin(phi) * radio,
      z: Math.cos(phi) * radio,
    });
  });

  const sobreLaEsfera = (p: Vec3) => {
    const m = Math.hypot(p.x, p.y, p.z) || 0.01;
    p.x *= radio / m; p.y *= radio / m; p.z *= radio / m;
  };

  for (let it = 0; it < LAYOUT_TICKS_NUCLEO; it++) {
    const paso = 0.5 * (1 - it / LAYOUT_TICKS_NUCLEO);
    for (const n of nucleo) {
      const p = pos.get(n.id)!;
      let dx = 0, dy = 0, dz = 0;
      for (const o of todos) {
        if (o.id === n.id) continue;
        const q = pos.get(o.id)!;
        const ex = p.x - q.x, ey = p.y - q.y, ez = p.z - q.z;
        const d = Math.hypot(ex, ey, ez) || 0.01;
        // Pesado por el radio de dibujo del vecino: lo que hay que despejar es
        // su DISCO, y en este mapa los discos ya no miden todos lo mismo.
        const f = (o.escalaRadio * LAYOUT_K * LAYOUT_K) / (d * d);
        dx += (ex / d) * f; dy += (ey / d) * f; dz += (ez / d) * f;
      }
      p.x += dx * paso; p.y += dy * paso; p.z += dz * paso;
      // La componente radial se descarta: solo se permite girar sobre la esfera.
      sobreLaEsfera(p);
    }
  }
}

/**
 * Radio del cuerpo, por percentil. Vive acá porque lo usan dos cosas que TIENEN
 * que coincidir: el sesgo radial durante la simulación y la normalización final.
 */
function percentilRadio(nodos: GraphNode[], pos: Map<string, Vec3>): number {
  const radios = nodos
    .map((n) => { const p = pos.get(n.id)!; return Math.hypot(p.x, p.y, p.z); })
    .sort((a, b) => a - b);
  return radios[Math.floor(radios.length * LAYOUT_PERCENTIL_RADIO)] || 1;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// PROYECCIÓN
// ---------------------------------------------------------------------------

/** Rotación fija de la cámara. La misma la usa el `<svg>` y la pose inicial 3D. */
export const CAMARA_RX = -0.42;
export const CAMARA_RY = 0.62;
/** Distancia focal y distancia de cámara. Definen cuánta perspectiva hay. */
export const CAMARA_F = 1250;
export const CAMARA_DIST = 1150;

export interface ProjectedNode {
  id: string;
  /** Coordenadas en el plano del SVG. */
  x: number;
  y: number;
  /** Factor de perspectiva: >1 está cerca, <1 está lejos. Manda tamaño y niebla. */
  escala: number;
  /** Profundidad tras rotar. Se usa para ordenar el pintado. */
  z: number;
}

/**
 * Proyección en perspectiva. Es lo que hace que el mapa se lea con volumen en
 * un `<svg>` estático: sin esto, un grafo 3D dibujado en 2D es indistinguible
 * de uno plano.
 */
export function projectNode(n: Vec3): Omit<ProjectedNode, "id"> {
  const x1 = n.x * Math.cos(CAMARA_RY) + n.z * Math.sin(CAMARA_RY);
  const z1 = -n.x * Math.sin(CAMARA_RY) + n.z * Math.cos(CAMARA_RY);
  const y2 = n.y * Math.cos(CAMARA_RX) - z1 * Math.sin(CAMARA_RX);
  const z2 = n.y * Math.sin(CAMARA_RX) + z1 * Math.cos(CAMARA_RX);

  const escala = CAMARA_F / (z2 + CAMARA_DIST);
  return { x: round2(x1 * escala), y: round2(y2 * escala), escala: round2(escala), z: round2(z2) };
}

export function projectGraph(g: PositionedGraph): ProjectedNode[] {
  return g.nodes.map((n) => ({ id: n.id, ...projectNode(n) }));
}
