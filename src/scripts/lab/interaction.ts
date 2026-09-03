/**
 * Map interaction: drag to rotate, neighbourhood focus, tooltip.
 *
 * The constraint that organizes this entire file: **the canvas never receives
 * pointer events**. It stays at `pointer-events: none`; the container is what
 * listens. That allows clicking nodes without the map keeping the clicks that
 * are not its own, and makes capturing the scroll impossible by construction.
 *
 * Scrolling stays in the browser's hands: there is not a single
 * `preventDefault` here for the pointer, and on touch it is arbitrated by
 * `touch-action: pan-y` (a vertical swipe scrolls the page, a horizontal one
 * rotates the map). That is the browser deciding, not us intercepting — which
 * is the difference between this and the scroll hijacking spec §3.4 forbids.
 */

import type { LabData, LabNode, LabStrings } from "./types";

/** Threshold in px separating a click from a drag. */
const DRAG_THRESHOLD = 5;
/** How much inertia is kept per frame. 0.94 ≈ two seconds of spin. */
const INERTIA = 0.94;
/** Below this the inertia counts as finished and the loop may sleep. */
const MIN_INERTIA = 0.00002;
/** Pointer capture radius, in screen px. */
const CLICK_RADIUS = 26;

export interface Camera {
  /** Accumulated rotation. Written by the drag, read by the render loop. */
  yaw: number;
  pitch: number;
}

export interface InteractionState {
  camera: Camera;
  /** Node under the pointer, or null. */
  hover: string | null;
  /** Node focused by a click, or null. */
  focus: string | null;
  /** The focus and its direct neighbours. Empty when there is no focus. */
  neighbourhood: Set<string>;
  /** true while the user drags: hover is suspended. */
  dragging: boolean;
}

interface Options {
  container: HTMLElement;
  data: LabData;
  panel: HTMLElement | null;
  tooltip: HTMLElement | null;
  /** Projects a node to screen coordinates. Provided by the renderer. */
  project: (n: LabNode) => { x: number; y: number } | null;
  /** Requests a frame. */
  wake: () => void;
}

export interface Interaction {
  state: InteractionState;
  /** Applies the inertia. Returns true while it is still moving. */
  advance(): boolean;
  /** Recomputes the node under the pointer. Called by the loop after moving the camera. */
  updateHover(): void;
  /** Focuses a node from outside (the DOM list, with a keyboard). */
  focusNode(id: string | null): void;
  destroy(): void;
}

export function createInteraction({
  container, data, panel, tooltip, project, wake,
}: Options): Interaction {
  const byId = new Map(data.nodes.map((n) => [n.i, n]));

  // Adjacency: derived from the edges that already travelled. Sending it
  // separately would duplicate data in the HTML.
  const neighbours = new Map<string, Set<string>>();
  for (const n of data.nodes) neighbours.set(n.i, new Set());
  for (const e of data.edges) {
    neighbours.get(e.s)?.add(e.t);
    neighbours.get(e.t)?.add(e.s);
  }

  const state: InteractionState = {
    camera: { yaw: 0.72, pitch: -0.52 },
    hover: null,
    focus: null,
    neighbourhood: new Set(),
    dragging: false,
  };

  let pointerX = -1e9;
  let pointerY = -1e9;
  let yawVel = 0;
  let pitchVel = 0;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;
  let travelled = 0;

  // --- Arrastre -----------------------------------------------------------

  const onDown = (e: PointerEvent) => {
    // Primary button only: the secondary one opens the context menu and is not ours.
    if (e.button !== 0) return;
    // The canvas is `pointer-events: none`, so the drag hits the SVG underneath
    // and the browser starts selecting labels. CSS `user-select: none` is the
    // real fix; this clears a selection that already started.
    getSelection()?.removeAllRanges();
    pointerId = e.pointerId;
    startX = prevX = e.clientX;
    startY = prevY = e.clientY;
    travelled = 0;
    yawVel = pitchVel = 0;
    state.dragging = false;
  };

  const onMove = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    pointerX = e.clientX - r.left;
    pointerY = e.clientY - r.top;

    if (pointerId === e.pointerId) {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      travelled += Math.abs(dx) + Math.abs(dy);

      // Only here does it count as a drag. Below the threshold it is still a
      // click in waiting, so a shaky hand does not cancel the click.
      if (!state.dragging && travelled > DRAG_THRESHOLD) {
        state.dragging = true;
        container.classList.add("lab__map--dragging");
        // Capturing the pointer keeps the drag working even when the cursor
        // leaves the map. Released on pointer up.
        try { container.setPointerCapture(e.pointerId); } catch { /* not critical */ }
      }

      if (state.dragging) {
        yawVel = -dx * 0.006;
        pitchVel = -dy * 0.006;
        state.camera.yaw += yawVel;
        state.camera.pitch += pitchVel;
        clampPitch();
      }
    }

    wake();
  };

  const onUp = (e: PointerEvent) => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    try { container.releasePointerCapture(e.pointerId); } catch { /* already released */ }

    if (state.dragging) {
      state.dragging = false;
      container.classList.remove("lab__map--dragging");
      wake();
      return;
    }

    // There was no drag: it is a click. It only acts when it landed on a node;
    // otherwise it clears the focus — which is what clicking empty space should do.
    const total = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    if (total <= DRAG_THRESHOLD) focusNode(nodeUnderPointer());
    wake();
  };

  const onCancel = () => {
    pointerId = null;
    state.dragging = false;
    container.classList.remove("lab__map--dragging");
  };

  const onLeave = () => {
    pointerX = pointerY = -1e9;
    state.hover = null;
    hideTooltip();
    container.classList.remove("lab__map--on-node");
    wake();
  };

  function clampPitch(): void {
    // With no cap, crossing the pole flips the scene and north is lost.
    const cap = Math.PI / 2 - 0.12;
    state.camera.pitch = Math.max(-cap, Math.min(cap, state.camera.pitch));
  }

  container.addEventListener("pointerdown", onDown);
  container.addEventListener("pointermove", onMove, { passive: true });
  container.addEventListener("pointerup", onUp);
  container.addEventListener("pointercancel", onCancel);
  container.addEventListener("pointerleave", onLeave);

  // --- Keyboard -----------------------------------------------------------
  // The map is `tabindex=0`: you can tab to it and rotate it with the arrows.
  // Without this the whole interaction is out of reach for anyone not using a
  // mouse.
  const onKey = (e: KeyboardEvent) => {
    const step = 0.12;
    switch (e.key) {
      case "ArrowLeft": state.camera.yaw -= step; break;
      case "ArrowRight": state.camera.yaw += step; break;
      case "ArrowUp": state.camera.pitch -= step; break;
      case "ArrowDown": state.camera.pitch += step; break;
      case "Escape": focusNode(null); break;
      default: return;
    }
    // Only here: arrows over a focused element scroll the page, and the user
    // already declared their intent by tabbing to the map.
    e.preventDefault();
    clampPitch();
    wake();
  };
  container.addEventListener("keydown", onKey);

  // --- Hit test and hover -------------------------------------------------

  function nodeUnderPointer(): string | null {
    if (pointerX < -1e8) return null;
    let best: string | null = null;
    let bestD = CLICK_RADIUS;
    for (const n of data.nodes) {
      const p = project(n);
      if (!p) continue;
      const d = Math.hypot(p.x - pointerX, p.y - pointerY);
      if (d < bestD) { bestD = d; best = n.i; }
    }
    return best;
  }

  function updateHover(): void {
    // During a drag the hover distracts, and it changes with every pixel.
    const id = state.dragging ? null : nodeUnderPointer();
    if (id === state.hover) {
      if (id) moveTooltip();
      return;
    }
    state.hover = id;
    // `cursor: pointer` is the only signal that the node is clickable.
    container.classList.toggle("lab__map--on-node", id !== null);
    if (id) showTooltip(id);
    else hideTooltip();
  }

  // --- Tooltip ------------------------------------------------------------

  function showTooltip(id: string): void {
    if (!tooltip) return;
    const n = byId.get(id);
    if (!n) return;

    // If the name is already drawn next to the node, a tooltip with the same
    // text is noise. Skills without a sticky label still get the tooltip.
    const alreadyLabelled = labelVisible(id);
    if (alreadyLabelled) { hideTooltip(); return; }

    tooltip.textContent = n.k === "achievement" ? n.t : n.n;
    tooltip.classList.add("lab__tooltip--visible");
    moveTooltip();
  }

  /** The renderer switches off overlapping labels; that decision is honoured here. */
  function labelVisible(id: string): boolean {
    const el = document.querySelector<HTMLElement>(`[data-lab-label][data-node="${CSS.escape(id)}"]`);
    return el !== null && parseFloat(el.style.opacity || "0") > 0.05;
  }

  function moveTooltip(): void {
    if (!tooltip) return;
    // Flipped against the right edge so it does not leave the map.
    const width = tooltip.offsetWidth;
    const x = pointerX + width + 28 > container.clientWidth ? pointerX - width - 14 : pointerX + 14;
    tooltip.style.transform = `translate3d(${x.toFixed(0)}px, ${(pointerY + 14).toFixed(0)}px, 0)`;
  }

  function hideTooltip(): void {
    tooltip?.classList.remove("lab__tooltip--visible");
  }

  // --- Focus --------------------------------------------------------------

  function focusNode(id: string | null): void {
    // Clicking the same node again leaves the focus.
    const next = id && id === state.focus ? null : id;
    state.focus = next;
    state.neighbourhood = new Set();

    if (next) {
      state.neighbourhood.add(next);
      for (const v of neighbours.get(next) ?? []) state.neighbourhood.add(v);
    }

    container.classList.toggle("lab__map--focused", next !== null);
    paintPanel(next);
    markList(next);
    wake();
  }

  /** The panel is DOM: real text, selectable and read by screen readers. */
  function paintPanel(id: string | null): void {
    if (!panel) return;
    if (!id) {
      panel.classList.remove("lab__panel--visible");
      panel.replaceChildren();
      return;
    }
    const n = byId.get(id);
    if (!n) return;

    const connected = [...(neighbours.get(id) ?? [])]
      .map((v) => byId.get(v))
      .filter((v): v is LabNode => v !== undefined)
      .sort((a, b) => b.d - a.d);

    const h = document.createElement("h4");
    h.className = "lab__panel-heading";
    h.textContent = n.n;

    const meta = document.createElement("p");
    meta.className = "lab__panel-meta";
    const [connSingular, connPlural] = data.strings.connection;
    meta.textContent = [data.strings.kind[n.k], n.c, `${n.d} ${n.d === 1 ? connSingular : connPlural}`]
      .filter(Boolean).join(" · ");

    const children: HTMLElement[] = [h, meta];

    // A skill's detail is its own name: repeating it says nothing.
    if (n.t !== n.n) {
      const body = document.createElement("p");
      body.className = "lab__panel-text";
      body.textContent = n.t;
      children.push(body);
    }

    // Achievements are NOT chips: they are sentences. Putting them in the same
    // list as "React" produced three-line tiles and a half-screen panel.
    const achievements = connected.filter((v) => v.k === "achievement");
    const rest = connected.filter((v) => v.k !== "achievement");

    if (achievements.length) children.push(achievementGroup(achievements, data.strings));
    if (rest.length) children.push(chipGroup(rest));

    panel.replaceChildren(...children);
    panel.classList.add("lab__panel--visible");
  }

  /** Focus from the map also marks the list, and the other way around. */
  function markList(id: string | null): void {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-node]"))) {
      el.classList.toggle("lab__item--focused", el.dataset.node === id);
    }
  }

  return {
    state,
    advance() {
      if (state.dragging || (Math.abs(yawVel) < MIN_INERTIA && Math.abs(pitchVel) < MIN_INERTIA)) {
        yawVel = pitchVel = 0;
        return false;
      }
      yawVel *= INERTIA;
      pitchVel *= INERTIA;
      state.camera.yaw += yawVel;
      state.camera.pitch += pitchVel;
      clampPitch();
      return true;
    },
    updateHover,
    focusNode,
    destroy() {
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onCancel);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("keydown", onKey);
      container.classList.remove(
        "lab__map--dragging", "lab__map--on-node", "lab__map--focused",
      );
      hideTooltip();
      paintPanel(null);
      markList(null);
    },
  };
}

/**
 * How many achievements fit before the panel stops being a panel.
 *
 * Two and not three: with three, the third was cut mid-sentence against the
 * height cap. A cut sentence reads as a bug; "+2 más" reads as a decision.
 */
const MAX_ACHIEVEMENTS = 2;

function achievementGroup(achievements: LabNode[], strings: LabStrings): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "lab__panel-group";

  const [achSingular, achPlural] = strings.achievement;
  const heading = document.createElement("p");
  heading.className = "lab__panel-subtitle";
  heading.textContent = achievements.length === 1 ? achSingular : `${achPlural} (${achievements.length})`;
  wrapper.append(heading);

  const list = document.createElement("ul");
  list.className = "lab__panel-achievements";
  for (const l of achievements.slice(0, MAX_ACHIEVEMENTS)) {
    const li = document.createElement("li");
    // The text goes in whole: `Prose.short` is already written to be short, and
    // trimming it here would break the intent (invariant 6).
    li.textContent = l.t;
    list.append(li);
  }
  wrapper.append(list);

  if (achievements.length > MAX_ACHIEVEMENTS) {
    const more = document.createElement("p");
    more.className = "lab__panel-more";
    more.textContent = strings.more.replace("{n}", String(achievements.length - MAX_ACHIEVEMENTS));
    wrapper.append(more);
  }
  return wrapper;
}

function chipGroup(nodes: LabNode[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "lab__panel-group";

  const list = document.createElement("ul");
  list.className = "lab__panel-list";
  for (const v of nodes.slice(0, 12)) {
    const li = document.createElement("li");
    li.textContent = v.n;
    li.className = `lab__panel-chip lab__panel-chip--${v.k}`;
    list.append(li);
  }
  if (nodes.length > 12) {
    const li = document.createElement("li");
    li.className = "lab__panel-chip lab__panel-chip--rest";
    li.textContent = `+${nodes.length - 12}`;
    list.append(li);
  }
  wrapper.append(list);
  return wrapper;
}
