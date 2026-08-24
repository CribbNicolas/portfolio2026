/**
 * Tipos que cruzan la frontera cliente↔servidor.
 *
 * Este archivo NO importa nada en runtime, y es el ÚNICO lugar por donde los
 * tipos entran a `src/scripts/`. La regla existe por dos motivos concretos:
 *
 * 1. Un `import` de `@content` desde código de cliente arrastra zod y el
 *    dataset entero al browser: `json-source.ts` importa los dos de forma
 *    estática. Mismo problema que documenta `src/lib/jsonld.ts`.
 * 2. Un import estático de `graph-3d` desde cualquier módulo hace que Rollup
 *    meta three en el chunk crítico, aunque el otro import sea dinámico.
 */

export type LabNodeKind = "skill" | "role" | "project" | "achievement";

/** Claves cortas: esto viaja en el HTML de cada visita. */
export interface LabNodo {
  i: string;
  k: LabNodeKind;
  x: number;
  y: number;
  z: number;
  /** Grado. Es el `Nc` de la fórmula de tamaño y ordena la lista del DOM. */
  d: number;
  /**
   * Multiplicador del radio base del tipo: años de uso × conexiones, por raíz.
   * 1 fuera de las skills. Se calcula en build (`knowledge-graph.ts`) — acá solo
   * se multiplica, para que el `<svg>` y el 3D dibujen exactamente lo mismo.
   */
  r: number;
  /** Nombre visible. */
  n: string;
  /** Texto real del tooltip: el logro, el contexto del rol, la solución. */
  t: string;
  /** Categoría de la skill. Va en el panel, nunca en el color (spec §4). */
  c?: string;
}

export interface LabArista {
  s: string;
  t: string;
  /** true = afinidad (skill↔skill derivada), false = estructura del dataset. */
  a: boolean;
  w: number;
}

export interface LabDatos {
  nodes: LabNodo[];
  edges: LabArista[];
  radio: number;
}

/** Lo que expone cada módulo de render. Permite cambiar de renderer sin tocar nada más. */
export interface Escena {
  destruir(): void;
  /** Enfoca un nodo desde afuera del canvas (la lista del DOM, con teclado). */
  enfocar?(id: string | null): void;
}
