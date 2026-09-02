/**
 * Which nodes carry a name on the map, and which of those names never hide.
 *
 * Workplaces (roles) always have a title. Skills grow with years × connections;
 * once they match a workplace in size they get the same treatment — otherwise
 * React sits there as the biggest disc with no name, and only Dinkum is labelled.
 *
 * `r` is the client payload's radiusScale; `radiusScale` is the layout node's.
 * Same number, two names, because the HTML payload uses one-letter keys.
 */

/** Past this, a skill is as big as a role disc and needs a name. */
export const STICKY_LABEL_SCALE = 1.7;

export function isStickyMapLabel(n: {
  kind: string;
  radiusScale?: number;
  r?: number;
}): boolean {
  if (n.kind === "role") return true;
  const scale = n.radiusScale ?? n.r ?? 0;
  return n.kind === "skill" && scale >= STICKY_LABEL_SCALE;
}

export function nodeHasMapLabel(n: {
  kind: string;
  radiusScale?: number;
  r?: number;
}): boolean {
  if (n.kind === "role" || n.kind === "project") return true;
  return isStickyMapLabel(n);
}
