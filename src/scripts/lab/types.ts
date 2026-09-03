/**
 * Types crossing the client↔server boundary.
 *
 * This file imports NOTHING at runtime, and it is the ONLY way types enter
 * `src/scripts/`. The rule exists for two concrete reasons:
 *
 * 1. An `import` of `@content` from client code drags zod and the whole dataset
 *    into the browser: `json-source.ts` imports both statically. Same problem
 *    documented in `src/lib/jsonld.ts`.
 * 2. A static import of `graph-3d` from any module makes Rollup hoist three
 *    into the critical chunk, even when the other import is dynamic.
 */

export type LabNodeKind = "skill" | "role" | "project" | "achievement";

/** Short keys: this travels inside the HTML of every visit. */
export interface LabNode {
  i: string;
  k: LabNodeKind;
  x: number;
  y: number;
  z: number;
  /** Degree. The `Nc` of the size formula, and what orders the DOM list. */
  d: number;
  /**
   * Multiplier over the kind's base radius: years of use × connections, by
   * square root. 1 outside skills. Computed at build time
   * (`knowledge-graph.ts`) — here it is only multiplied, so the `<svg>` and the
   * 3D draw exactly the same thing.
   */
  r: number;
  /** Visible name. */
  n: string;
  /** Real tooltip text: the achievement, the role context, the solution. */
  t: string;
  /** The skill category. Goes in the panel, never in the color (spec §4). */
  c?: string;
}

export interface LabEdge {
  s: string;
  t: string;
  /** true = affinity (derived skill↔skill), false = structure from the dataset. */
  a: boolean;
  w: number;
}

/**
 * Chrome words the panel/tooltip need, resolved server-side from
 * `messages.ts` and sent once per page load — not once per node, so the
 * byte cost is fixed regardless of graph size. This is the only path a
 * translated label has into `interaction.ts`: that file runs in the browser
 * and may not import `@content` (see this file's header comment).
 */
export interface LabStrings {
  /** One word per `LabNodeKind`. */
  kind: Record<LabNodeKind, string>;
  /** Connection count: [singular, plural]. */
  connection: [string, string];
  /** Achievement heading: [singular, plural-before-the-count]. */
  achievement: [string, string];
  /** "+N more", with the literal placeholder `{n}`. */
  more: string;
}

export interface LabData {
  nodes: LabNode[];
  edges: LabEdge[];
  radius: number;
  strings: LabStrings;
}

/** What every render module exposes. Lets the renderer change with nothing else moving. */
export interface LabScene {
  destroy(): void;
  /** Focuses a node from outside the canvas (the DOM list, with a keyboard). */
  focusNode?(id: string | null): void;
}
