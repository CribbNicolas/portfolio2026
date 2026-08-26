/**
 * The background field. WebGL by hand, WITHOUT three.
 *
 * Two triangles and a fragment shader: pulling in a scene library for this
 * would be paying 150 KB for one `drawArrays`. The whole chunk lands at ~2 KB.
 *
 * Honesty about what it is: it derives from no data and would look identical
 * with an empty dataset. It is here as the visual signature of the hero, not as
 * information. The map is the part that proves something.
 */

import { frameMeter } from "./capability";
import type { LabScene } from "./types";

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// A field of superposed waves. No procedural noise and no fbm: full screen,
// that is fill rate a mid-range phone cannot pay for.
const FS = `#version 300 es
precision mediump float;
uniform vec2 res; uniform float t; uniform vec2 pointer;
uniform vec3 cBackground; uniform vec3 cLine; uniform vec3 cAccent;
out vec4 color;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  uv += pointer * 0.06;

  float wave = 0.0;
  wave += sin(uv.x * 3.1 + t * 0.22) * 0.5;
  wave += sin(uv.x * 5.7 - t * 0.15 + uv.y * 1.3) * 0.28;
  wave += sin(uv.x * 9.3 + t * 0.09) * 0.12;

  // Bands: the distance to the crest defines the line. No textures.
  float d = abs(uv.y * 2.6 - wave);
  float band = fract(d * 2.2);
  float line = smoothstep(0.06, 0.0, min(band, 1.0 - band));

  float halo = smoothstep(0.9, 0.0, length(uv - vec2(-0.35, 0.15)));
  // Deliberately low: the map is drawn transparent on top, so these lines share
  // the screen with the graph edges. If they carry the same weight, the eye
  // does not know which of the two it is reading.
  vec3 c = mix(cBackground, cLine, line * 0.3);
  c = mix(c, cAccent, halo * 0.06 + line * halo * 0.1);
  color = vec4(c, 1.0);
}`;

export async function mountField(canvas: HTMLCanvasElement): Promise<LabScene | null> {
  const ctx = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power",
  });
  if (!ctx) return null;
  // Re-declared with a non-nullable type: `shutDown()` is a closure, and there
  // TS loses the narrowing from the `if` above.
  const gl: WebGL2RenderingContext = ctx;

  const compile = (kind: number, src: string): WebGLShader | null => {
    const s = gl.createShader(kind);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, "res"),
    t: gl.getUniformLocation(prog, "t"),
    pointer: gl.getUniformLocation(prog, "pointer"),
    cBackground: gl.getUniformLocation(prog, "cBackground"),
    cLine: gl.getUniformLocation(prog, "cLine"),
    cAccent: gl.getUniformLocation(prog, "cAccent"),
  };

  /** Colors come from the tokens. Dark mode comes for free. */
  const rgb = (name: string): [number, number, number] => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) return [0.5, 0.5, 0.5];
    const n = parseInt(m[1]!, 16);
    // sRGB → linear, approximated with gamma 2.2: without it the colors wash out.
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
      .map((c) => Math.pow(c, 2.2)) as [number, number, number];
  };

  const uploadColors = () => {
    gl.uniform3fv(u.cBackground, rgb("--fondo-elevado"));
    gl.uniform3fv(u.cLine, rgb("--line"));
    gl.uniform3fv(u.cAccent, rgb("--acento"));
  };
  uploadColors();

  // dpr capped at 1.5 and not 2: what is expensive here is full-screen fill
  // rate, i.e. pixels per frame. Lowering the dpr is the lever that pays most.
  let dpr = Math.min(devicePixelRatio, 1.5);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let px = 0, py = 0, tx = 0, ty = 0;
  const onMove = (e: PointerEvent) => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", onMove, { passive: true });

  const measure = frameMeter();
  let alive = true, visible = true, rafId = 0, t0 = 0;
  let degraded = false;

  const frame = (now: number) => {
    rafId = 0;
    if (!alive || !visible) return;
    if (t0 === 0) t0 = now;

    const verdict = measure(now);
    if (verdict === false) {
      // Before shutting down, one attempt at half resolution: on many phones
      // that is enough and the animation survives.
      if (!degraded && dpr > 1) { degraded = true; dpr = 1; resize(); }
      else { shutDown(); return; }
    }

    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    gl.uniform1f(u.t, (now - t0) / 1000);
    gl.uniform2f(u.pointer, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  };

  const onVisibilityChange = () => {
    visible = !document.hidden;
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
    else if (!visible && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const io = new IntersectionObserver((xs) => {
    visible = xs.some((x) => x.isIntersecting) && !document.hidden;
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
    else if (!visible && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  });
  io.observe(canvas);

  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onThemeChange = () => uploadColors();
  mq.addEventListener("change", onThemeChange);

  const onContextLost = (e: Event) => { e.preventDefault(); shutDown(); };
  canvas.addEventListener("webglcontextlost", onContextLost);

  function shutDown(): void {
    if (!alive) return;
    alive = false;
    if (rafId) cancelAnimationFrame(rafId);
    canvas.classList.remove("lab__campo--activo");
    removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    mq.removeEventListener("change", onThemeChange);
    io.disconnect();
    ro.disconnect();
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }

  canvas.classList.add("lab__campo--activo");
  rafId = requestAnimationFrame(frame);
  return { destroy: shutDown };
}
