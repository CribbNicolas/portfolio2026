/**
 * The list↔map bridge.
 *
 * It knows neither three nor the markup: it is an `EventTarget` with two
 * methods. That is why the renderer can be swapped without touching the DOM,
 * and the other way around.
 *
 * Note: in CSS the cross-hover ALREADY works without JavaScript
 * (`lab-hover-css.ts`). This exists for the side CSS cannot do — highlighting a
 * node inside the WebGL canvas, where there are no elements and no `:hover`.
 */

export type HoverSource = "dom" | "canvas";
export type HoverListener = (id: string | null, source: HoverSource) => void;

export interface HoverBus {
  activate(id: string | null, source: HoverSource): void;
  onChange(fn: HoverListener): () => void;
  current(): string | null;
}

export function createHoverBus(): HoverBus {
  const listeners = new Set<HoverListener>();
  let active: string | null = null;

  return {
    activate(id, source) {
      // Deduplication is what prevents the loop: both sides listen and emit, so
      // without this a hover bounces forever.
      if (id === active) return;
      active = id;
      for (const fn of listeners) fn(id, source);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    current: () => active,
  };
}
