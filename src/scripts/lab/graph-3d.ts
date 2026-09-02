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
 *   a mid-range phone that is pure fill rate. Roundness is Phong + fresnel on
 *   the same draw call, not a bloom pass.
 * - `Raycaster`: the hit test is done by projecting to NDC, which has to be
 *   computed anyway to place the tooltip. Importing it would be paying twice.
 * - any `TextGeometry` / font atlas: the text lives in the SVG and in the DOM
 *   tooltip. Crisp, selectable and accessible.
 */

import {
  WebGLRenderer, Scene, PerspectiveCamera,
  BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, SphereGeometry, MeshPhongMaterial,
  LineSegments, LineBasicMaterial,
  HemisphereLight, DirectionalLight,
  ACESFilmicToneMapping,
  Color, Matrix4, Vector3, Quaternion,
} from "three";

import { frameMeter } from "./capability";
import { createInteraction } from "./interaction";
import type { LabData, LabNode, LabScene } from "./types";
import type { HoverBus } from "./hover-bus";
import { isStickyMapLabel } from "../../lib/map-labels";

/**
 * Base radii. Larger than the SVG's on purpose: in the SVG a node leans on
 * labels and a crisp outline, and here it competes with the fog.
 */
const RADIUS: Record<string, number> = { role: 17, project: 14, skill: 10, achievement: 9 };
/** Opacity of everything OUTSIDE the focused neighbourhood. */
const DIMMED = 0.12;

interface Options {
  canvas: HTMLCanvasElement;
  data: LabData;
  bus: HoverBus;
  tooltip: HTMLElement | null;
  panel: HTMLElement | null;
  /** Role, project and sticky-skill labels, server-rendered. Positioned every frame. */
  labels: HTMLElement[];
}

export async function mountGraph({ canvas, data, bus, tooltip, panel, labels }: Options): Promise<LabScene | null> {
  let renderer: WebGLRenderer;
  try {
    // `antialias` only with a fine pointer: on a phone it is the first cost
    // worth skipping, and the frame meter verifies it anyway.
    const finePointer = matchMedia("(pointer: fine)").matches;
    renderer = new WebGLRenderer({ canvas, antialias: finePointer, alpha: true, powerPreference: "low-power" });
    // Built-in, not a pass: it costs a colour transform, not a full-screen target.
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  } catch {
    return null;
  }

  const container = canvas.parentElement ?? canvas;
  const scene = new Scene();
  // Wider than 42: the camera sits closer for the same framing, so near and
  // far nodes differ more in size. That is most of the "this is 3D" reading.
  const camera = new PerspectiveCamera(52, 1, 1, 6000);

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
   * Illumination has to be bright in both themes: it is light, not a fill.
   * The lighter of ink/background is white-ish in light mode and pale in dark.
   */
  const lampColor = () => {
    const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const base = lum(colors.background) > lum(colors.ink)
      ? colors.background.clone().lerp(colors.ink, 0.08)
      : colors.ink.clone().lerp(colors.background, 0.08);
    return base.lerp(colors.accent, 0.1);
  };

  const hemi = new HemisphereLight();
  const key = new DirectionalLight();
  let uAccent: { value: Color } | null = null;

  /**
   * Four kinds with ONE accent (spec §4). The kind is told apart by size and by
   * value — how dark it is — not by a second hue. Achievements keep the accent
   * pure (they are the evidence). Everyone else is ink mixed with a little
   * terracotta, so the "grays" are of this palette and not a cool UI chrome.
   * The same mixes live in `lab.css` for the SVG fallback.
   */
  const colorFor = (kind: string, degree: number): Color => {
    if (degree === 0) {
      return colors.soft.clone().lerp(colors.accent, 0.1).lerp(colors.background, 0.42);
    }
    if (kind === "achievement") return colors.accent;
    if (kind === "role") return colors.ink.clone().lerp(colors.accent, 0.1);
    if (kind === "project") return colors.soft.clone().lerp(colors.accent, 0.32);
    return colors.soft.clone().lerp(colors.accent, 0.2).lerp(colors.background, 0.12);
  };

  // --- Nodos: 1 draw call --------------------------------------------------
  const nodes = data.nodes;
  // Spheres, not billboarded discs. Phong (a specular hit) + a fresnel rim on
  // the same draw call is what makes them read round; Lambert was a sticker.
  // EffectComposer is rejected above: this is cheap and keeps the hierarchy
  // (size + accent) instead of blooming everything equally.
  const nodeGeo = new SphereGeometry(1, 24, 18);

  /**
   * Fog through ALPHA and occlusion, not through `Fog`.
   *
   * `Fog` blends the fragment toward a color, and with a transparent panel that
   * color does not exist: a distant node would end up a solid pale disc instead
   * of letting the field show through. Alpha still recedes the back of the
   * cloud; `depthWrite` is what stops two mid-opacity discs from blending into
   * a muddy blob — the nearer sphere hides the farther one.
   *
   * Per-instance opacity and a "lift" (focus / evidence) are injected into
   * Phong rather than writing a ShaderMaterial and losing lights.
   */
  const alphas = new InstancedBufferAttribute(new Float32Array(nodes.length).fill(1), 1);
  const lifts = new InstancedBufferAttribute(new Float32Array(nodes.length).fill(0), 1);
  const nodeMat = new MeshPhongMaterial({
    transparent: true,
    depthWrite: true,
    shininess: 18,
    specular: lampColor(),
  });
  nodeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uAccent = { value: colors.accent.clone() };
    uAccent = shader.uniforms.uAccent as { value: Color };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float instanceAlpha;\nattribute float instanceLift;\nvarying float vAlpha;\nvarying float vLift;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vAlpha = instanceAlpha;\n  vLift = instanceLift;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uAccent;\nvarying float vAlpha;\nvarying float vLift;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n  diffuseColor.a *= vAlpha;",
      )
      .replace(
        "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;",
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
  float ndv = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 2.6);
  outgoingLight += uAccent * fresnel * (0.07 + vLift * 0.22);
  outgoingLight += outgoingLight * vLift * 0.06;`,
      );
  };

  const placeLights = () => {
    const lamp = lampColor();
    // Sky vs ground stays in WORLD space (up is up). The key is attached to
    // the camera each frame: a world-fixed key made the highlight crawl
    // around every sphere while the graph spun, which read as the light
    // rotating with the map.
    hemi.color.copy(lamp);
    hemi.groundColor.copy(colors.background).lerp(colors.ink, 0.28);
    hemi.intensity = 0.88;
    key.color.copy(lamp);
    key.intensity = 1.05;
    nodeMat.specular.copy(lamp).lerp(colors.accent, 0.08);
    if (uAccent) uAccent.value.copy(colors.accent);
  };
  placeLights();
  scene.add(hemi, key);

  const keyRight = new Vector3();
  const keyUp = new Vector3();
  const aimKey = () => {
    // Slightly above-right of the view, not a dead headlamp.
    keyRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    keyUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    key.position.copy(camera.position)
      .addScaledVector(keyRight, dist * 0.16)
      .addScaledVector(keyUp, dist * 0.2);
  };

  const mesh = new InstancedMesh(nodeGeo, nodeMat, nodes.length);
  mesh.geometry.setAttribute("instanceAlpha", alphas);
  mesh.geometry.setAttribute("instanceLift", lifts);
  // Edges go below; nodes on top.
  mesh.renderOrder = 1;
  const m4 = new Matrix4();
  const noRot = new Quaternion();

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
      const depth = fade(distances[i]!);
      const base = (RADIUS[n.k] ?? 5) * n.r;
      // Far nodes shrink as well as fade: a large ghost sitting on a near
      // sphere is what used to read as overlap, not as depth.
      const r = base * (isFocus ? 2.1 : highlight ? 1.6 : 1) * (0.72 + 0.28 * depth);
      instPos.set(n.x, n.y, n.z);
      instScale.set(r, r, r);
      m4.compose(instPos, noRot, instScale);
      mesh.setMatrixAt(slot, m4);

      const tint = (highlight ? colors.accent : colorFor(n.k, n.d)).clone();
      if (!highlight) tint.lerp(colors.background, (1 - depth) * 0.38);
      mesh.setColorAt(slot, tint);
      // Front of the cloud stays nearly solid. The floor used to be 0.14, which
      // made every layer a veil and they stacked into mud.
      alphas.array[slot] = highlight ? 1 : Math.max(0.62, depth) * (dimmed ? DIMMED : 1);
      // Lift is the cheap substitute for bloom: only the thing you pointed at,
      // plus a whisper on achievements (the evidence) and roles (the crust).
      lifts.array[slot] = dimmed
        ? 0
        : isFocus ? 1 : highlight ? 0.55 : n.k === "achievement" ? 0.3 : n.k === "role" ? 0.12 : 0;
    }

    mesh.instanceMatrix.needsUpdate = true;
    alphas.needsUpdate = true;
    lifts.needsUpdate = true;
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
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      // Nodes write depth: an edge that passes behind a sphere disappears
      // instead of drawing on top of it. That is the other half of "this is 3D".
      depthTest: true,
    }),
  );
  lines.renderOrder = 0;
  scene.add(lines);

  /** Color and alpha per endpoint. The alpha comes from the nodes' own fog. */
  const writeEdges = () => {
    // Only `focus` is read here: an edge belongs to the focus when it TOUCHES
    // the focused node, which is stricter than "both endpoints in the
    // neighbourhood". The neighbourhood is what `writeInstances` uses.
    const { focus } = interaction.state;
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

      // Idle edges pick up a dust of accent so they are not a cool gray
      // against terracotta spheres. Full accent is still focus-only.
      const c = ofFocus ? colors.accent : colors.line.clone().lerp(colors.accent, 0.28);
      const base = ofFocus ? 0.95 : affinity ? 0.22 : 0.38;

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
  const dist = data.radius / Math.tan((52 * Math.PI) / 360) * 0.7;
  let width = 1, height = 1;

  /**
   * Depth fog, in alpha.
   *
   * The front of the cloud has to stay solid or every layer is a veil. Fade
   * only starts after the near third, and the floor is high enough that a far
   * node recedes without turning into a ghost that paints over what is in front.
   */
  const NEAR = dist - data.radius * 0.35;
  const FAR = dist + data.radius * 1.15;

  function fade(distance: number): number {
    const t = (distance - NEAR) / (FAR - NEAR);
    const clamped = Math.max(0, Math.min(1, t));
    return 1 - clamped * 0.4;
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

  // Slow autonomous spin. Pauses while the user drags, while inertia is still
  // running, and while the detail panel is open. After a quiet stretch it
  // starts again — otherwise the map dies the first time someone touches it.
  const DRIFT = 0.0009;
  const IDLE_RESUME_MS = 4000;
  let autoSpin = true;
  let idleTimer = 0;

  const armIdleSpin = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      idleTimer = 0;
      if (!alive || interaction.state.focus || interaction.state.dragging) return;
      autoSpin = true;
      wake();
    }, IDLE_RESUME_MS);
  };

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
    // Sticky names (workplaces, and skills as big as a workplace) are placed
    // first and never dropped for overlap. Projects still yield, or a long
    // title covers Dinkum. The loop sleeps once it converges, so it does not
    // flicker at rest.
    const focused = interaction.state.focus !== null;
    const candidates = anchors
      .map(({ el, node }) => {
        vLabel.set(node.x, node.y, node.z);
        const distance = camera.position.distanceTo(vLabel);
        vLabel.project(camera);
        const sticky = isStickyMapLabel({ kind: node.k, r: node.r });
        return {
          el, node, distance, sticky,
          behind: vLabel.z > 1,
          sx: (vLabel.x * 0.5 + 0.5) * width,
          sy: (-vLabel.y * 0.5 + 0.5) * height,
        };
      })
      .sort((a, b) =>
        Number(b.sticky) - Number(a.sticky) ||
        a.distance - b.distance,
      );

    const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

    for (const c of candidates) {
      // Behind the camera: `project` returns mirrored, meaningless coordinates.
      if (c.behind) { c.el.style.opacity = "0"; continue; }

      const y = c.sy - RADIUS[c.node.k]! * c.node.r - 14;
      const w = widthOf.get(c.el) ?? 80;
      const box = { x1: c.sx - w / 2 - 10, x2: c.sx + w / 2 + 10, y1: y - 22, y2: y + 16 };

      if (!c.sticky && placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)) {
        c.el.style.opacity = "0";
        continue;
      }
      placed.push(box);

      const t = (c.distance - (dist - data.radius * 0.45)) / (data.radius * 2.2);
      const fog = Math.max(0.12, Math.min(1, 1 - t));
      // Sticky names stay readable: workplaces (and the skills that match them
      // in size) do not vanish into the fog or when the panel is open.
      const opacity = c.sticky ? Math.max(0.9, fog) : focused ? fog * 0.28 : fog;
      c.el.style.opacity = opacity.toFixed(2);
      c.el.style.transform = `translate3d(${c.sx.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
    }
  };

  // Canvas hover is published to the bus so the DOM list reflects it; the bus
  // deduplicates, so this does not create a loop with the reverse direction.
  const releaseBus = bus.onChange((_id, source) => {
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

    const withInertia = interaction.advance();
    const busy =
      interaction.state.dragging ||
      withInertia ||
      interaction.state.focus !== null;

    if (busy) {
      autoSpin = false;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
    } else if (!autoSpin && idleTimer === 0) {
      armIdleSpin();
    }

    if (autoSpin) interaction.state.camera.yaw += DRIFT;

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
    aimKey();

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
    still = verdict !== null && !autoSpin && !busy;
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
    placeLights();
    wake(); // the frame rewrites colors and alphas with the new palette
  };
  themeMq.addEventListener("change", onThemeChange);

  const onContextLost = (e: Event) => { e.preventDefault(); shutDown(); };
  canvas.addEventListener("webglcontextlost", onContextLost);

  function shutDown(): void {
    if (!alive) return;
    alive = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
    // The SVG was never removed from the DOM: reverting is dropping a class.
    container.classList.remove("lab__map--3d");
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
  container.classList.add("lab__map--3d");
  wake();

  return { destroy: shutDown, focusNode: interaction.focusNode };
}
