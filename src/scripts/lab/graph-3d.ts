/**
 * The map in WebGL. The ONLY file in the project importing `three`.
 *
 * The whole scene is 2 draw calls: one `InstancedMesh` with every node and one
 * `LineSegments` with every edge. The cost is the library, not the render.
 *
 * What is NOT imported, and why:
 * - `OrbitControls`: registers `wheel` and calls `preventDefault`. That is
 *   scroll hijacking, forbidden by spec §3.4. Rejected on behaviour.
 * - postprocessing / `EffectComposer`: full-screen render targets per frame. On
 *   a mid-range phone that is pure fill rate.
 * - `Raycaster`: the hit test is done by projecting to NDC, which has to be
 *   computed anyway to place the tooltip. Importing it would be paying twice.
 * - any `TextGeometry` / font atlas: the text lives in the SVG and in the DOM
 *   tooltip. Crisp, selectable and accessible.
 */

import {
  WebGLRenderer, Scene, PerspectiveCamera,
  BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, CircleGeometry, MeshBasicMaterial,
  LineSegments, LineBasicMaterial,
  Color, Matrix4, Vector3,
} from "three";

import { frameMeter } from "./capability";
import { createInteraction } from "./interaction";
import type { LabData, LabNode, LabScene } from "./types";
import type { HoverBus } from "./hover-bus";

/**
 * Base radii. Larger than the SVG's on purpose: in the SVG a node leans on
 * labels and a crisp outline, and here it competes with the fog.
 */
const RADIUS: Record<string, number> = { role: 17, project: 14, skill: 10, achievement: 9 };
/** How far the camera orbits with the cursor. ±8°: noticeable without nausea. */
const ORBIT = 0.14;

/** Opacity of everything OUTSIDE the focused neighbourhood. */
const DIMMED = 0.12;

interface Options {
  canvas: HTMLCanvasElement;
  data: LabData;
  bus: HoverBus;
  tooltip: HTMLElement | null;
  panel: HTMLElement | null;
  /** Role and project labels, server-rendered. Positioned every frame. */
  labels: HTMLElement[];
}

export async function mountGraph({ canvas, data, bus, tooltip, panel, labels }: Options): Promise<LabScene | null> {
  let renderer: WebGLRenderer;
  try {
    // `antialias` only with a fine pointer: on a phone it is the first cost
    // worth skipping, and the frame meter verifies it anyway.
    const finePointer = matchMedia("(pointer: fine)").matches;
    renderer = new WebGLRenderer({ canvas, antialias: finePointer, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }

  const container = canvas.parentElement ?? canvas;
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 1, 6000);

  // Colors come from the tokens: zero hex in JS, and dark mode comes for free
  // because `tokens.css` already resolves it by media query.
  const readColors = () => {
    const css = getComputedStyle(document.documentElement);
    const c = (n: string) => new Color().setStyle(css.getPropertyValue(n).trim() || "#888");
    return {
      accent: c("--accent"), ink: c("--ink"), soft: c("--ink-soft"),
      line: c("--line"), background: c("--background-elevado"),
    };
  };
  let colors = readColors();

  /**
   * Four kinds with ONE accent (spec §4). The kind is told apart by size and by
   * value — how dark it is — not by hue: that way it survives in black and
   * white, which is criterion 2 of §5. The accent stays reserved for the
   * achievements, which are the evidence.
   *
   * Skills are lightened by mixing with the background instead of hard-coding a
   * grey: the color still comes from the tokens and dark mode still works.
   */
  const colorFor = (kind: string, degree: number): Color => {
    if (degree === 0) return colors.soft.clone().lerp(colors.background, 0.45);
    if (kind === "achievement") return colors.accent;
    if (kind === "role") return colors.ink;
    if (kind === "project") return colors.soft;
    return colors.soft.clone().lerp(colors.background, 0.25);
  };

  // --- Nodos: 1 draw call --------------------------------------------------
  const nodes = data.nodes;
  // 20 segments: at 12 the polygon shows at these radii. 20 is where the flat
  // edge stops being visible and it is still 740 triangles in total.
  const nodeGeo = new CircleGeometry(1, 20);

  /**
   * Fog through ALPHA, not through color.
   *
   * `Fog` blends the fragment toward a color, and with a transparent panel that
   * color does not exist: a distant node would end up a solid pale disc instead
   * of letting the field show through. The right behaviour is fading to nothing.
   *
   * `MeshBasicMaterial` has no per-instance opacity, so an instanced attribute
   * is injected into the shader. That is ~10 lines against writing a whole
   * `ShaderMaterial` and losing everything three already solves.
   */
  const alphas = new InstancedBufferAttribute(new Float32Array(nodes.length).fill(1), 1);
  const nodeMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  nodeMat.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float instanceAlpha;\nvarying float vAlpha;\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vAlpha = instanceAlpha;");
    shader.fragmentShader = `varying float vAlpha;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= vAlpha;");
  };

  const mesh = new InstancedMesh(nodeGeo, nodeMat, nodes.length);
  mesh.geometry.setAttribute("instanceAlpha", alphas);
  // Edges go below; nodes on top.
  mesh.renderOrder = 1;
  const m4 = new Matrix4();

  // Billboarding: the discs have to FACE the camera. Without this they are flat
  // in space and, while orbiting, read as squashed ellipses rather than nodes.
  const instPos = new Vector3();
  const instScale = new Vector3();
  const order = nodes.map((_, i) => i);
  const distances = new Float32Array(nodes.length);

  /**
   * Writes matrix, color and alpha for the 37 instances, back to front.
   *
   * Order matters because of alpha: with `depthWrite: false` blending depends on
   * draw order, and the draw order of an `InstancedMesh` is the buffer order. If
   * a near node were drawn first, the ones behind would blend on top. Sorting 37
   * indices per frame is not measurable.
   */
  const writeInstances = () => {
    const { hover, focus, neighbourhood } = interaction.state;
    const hasFocus = focus !== null;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      distances[i] = camera.position.distanceTo(instPos.set(n.x, n.y, n.z));
    }
    order.sort((a, b) => distances[b]! - distances[a]!);

    for (let slot = 0; slot < order.length; slot++) {
      const i = order[slot]!;
      const n = nodes[i]!;
      const isFocus = focus === n.i;
      const highlight = isFocus || hover === n.i;
      // With focus active, everything outside the neighbourhood dims. That is
      // what turns the graph into an answer: "this is what backs X up".
      const dimmed = hasFocus && !neighbourhood.has(n.i);

      // `n.r` comes from the build: 1 except on skills, where it encodes years
      // of use × connections. The per-kind radius stays a base, not an answer.
      const base = (RADIUS[n.k] ?? 5) * n.r;
      const r = base * (isFocus ? 2.1 : highlight ? 1.6 : 1);
      instPos.set(n.x, n.y, n.z);
      instScale.set(r, r, r);
      m4.compose(instPos, camera.quaternion, instScale);
      mesh.setMatrixAt(slot, m4);

      mesh.setColorAt(slot, highlight ? colors.accent : colorFor(n.k, n.d));
      // Distant things fade to transparent and let the field show. What is
      // pointed at never fades: if you are looking at it, it has to be visible.
      alphas.array[slot] = highlight ? 1 : fade(distances[i]!) * (dimmed ? DIMMED : 1);
    }

    mesh.instanceMatrix.needsUpdate = true;
    alphas.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  scene.add(mesh);

  // --- Aristas: 1 draw call ------------------------------------------------
  const index = new Map(nodes.map((n, i) => [n.i, i]));
  const positions: number[] = [];
  const endpoints: Array<[number, number, boolean]> = [];
  for (const e of data.edges) {
    const a = index.get(e.s);
    const b = index.get(e.t);
    if (a === undefined || b === undefined) continue;
    const A = nodes[a]!;
    const B = nodes[b]!;
    positions.push(A.x, A.y, A.z, B.x, B.y, B.z);
    endpoints.push([a, b, e.a]);
  }

  const edgeGeo = new BufferGeometry();
  edgeGeo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  // itemSize 4, not 3: with RGBA three enables USE_COLOR_ALPHA and every vertex
  // carries its own transparency. That is what lets an edge fade with depth
  // instead of being cut off.
  const edgeColors = new Float32BufferAttribute(new Float32Array(endpoints.length * 8), 4);
  edgeGeo.setAttribute("color", edgeColors);

  const lines = new LineSegments(
    edgeGeo,
    new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
  );
  lines.renderOrder = 0;
  scene.add(lines);

  /** Color and alpha per endpoint. The alpha comes from the nodes' own fog. */
  const writeEdges = () => {
    const { focus, neighbourhood } = interaction.state;
    const hasFocus = focus !== null;
    const arr = edgeColors.array as Float32Array;

    for (let e = 0; e < endpoints.length; e++) {
      const [a, b, affinity] = endpoints[e]!;
      // An edge belongs to the focus only if it TOUCHES the focused node. "Both
      // endpoints in the neighbourhood" would be enough to sneak in edges between
      // neighbours that do not pass through the focus, and the drawing would stop
      // answering the question.
      const ofFocus = hasFocus && (nodes[a]!.i === focus || nodes[b]!.i === focus);
      const dimmedEdge = hasFocus && !ofFocus;

      const c = ofFocus ? colors.accent : affinity ? colors.accent : colors.line;
      // Affinity edges are the derived ones: more present, but never above the
      // structure declared in the dataset.
      const base = ofFocus ? 0.95 : affinity ? 0.6 : 0.4;

      for (const [k, nodeIdx] of [[0, a], [1, b]] as const) {
        const o = e * 8 + k * 4;
        arr[o] = c.r; arr[o + 1] = c.g; arr[o + 2] = c.b;
        arr[o + 3] = fade(distances[nodeIdx]!) * base * (dimmedEdge ? DIMMED : 1);
      }
    }
    edgeColors.needsUpdate = true;
  };

  // --- Camera and framing --------------------------------------------------
  // Framed on the ring, which is the real edge of the drawing. `layoutGraph`
  // normalizes the body to a fixed radius, so this number does not move as the
  // dataset grows.
  const dist = data.radius / Math.tan((42 * Math.PI) / 360) * 0.92;
  let width = 1, height = 1;

  /**
   * Depth fog, in alpha.
   *
   * It is THE thing separating a graph with volume from a cloud of points:
   * perspective alone is not enough to read what is behind. It goes on alpha and
   * not on color because the panel is transparent — blending toward a color
   * would leave solid pale discs covering the field.
   */
  const NEAR = dist - data.radius * 1.05;
  const FAR = dist + data.radius * 1.35;

  function fade(distance: number): number {
    const t = (distance - NEAR) / (FAR - NEAR);
    return Math.max(0.14, Math.min(1, 1 - t));
  }

  const resize = () => {
    const r = container.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
  };
  resize();
  // `ResizeObserver` and not `window.resize`: the container can change size
  // without the window doing so.
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // --- Interaction ---------------------------------------------------------
  // The canvas stays at `pointer-events: none`: the CONTAINER is what listens.
  // That is why the map can receive clicks without keeping the ones that are not
  // its own, and why it could not capture the scroll even if it tried.
  const vProj = new Vector3();
  const interaction = createInteraction({
    container,
    data,
    panel,
    tooltip,
    project: (n: LabNode) => {
      vProj.set(n.x, n.y, n.z).project(camera);
      if (vProj.z > 1) return null; // behind the camera
      return { x: (vProj.x * 0.5 + 0.5) * width, y: (-vProj.y * 0.5 + 0.5) * height };
    },
    wake: () => wake(),
  });

  // Slow autonomous spin while nobody touches anything. It is what hints the
  // map is three-dimensional before the user discovers they can drag it.
  const DRIFT = 0.0009;
  let interacted = false;

  const onScroll = () => wake();
  addEventListener("scroll", onScroll, { passive: true });

  // --- Labels in the DOM ---------------------------------------------------
  // They do not go in WebGL: a font atlas or `TextGeometry` would cost more than
  // the whole scene, and the text would come out blurry and unselectable. These
  // are 7 elements already present in the HTML; here they are only moved.
  const anchors = labels
    .map((el) => {
      const id = el.dataset.node;
      const node = nodes.find((n) => n.i === id);
      return node ? { el, node } : null;
    })
    .filter((x): x is { el: HTMLElement; node: (typeof nodes)[number] } => x !== null);

  // Measured widths: `offsetWidth` is exact and costs a single reflow, against
  // estimating by character count the way the SVG does.
  const widthOf = new Map<HTMLElement, number>();
  const measureWidths = () => {
    for (const { el } of anchors) widthOf.set(el, el.offsetWidth);
  };
  measureWidths();
  // If Manrope has not loaded yet, the first measurement is the fallback font's
  // and the boxes come out wrong. It re-measures once the typeface is ready.
  document.fonts?.ready.then(() => { measureWidths(); wake(); });

  const vLabel = new Vector3();
  const placeLabels = () => {
    // Overlap is resolved the same way as in the SVG: front to back, the nearest
    // keeps the label. Without this "Plugins de WordPress con tooling moderno"
    // covers "Dinkum Interactive". Since the loop sleeps once it converges, it
    // does not flicker at rest.
    const candidates = anchors
      .map(({ el, node }) => {
        vLabel.set(node.x, node.y, node.z);
        const distance = camera.position.distanceTo(vLabel);
        vLabel.project(camera);
        return {
          el, node, distance,
          behind: vLabel.z > 1,
          sx: (vLabel.x * 0.5 + 0.5) * width,
          sy: (-vLabel.y * 0.5 + 0.5) * height,
        };
      })
      // Roles win the label on a tie for space, even when a project is nearer:
      // there are four of them and they organize how the map reads. Losing
      // "Dinkum Interactive" because a project's long name passed in front of it
      // is losing the most important thing first.
      .sort((a, b) =>
        (a.node.k === "role" ? 0 : 1) - (b.node.k === "role" ? 0 : 1) ||
        a.distance - b.distance,
      );

    const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

    for (const c of candidates) {
      // Behind the camera: `project` returns mirrored, meaningless coordinates.
      if (c.behind) { c.el.style.opacity = "0"; continue; }

      const y = c.sy - RADIUS[c.node.k]! - 14;
      const w = widthOf.get(c.el) ?? 80;
      // The box is taller than the text on purpose: two labels on nearly
      // adjacent lines do not "collide" geometrically but read as one.
      const box = { x1: c.sx - w / 2 - 10, x2: c.sx + w / 2 + 10, y1: y - 22, y2: y + 16 };

      if (placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)) {
        c.el.style.opacity = "0";
        continue;
      }
      placed.push(box);

      // Opacity follows the same fog as the scene, so the text does not float
      // crisp over a node that is fading out.
      const t = (c.distance - (dist - data.radius * 1.15)) / (data.radius * 2.65);
      c.el.style.opacity = Math.max(0.2, Math.min(1, 1 - t)).toFixed(2);
      c.el.style.transform = `translate3d(${c.sx.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
    }
  };

  // Canvas hover is published to the bus so the DOM list reflects it; the bus
  // deduplicates, so this does not create a loop with the reverse direction.
  const releaseBus = bus.onChange((id, source) => {
    // Hover arriving FROM the list: highlight yes, focus no. Focusing is a
    // decision and requires a click.
    if (source === "dom") wake();
  });

  // --- A loop that switches itself off -------------------------------------
  // A still map draws 0 frames per second. It is the largest battery win in all
  // of this, more than any shader optimization.
  const measure = frameMeter();
  let alive = true;
  let visible = true;
  let rafId = 0;
  let still = false;

  const frame = (now: number) => {
    rafId = 0;
    if (!alive || !visible) return;

    const verdict = measure(now);
    if (verdict === false) { shutDown(); return; }

    // Drag inertia, and slow drift until the user touches something.
    const withInertia = interaction.advance();
    if (!interacted && !interaction.state.dragging) {
      if (withInertia || interaction.state.focus || interaction.state.hover) interacted = true;
      else interaction.state.camera.yaw += DRIFT;
    }

    const rx = interaction.state.camera.pitch;
    const ry = interaction.state.camera.yaw;
    camera.position.set(
      Math.sin(ry) * Math.cos(rx) * dist,
      Math.sin(rx) * dist,
      Math.cos(ry) * Math.cos(rx) * dist,
    );
    camera.lookAt(0, 0, 0);
    // `lookAt` writes the quaternion, but `matrixWorldInverse` — the ONLY thing
    // `Vector3.project` uses — is only recomputed inside `renderer.render()`.
    // Without this line the hit test and the labels project with the previous
    // frame's view while the canvas already drew with the new one. Since
    // `pointermove` does not deliver the same delta every frame, that offset
    // changes size frame to frame: the labels shiver over the nodes.
    camera.updateMatrixWorld();

    // Hover is recomputed AFTER moving the camera: otherwise the hit test uses
    // the previous frame's projection and the node under the cursor lags by one
    // frame. It shows while dragging.
    interaction.updateHover();
    if (interaction.state.hover !== bus.current()) {
      bus.activate(interaction.state.hover, "canvas");
    }

    // Everything is rewritten per frame: the billboard depends on camera
    // orientation and draw order depends on depth. That is 37 `compose` calls
    // and a sort of 37: irrelevant next to the render.
    writeInstances();
    writeEdges();
    placeLabels();
    renderer.render(scene, camera);

    // The loop stops when nothing is moving any more. While measuring
    // (verdict === null) it never sleeps, or the measurement never finishes.
    still = verdict !== null && !withInertia && !interaction.state.dragging && interacted;
    if (!still) rafId = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!alive || !visible || rafId) return;
    still = false;
    rafId = requestAnimationFrame(frame);
  };

  const onVisibilityChange = () => {
    visible = !document.hidden;
    if (visible) wake();
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const visibilityIo = new IntersectionObserver((xs) => {
    visible = xs.some((x) => x.isIntersecting) && !document.hidden;
    if (visible) wake();
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  });
  visibilityIo.observe(container);

  const themeMq = matchMedia("(prefers-color-scheme: dark)");
  const onThemeChange = () => {
    colors = readColors();
    wake(); // the frame rewrites colors and alphas with the new palette
  };
  themeMq.addEventListener("change", onThemeChange);

  const onContextLost = (e: Event) => { e.preventDefault(); shutDown(); };
  canvas.addEventListener("webglcontextlost", onContextLost);

  function shutDown(): void {
    if (!alive) return;
    alive = false;
    if (rafId) cancelAnimationFrame(rafId);
    // The SVG was never removed from the DOM: reverting is dropping a class.
    container.classList.remove("lab__mapa--3d");
    interaction.destroy();
    removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    themeMq.removeEventListener("change", onThemeChange);
    visibilityIo.disconnect();
    ro.disconnect();
    releaseBus();
    nodeGeo.dispose();
    nodeMat.dispose();
    edgeGeo.dispose();
    lines.material.dispose();
    mesh.dispose();
    renderer.dispose();
  }

  // Only here is the SVG hidden: the camera starts in the same pose the server
  // projection used, so there is no visual jump.
  container.classList.add("lab__mapa--3d");
  wake();

  return { destroy: shutDown, focusNode: interaction.focusNode };
}
