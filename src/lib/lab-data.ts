/**
 * `PositionedGraph` + `Messages` → the exact payload the map's boot script
 * parses out of `[data-lab-data]`.
 *
 * Both landings built this object inline, as an untyped argument to
 * `JSON.stringify`, each with its own copy of the same field list. `LabData`
 * (`src/scripts/lab/types.ts`) is the CONTRACT the browser-side code actually
 * relies on, but nothing connected the two: add a key to `LabStrings`, wire it
 * into one page and forget the other, and both builds still pass — the
 * omission only surfaces at runtime, on whichever locale nobody touched, the
 * moment a visitor clicks a node.
 *
 * One function both pages call turns that into a compile error: a `LabData`
 * shape mismatch fails here, in a file every page imports, not silently on
 * the page that got left behind.
 *
 * Lives in `src/lib/`, not `src/scripts/`: this runs at BUILD time, in the
 * page's frontmatter, same as `graph-svg.ts` and `jsonld.ts`. It may import
 * from `@content` freely — nothing here reaches the browser, only its JSON
 * output does. `src/scripts/lab/types.ts`'s ban on importing `@content` is
 * about code shipped to the client, and this module is not that.
 *
 * Relative imports, not the `@content` alias, for the same reason
 * `jsonld.ts` and `anchors.ts` use them: only Vite resolves that alias, and a
 * plain `tsx` run of some future check or test over this file would not.
 * Both imports here are `import type`, so there is no runtime cost either way.
 */
import type { Messages } from "../../content/schema/messages";
import type { PositionedGraph } from "../../content/source/index";
import type { LabData } from "../scripts/lab/types";

export function buildLabData(positioned: PositionedGraph, m: Messages): LabData {
  return {
    // One-letter keys: this travels in the HTML of every visit, and with
    // dozens of nodes long property names would cost more than the data.
    nodes: positioned.nodes.map((n) => ({
      i: n.id,
      k: n.kind,
      x: n.x,
      y: n.y,
      z: n.z,
      d: n.degree,
      r: Math.round(n.radiusScale * 100) / 100,
      n: n.label,
      t: n.detail,
      ...(n.category ? { c: n.category } : {}),
    })),
    edges: positioned.edges.map((e) => ({
      s: e.source,
      t: e.target,
      a: e.kind === "affinity",
      w: e.weight,
    })),
    radius: positioned.framingRadius,
    // Chrome words for the panel/tooltip, built once per page rather than
    // once per node: `interaction.ts` runs in the browser and may not import
    // `@content` (it would drag zod and the whole dataset along), so this is
    // the only path a translated label has into that file. See `messages.ts`.
    strings: {
      kind: {
        role: m.mapKindRole,
        project: m.mapKindProject,
        achievement: m.mapKindAchievement,
        skill: m.mapKindSkill,
      },
      connection: [m.mapConnectionSingular, m.mapConnectionPlural],
      achievement: [m.mapAchievementSingular, m.mapAchievementPlural],
      more: m.mapMoreTemplate,
    },
  };
}
