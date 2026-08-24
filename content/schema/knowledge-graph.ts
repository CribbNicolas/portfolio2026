/**
 * ContentView → KnowledgeGraph.
 *
 * Esta es la vista que cumple la promesa del CONTRATO §3: los `Achievement`
 * viven sueltos, no anidados en `Role`, "así podés consultarlos por skill, por
 * dimensión, o por proyecto". El CV aplana ese grafo en una lista; acá se
 * muestra como lo que es.
 *
 * Entra `ContentView` y NO `ContentDataset` a propósito: `resolveView` ya
 * aplicó la visibility, así que este módulo no filtra nada (invariante 1).
 * Aplanar `skills` (que viene agrupado) y desanidar `achievements` no es
 * filtrar: es cambiar de forma.
 */

import type { ContentView, SkillCategory } from "./content-schema";
import { monthsBetween } from "./dates";

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export type GraphNodeKind = "skill" | "role" | "project" | "achievement";

/** De dónde sale una arista. El tipo decide cómo se dibuja y cuánto tira. */
export type GraphEdgeKind =
  /** Estructura declarada en el dataset: logro→rol, logro→skill, proyecto→skill. */
  | "estructura"
  /** Derivada: dos skills que comparten evidencia. Ver `afinidadDeSkills`. */
  | "afinidad";

export interface GraphNode {
  /** Namespaced (`skill:react`): un Skill y un Project pueden compartir id. */
  id: string;
  kind: GraphNodeKind;
  label: string;
  /**
   * Texto real para el tooltip. Nunca truncado (invariante 6): si un campo
   * `short` no sirve, se elige otro campo, no se recorta el largo.
   */
  detail: string;
  /** Categoría de la skill. Va en el tooltip, NUNCA en el color (spec §4). */
  categoria?: SkillCategory;
  /** Grado en el grafo ya construido. Es el `Nc` de la fórmula de tamaño. */
  degree: number;
  /**
   * Años de uso. Es el `T` de la fórmula. Cero fuera de las skills y cero para
   * una skill sin `since` y sin evidencia fechada — nunca se inventa (invariante 4).
   */
  anios: number;
  /** `T × Nc`. Lo que ordena el tamaño. Cero fuera de las skills. */
  peso: number;
  /**
   * Multiplicador del radio base del tipo. Exactamente 1 fuera de las skills:
   * un rol o un logro no tiene "años de uso", así que su tamaño lo sigue
   * mandando el tipo. Lo consumen el `<svg>` y la escena 3D por igual.
   */
  escalaRadio: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /**
   * Cuántas fuentes distintas respaldan la arista. Siempre 1 en `estructura`;
   * en `afinidad` es cuántos logros/proyectos comparten las dos skills.
   */
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Rango del multiplicador de radio de una skill.
 *
 * El piso NO es cero: una skill sin evidencia sigue siendo una skill declarada,
 * y un nodo invisible no se puede hover ni clickear. El techo es 3.4 para que
 * la tecnología más probada quede claramente por encima de un rol (radio fijo),
 * que es lo que hace legible "esto es lo que más domino".
 */
export const ESCALA_RADIO_MIN = 0.6;
export const ESCALA_RADIO_MAX = 3.4;

export const nodeId = (kind: GraphNodeKind, id: string): string => `${kind}:${id}`;

// ---------------------------------------------------------------------------
// CONSTRUCCIÓN
// ---------------------------------------------------------------------------

export function buildKnowledgeGraph(view: ContentView): KnowledgeGraph {
  // El orden de emisión tiene que ser estable: el layout lo usa para sembrar
  // las posiciones iniciales, así que un orden distinto es un mapa distinto.
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const skills = Object.values(view.skills).flat();
  const achievements = view.experience.flatMap((r) => r.achievements);

  for (const s of skills) {
    nodes.push({
      id: nodeId("skill", s.id),
      kind: "skill",
      label: s.name,
      detail: s.name,
      categoria: s.category,
      degree: 0,
      anios: 0,
      peso: 0,
      escalaRadio: 1,
    });
  }

  for (const r of view.experience) {
    nodes.push({
      id: nodeId("role", r.id),
      kind: "role",
      label: r.company,
      detail: r.context.short,
      degree: 0,
      anios: 0,
      peso: 0,
      escalaRadio: 1,
    });
  }

  for (const p of view.projects) {
    nodes.push({
      id: nodeId("project", p.id),
      kind: "project",
      // `problem.short` y `outcome.short` todavía tienen TODO en 2 de 3
      // proyectos (docs/00 §pendientes). `solution.short` está limpio en los
      // tres, y hay un test que afirma que ningún `detail` arranca con TODO:
      // si mañana se completan los otros campos, cambiar la elección acá.
      label: p.name,
      detail: p.solution.short,
      degree: 0,
      anios: 0,
      peso: 0,
      escalaRadio: 1,
    });
  }

  for (const a of achievements) {
    nodes.push({
      id: nodeId("achievement", a.id),
      kind: "achievement",
      label: a.text.short,
      detail: a.text.short,
      degree: 0,
      anios: 0,
      peso: 0,
      escalaRadio: 1,
    });
  }

  const existe = new Set(nodes.map((n) => n.id));
  /**
   * Clausura referencial: `resolveView` filtra skills por `active`, así que un
   * logro puede apuntar a una skill que no está en la vista. Esa arista se
   * descarta en silencio — dejarla pasar hace que el layout opere sobre
   * `undefined` y el grafo explote sin mensaje útil.
   */
  const conectar = (source: string, target: string, kind: GraphEdgeKind, weight: number) => {
    if (!existe.has(source) || !existe.has(target)) return;
    edges.push({ source, target, kind, weight });
  };

  for (const a of achievements) {
    const from = nodeId("achievement", a.id);
    conectar(from, nodeId("role", a.roleId), "estructura", 1);
    if (a.projectId) conectar(from, nodeId("project", a.projectId), "estructura", 1);
    for (const s of a.skillIds) conectar(from, nodeId("skill", s), "estructura", 1);
  }

  for (const p of view.projects) {
    const from = nodeId("project", p.id);
    if (p.roleId) conectar(from, nodeId("role", p.roleId), "estructura", 1);
    for (const s of p.skillIds) conectar(from, nodeId("skill", s), "estructura", 1);
  }

  for (const { a, b, weight } of afinidadDeSkills(view)) {
    conectar(nodeId("skill", a), nodeId("skill", b), "afinidad", weight);
  }

  const grado = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    grado.set(e.source, (grado.get(e.source) ?? 0) + 1);
    grado.set(e.target, (grado.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) n.degree = grado.get(n.id) ?? 0;

  // Tamaño = años × conexiones. Recién acá, porque `Nc` es el grado del grafo
  // YA construido: depende de las aristas de afinidad, que son derivadas.
  const anios = aniosDeSkill(view);
  for (const n of nodes) {
    if (n.kind !== "skill") continue;
    n.anios = anios.get(n.id.slice("skill:".length)) ?? 0;
    n.peso = n.anios * n.degree;
  }

  // Normalizado contra la skill más pesada y por RAÍZ: lo que el ojo compara en
  // un disco es el área, no el radio. Con radio lineal, 4× de peso da 16× de
  // área y el mapa se vuelve un nodo con satélites.
  const pesoMax = Math.max(0, ...nodes.map((n) => n.peso));
  for (const n of nodes) {
    if (n.kind !== "skill") continue;
    const t = pesoMax > 0 ? Math.sqrt(n.peso / pesoMax) : 0;
    n.escalaRadio = ESCALA_RADIO_MIN + (ESCALA_RADIO_MAX - ESCALA_RADIO_MIN) * t;
  }

  return { nodes, edges };
}

/**
 * Años de uso por skill. El `T` de la fórmula de tamaño.
 *
 * Dos fuentes, en este orden:
 *
 * 1. `Skill.since`, si está declarado. Es el único dato que puede saber que
 *    empezaste a usar algo ANTES del primer logro que lo menciona.
 * 2. El span de la evidencia fechada: los roles de los logros que la citan, y
 *    los proyectos que la usan (por fecha PROPIA del proyecto, no la de su rol
 *    — `jwd-maderas` no tiene `roleId` y sin esto Next.js, Tailwind y Sanity
 *    darían 0 años teniendo 5 conexiones cada una).
 *
 * Sin ninguna de las dos, cero. No se estima nada (invariante 4): una skill sin
 * evidencia se dibuja chica, que es el mapa mostrando dónde falta contenido.
 *
 * Las duraciones salen de `dates.ts` y no de aritmética local: regla 1.
 */
export function aniosDeSkill(view: ContentView): Map<string, number> {
  const roles = new Map(view.experience.map((r) => [r.id, r]));
  const periodos = new Map<string, Array<{ start: string; end: string | null }>>();

  const registrar = (skillId: string, start: string, end: string | null) => {
    if (!periodos.has(skillId)) periodos.set(skillId, []);
    periodos.get(skillId)!.push({ start, end });
  };

  for (const r of view.experience) {
    for (const a of r.achievements) {
      const rol = roles.get(a.roleId);
      if (!rol) continue;
      for (const s of a.skillIds) registrar(s, rol.start, rol.end ?? null);
    }
  }
  for (const p of view.projects) {
    for (const s of p.skillIds) registrar(s, p.start, p.end ?? null);
  }

  const salida = new Map<string, number>();
  for (const s of Object.values(view.skills).flat()) {
    if (s.since) {
      salida.set(s.id, monthsBetween(s.since, null) / 12);
      continue;
    }
    const ps = periodos.get(s.id);
    if (!ps || ps.length === 0) {
      salida.set(s.id, 0);
      continue;
    }
    // Un span, no la suma: usar React en dos trabajos a la vez no son dos veces
    // los mismos años. La regla 2 del contrato dice lo mismo de los roles.
    const inicio = ps.map((p) => p.start).sort()[0]!;
    const abierto = ps.some((p) => p.end === null);
    const fin = abierto ? null : ps.map((p) => p.end!).sort().at(-1)!;
    salida.set(s.id, monthsBetween(inicio, fin) / 12);
  }
  return salida;
}

/**
 * Aristas skill↔skill por co-ocurrencia.
 *
 * Dos skills que aparecen en el MISMO logro o proyecto están relacionadas por
 * evidencia, no por opinión: el dato ya está en el dataset, solo que implícito.
 * Esto no inventa nada (invariante 4) — si dos skills nunca aparecieron juntas
 * en un hecho real, no hay arista.
 *
 * `weight` = cuántas fuentes distintas las comparten. Es lo que distingue
 * "las usé juntas una vez" de "son mi combinación de trabajo".
 */
export function afinidadDeSkills(view: ContentView): Array<{ a: string; b: string; weight: number }> {
  const fuentes = new Map<string, Set<string>>();

  const registrar = (skillIds: readonly string[], fuente: string) => {
    for (let i = 0; i < skillIds.length; i++) {
      for (let k = i + 1; k < skillIds.length; k++) {
        const [a, b] = skillIds[i]! < skillIds[k]! ? [skillIds[i]!, skillIds[k]!] : [skillIds[k]!, skillIds[i]!];
        const clave = `${a}|${b}`;
        if (!fuentes.has(clave)) fuentes.set(clave, new Set());
        fuentes.get(clave)!.add(fuente);
      }
    }
  };

  for (const r of view.experience) for (const a of r.achievements) registrar(a.skillIds, a.id);
  for (const p of view.projects) registrar(p.skillIds, p.id);

  return [...fuentes].map(([clave, srcs]) => {
    const [a, b] = clave.split("|") as [string, string];
    return { a, b, weight: srcs.size };
  });
}

/**
 * Nodos sin ninguna arista. Hoy son 11 skills `working` declaradas que no
 * aparecen en ningún logro ni proyecto: la regla 3 no las caza porque solo
 * exige evidencia para `core`. No es un bug del mapa — es el mapa mostrando
 * dónde falta contenido. Lo consume `scripts/audit-grafo.ts`.
 */
export function nodosSinEvidencia(graph: KnowledgeGraph): GraphNode[] {
  return graph.nodes.filter((n) => n.degree === 0);
}
