/**
 * The ONLY part of the map that travels on the critical path.
 *
 * No dependencies, and it imports neither three nor the render modules
 * statically: both `import()` calls are dynamic, so Rollup emits them as
 * separate chunks. If someone ever adds a static import of `graph-3d`, three
 * enters the initial bundle with nobody noticing — which is why a CI check
 * looks for `WebGLRenderer` in the critical chunks.
 */

import { mayAttempt } from "./capability";
import { followScroll } from "./pill";
import { createHoverBus } from "./hover-bus";
import type { LabData, LabScene } from "./types";

export function start(): void {
  // Before the graph's early return: the pill exists even if the map never
  // mounts, and it does not depend on the map's data.
  const pill = document.querySelector<HTMLElement>("[data-pildora]");
  if (pill) followScroll(pill);

  const dataEl = document.querySelector<HTMLScriptElement>("[data-lab-data]");
  const graphCanvas = document.querySelector<HTMLCanvasElement>("[data-lab-graph]");
  const fieldCanvas = document.querySelector<HTMLCanvasElement>("[data-lab-field]");
  const list = document.querySelector<HTMLElement>(".lab__lista");
  const tooltip = document.querySelector<HTMLElement>("[data-lab-tooltip]");
  if (!dataEl || !graphCanvas) return;

  let data: LabData;
  try {
    data = JSON.parse(dataEl.textContent ?? "");
  } catch {
    return; // The SVG stays, and it is already painted.
  }

  const bus = createHoverBus();
  wireList(list, bus);

  const panel = document.querySelector<HTMLElement>("[data-lab-panel]");

  if (!mayAttempt()) return;

  // Generous `rootMargin`: the chunk starts downloading slightly before the
  // section enters the viewport, so the pop-in is not visible.
  observeOnce(graphCanvas, "300px", () => {
    whenIdle(async () => {
      try {
        const { mountGraph } = await import("./graph-3d");
        // `Array.from` and not spread: the tsconfig `lib` does not include
        // `dom.iterable`.
        const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-lab-label]"));
        const scene = await mountGraph({ canvas: graphCanvas, data, bus, tooltip, panel, labels });
        register(scene);
        // Only with the 3D mounted can the list focus. Before that, clicking an
        // item has nowhere to go, and a button that does nothing is worse than
        // text that does not invite a click.
        if (scene?.focusNode) wireFocus(list, scene.focusNode);
      } catch {
        /* No message and no spinner: the SVG is already the right answer. */
      }
    });
  });

  if (fieldCanvas) {
    observeOnce(fieldCanvas, "0px", () => {
      whenIdle(async () => {
        try {
          const { mountField } = await import("./field");
          register(await mountField(fieldCanvas));
        } catch {
          /* The flat `--fondo` background is already underneath. */
        }
      });
    });
  }
}

// ---------------------------------------------------------------------------

const scenes: LabScene[] = [];

function register(s: LabScene | null): void {
  if (!s) return;
  scenes.push(s);
  // Once, not per scene: if the tab is discarded, everything is released.
  if (scenes.length === 1) {
    addEventListener("pagehide", () => {
      for (const x of scenes) x.destroy();
      scenes.length = 0;
    }, { once: true });
  }
}

/**
 * The DOM side of the bridge. Delegation: 4 listeners no matter how many nodes
 * there are. `focusin`/`focusout` is what makes it work with a keyboard.
 */
function wireList(list: HTMLElement | null, bus: ReturnType<typeof createHoverBus>): void {
  if (!list) return;
  const idOf = (t: EventTarget | null): string | null =>
    (t as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node ?? null;

  list.addEventListener("pointerover", (e) => bus.activate(idOf(e.target), "dom"), { passive: true });
  list.addEventListener("pointerout", () => bus.activate(null, "dom"), { passive: true });
  list.addEventListener("focusin", (e) => bus.activate(idOf(e.target), "dom"));
  list.addEventListener("focusout", () => bus.activate(null, "dom"));
}

/**
 * Click and keyboard on the list focus the node in the map.
 *
 * Delegation again: 2 listeners. The items are already `tabindex=0` for
 * keyboard hover, so Enter and Space have to do the same thing as a click —
 * otherwise the map is reachable with a mouse only.
 */
function wireFocus(list: HTMLElement | null, focus: (id: string | null) => void): void {
  if (!list) return;
  list.classList.add("lab__lista--interactiva");

  const idOf = (t: EventTarget | null): string | null =>
    (t as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node ?? null;

  list.addEventListener("click", (e) => {
    const id = idOf(e.target);
    if (id) focus(id);
  });

  list.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = idOf(e.target);
    if (!id) return;
    e.preventDefault(); // Space scrolls the page; here they already picked the item.
    focus(id);
  });
}

function observeOnce(el: Element, rootMargin: string, fn: () => void): void {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    fn();
  }, { rootMargin });
  io.observe(el);
}

/** `requestIdleCallback` does not exist in Safari. The fallback is not optional. */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1200 });
  else setTimeout(fn, 1);
}
