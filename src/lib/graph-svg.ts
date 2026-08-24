/**
 * PositionedGraph → lista de dibujo para el `<svg>`.
 *
 * Toda la matemática de presentación del mapa vive acá y no en el componente:
 * el componente recorre una lista y escribe atributos (invariante 1). Además
 * así se puede testear que la profundidad se lee, que es lo único que hace que
 * un grafo 3D dibujado en 2D no parezca plano.
 *
 * Import relativo por el mismo motivo que `jsonld.ts` y `lab-hover-css.ts`.
 */

import type { PositionedGraph, GraphNodeKind } from "../../content/source/index";
import { projectNode } from "../../content/schema/graph-layout";
import { ID_NODO } from "./lab-hover-css";

/** Radio base por tipo. El tamaño distingue el tipo; el color casi no (spec §4). */
export const RADIO: Record<GraphNodeKind, number> = {
  role: 10,
  project: 8,
  skill: 5.6,
  achievement: 5.2,
};

export interface SvgNodo {
  id: string;
  domId: string;
  kind: GraphNodeKind;
  label: string;
  detail: string;
  cx: number;
  cy: number;
  r: number;
  /** Opacidad por profundidad. Es la niebla. */
  opacidad: number;
  /** Radio del disco de oclusión que tapa las aristas de atrás. */
  rHalo: number;
  conEvidencia: boolean;
  grosorTrazo: number;
}

export interface SvgArista {
  x1: number; y1: number; x2: number; y2: number;
  ancho: number;
  opacidad: number;
  afinidad: boolean;
}

export interface SvgEtiqueta {
  x: number;
  y: number;
  texto: string;
  kind: GraphNodeKind;
  tamano: number;
  opacidad: number;
}

export interface SvgMapa {
  aristas: SvgArista[];
  nodos: SvgNodo[];
  /** Solo las que entran sin pisarse. Ver `ubicarEtiquetas`. */
  etiquetas: SvgEtiqueta[];
  /** `viewBox` calculado del contenido real, con margen. */
  viewBox: string;
}

/** Cuánto se desvanece lo más lejano. 0 sería invisible; 0.28 todavía se lee. */
const NIEBLA_MIN = 0.28;

export function buildSvgMapa(graph: PositionedGraph): SvgMapa {
  const proyectado = new Map(
    graph.nodes.map((n) => [n.id, { nodo: n, p: projectNode(n) }]),
  );

  const escalas = [...proyectado.values()].map((v) => v.p.escala);
  const sMin = Math.min(...escalas);
  const sMax = Math.max(...escalas);
  const rango = sMax - sMin || 1;
  const niebla = (s: number): number =>
    redondear(NIEBLA_MIN + (1 - NIEBLA_MIN) * ((s - sMin) / rango));

  // El orden de pintado ES la profundidad: primero lo de atrás.
  const aristas: SvgArista[] = graph.edges
    .flatMap((e) => {
      const A = proyectado.get(e.source);
      const B = proyectado.get(e.target);
      if (!A || !B) return [];
      const prof = (A.p.escala + B.p.escala) / 2;
      const afinidad = e.kind === "afinidad";
      return [{
        prof,
        arista: {
          x1: A.p.x, y1: A.p.y, x2: B.p.x, y2: B.p.y,
          // Las de afinidad engordan con la evidencia que comparten: la más
          // gruesa es la relación más probada, no la más linda.
          ancho: redondear((afinidad ? 0.7 + e.weight * 0.42 : 1.15) * (0.6 + prof * 0.5)),
          opacidad: redondear(niebla(prof) * (afinidad ? 0.62 : 0.85)),
          afinidad,
        },
      }];
    })
    .sort((a, b) => a.prof - b.prof)
    .map((x) => x.arista);

  const nodos: SvgNodo[] = [...proyectado.values()]
    .sort((a, b) => a.p.escala - b.p.escala)
    .map(({ nodo, p }) => {
      // `escalaRadio` es 1 salvo en las skills, donde codifica años × conexiones.
      const r = redondear(RADIO[nodo.kind] * nodo.escalaRadio * p.escala);
      return {
        id: nodo.id,
        domId: ID_NODO(nodo.id),
        kind: nodo.kind,
        label: nodo.label,
        detail: nodo.detail,
        cx: p.x,
        cy: p.y,
        r,
        opacidad: niebla(p.escala),
        // Disco del color del fondo detrás del nodo: simula oclusión. Es lo que
        // convierte una telaraña plana en un cuerpo con adelante y atrás.
        rHalo: redondear(r + 2.6),
        conEvidencia: !nodo.sinEvidencia,
        // Proporcional al radio y no solo a la perspectiva: con un radio fijo
        // el contorno de un nodo grande queda de hilo y el de uno chico, gordo.
        grosorTrazo: redondear(1.7 * p.escala * Math.min(1.8, Math.sqrt(nodo.escalaRadio))),
      };
    });

  const etiquetas = ubicarEtiquetas(nodos);

  // El viewBox tiene que contemplar el ANCHO de las etiquetas, no solo los
  // centros de los nodos: si no, la etiqueta de un nodo del borde se corta.
  // Pasaba con "Independiente", que quedaba como "lependiente".
  const xs = [
    ...nodos.flatMap((n) => [n.cx - n.r, n.cx + n.r]),
    ...etiquetas.flatMap((e) => [e.x - anchoEtiqueta(e) / 2, e.x + anchoEtiqueta(e) / 2]),
  ];
  const ys = [
    ...nodos.flatMap((n) => [n.cy - n.r, n.cy + n.r]),
    ...etiquetas.flatMap((e) => [e.y - e.tamano, e.y]),
  ];
  const margen = 16;
  const minX = Math.min(...xs) - margen;
  const minY = Math.min(...ys) - margen;
  const w = Math.max(...xs) - Math.min(...xs) + margen * 2;
  const h = Math.max(...ys) - Math.min(...ys) + margen * 2;

  return {
    aristas,
    nodos,
    etiquetas,
    viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`,
  };
}

/**
 * Etiquetas sin superposición.
 *
 * Se etiquetan roles y proyectos, pero dibujarlos todos los pisa entre sí: en
 * este dataset "Plugins de WordPress con tooling moderno" tapaba "Mapas
 * interactivos de distritos". Estrategia glotona de adelante hacia atrás — lo
 * más cercano gana la etiqueta, que es lo que espera el ojo. La que no entra se
 * omite: el nombre sigue disponible en el `<title>` del nodo y en el tooltip.
 */
function ubicarEtiquetas(nodos: SvgNodo[]): SvgEtiqueta[] {
  const candidatos = nodos
    .filter((n) => n.kind === "role" || n.kind === "project")
    // De más cerca a más lejos: `nodos` viene ordenado al revés (para pintar).
    .slice()
    .reverse();

  const puestas: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const salida: SvgEtiqueta[] = [];

  for (const n of candidatos) {
    // Se recupera la perspectiva del radio ya dibujado. Vale porque solo se
    // etiquetan roles y proyectos, y ahí `escalaRadio` es exactamente 1.
    const escala = n.r / RADIO[n.kind];
    const tamano = redondear(14.5 * escala);
    const y = redondear(n.cy - n.r - 7);
    // Ancho aproximado: 0.52em por carácter es una estimación conservadora para
    // Manrope. No hace falta medir de verdad — solo se decide si hay choque.
    const ancho = n.label.length * tamano * 0.52;
    // Se le suma aire alrededor: dos etiquetas que apenas no se tocan igual se
    // leen mal. El aire es lo que las separa de verdad.
    const aire = tamano * 0.6;
    const caja = {
      x1: n.cx - ancho / 2 - aire, x2: n.cx + ancho / 2 + aire,
      y1: y - tamano - aire, y2: y + tamano * 0.3 + aire,
    };

    const choca = puestas.some((p) =>
      caja.x1 < p.x2 && caja.x2 > p.x1 && caja.y1 < p.y2 && caja.y2 > p.y1,
    );
    if (choca) continue;

    puestas.push(caja);
    salida.push({ x: n.cx, y, texto: n.label, kind: n.kind, tamano, opacidad: n.opacidad });
  }

  // Se devuelven de atrás hacia adelante para que el orden de pintado siga
  // coincidiendo con la profundidad.
  return salida.reverse();
}

/** Ancho aproximado en unidades del viewBox. Solo se usa para encuadrar. */
const anchoEtiqueta = (e: SvgEtiqueta): number => e.texto.length * e.tamano * 0.52;

const redondear = (n: number): number => Math.round(n * 1000) / 1000;
