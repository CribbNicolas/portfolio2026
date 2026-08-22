/**
 * El campo del fondo. WebGL a mano, SIN three.
 *
 * Son dos triángulos y un fragment shader: traer una librería de escena para
 * esto sería pagar 150 KB por un `drawArrays`. El chunk entero queda en ~2 KB.
 *
 * Honestidad sobre qué es: no deriva de ningún dato, se vería igual con el
 * dataset vacío. Está acá como firma visual del hero, no como información. El
 * mapa es el que prueba algo.
 */

import { medidorDeFrames } from "./capacidad";
import type { Escena } from "./types";

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// Campo de ondas superpuestas. Sin ruido procedural ni fbm: a pantalla completa
// eso es fill-rate que no se puede pagar en un celular de gama media.
const FS = `#version 300 es
precision mediump float;
uniform vec2 res; uniform float t; uniform vec2 puntero;
uniform vec3 cFondo; uniform vec3 cLinea; uniform vec3 cAcento;
out vec4 color;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  uv += puntero * 0.06;

  float onda = 0.0;
  onda += sin(uv.x * 3.1 + t * 0.22) * 0.5;
  onda += sin(uv.x * 5.7 - t * 0.15 + uv.y * 1.3) * 0.28;
  onda += sin(uv.x * 9.3 + t * 0.09) * 0.12;

  // Bandas: la distancia a la cresta define la línea. Sin texturas.
  float d = abs(uv.y * 2.6 - onda);
  float banda = fract(d * 2.2);
  float linea = smoothstep(0.06, 0.0, min(banda, 1.0 - banda));

  float halo = smoothstep(0.9, 0.0, length(uv - vec2(-0.35, 0.15)));
  // Bajo a propósito: el mapa se dibuja transparente encima, así que estas
  // líneas comparten pantalla con las aristas del grafo. Si pesan lo mismo, el
  // ojo no sabe cuál de las dos lee.
  vec3 c = mix(cFondo, cLinea, linea * 0.3);
  c = mix(c, cAcento, halo * 0.06 + linea * halo * 0.1);
  color = vec4(c, 1.0);
}`;

export async function montarCampo(canvas: HTMLCanvasElement): Promise<Escena | null> {
  const ctx = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power",
  });
  if (!ctx) return null;
  // Se re-declara con tipo no-nullable: `apagar()` es una closure y ahí TS
  // pierde el narrowing del `if` de arriba.
  const gl: WebGL2RenderingContext = ctx;

  const compilar = (tipo: number, src: string): WebGLShader | null => {
    const s = gl.createShader(tipo);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };

  const vs = compilar(gl.VERTEX_SHADER, VS);
  const fs = compilar(gl.FRAGMENT_SHADER, FS);
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
    puntero: gl.getUniformLocation(prog, "puntero"),
    cFondo: gl.getUniformLocation(prog, "cFondo"),
    cLinea: gl.getUniformLocation(prog, "cLinea"),
    cAcento: gl.getUniformLocation(prog, "cAcento"),
  };

  /** Los colores salen de los tokens. El modo oscuro sale gratis. */
  const rgb = (nombre: string): [number, number, number] => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) return [0.5, 0.5, 0.5];
    const n = parseInt(m[1]!, 16);
    // sRGB → lineal aproximado con gamma 2.2: sin esto los colores salen lavados.
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
      .map((c) => Math.pow(c, 2.2)) as [number, number, number];
  };

  const subirColores = () => {
    gl.uniform3fv(u.cFondo, rgb("--fondo-elevado"));
    gl.uniform3fv(u.cLinea, rgb("--linea"));
    gl.uniform3fv(u.cAcento, rgb("--acento"));
  };
  subirColores();

  // dpr tope 1.5 y no 2: acá lo caro es el fill rate a pantalla completa, o sea
  // píxeles por frame. Bajar el dpr es la palanca que más rinde.
  let dpr = Math.min(devicePixelRatio, 1.5);
  const redimensionar = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
  };
  redimensionar();
  const ro = new ResizeObserver(redimensionar);
  ro.observe(canvas);

  let px = 0, py = 0, tx = 0, ty = 0;
  const alMover = (e: PointerEvent) => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", alMover, { passive: true });

  const medir = medidorDeFrames();
  let vivo = true, visible = true, rafId = 0, t0 = 0;
  let degradado = false;

  const frame = (ahora: number) => {
    rafId = 0;
    if (!vivo || !visible) return;
    if (t0 === 0) t0 = ahora;

    const veredicto = medir(ahora);
    if (veredicto === false) {
      // Antes de apagar, un intento a mitad de resolución: en muchos teléfonos
      // alcanza y la animación se conserva.
      if (!degradado && dpr > 1) { degradado = true; dpr = 1; redimensionar(); }
      else { apagar(); return; }
    }

    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    gl.uniform1f(u.t, (ahora - t0) / 1000);
    gl.uniform2f(u.puntero, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  };

  const alCambiarVisibilidad = () => {
    visible = !document.hidden;
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
    else if (!visible && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  const io = new IntersectionObserver((xs) => {
    visible = xs.some((x) => x.isIntersecting) && !document.hidden;
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
    else if (!visible && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  });
  io.observe(canvas);

  const mq = matchMedia("(prefers-color-scheme: dark)");
  const alCambiarTema = () => subirColores();
  mq.addEventListener("change", alCambiarTema);

  const alPerderContexto = (e: Event) => { e.preventDefault(); apagar(); };
  canvas.addEventListener("webglcontextlost", alPerderContexto);

  function apagar(): void {
    if (!vivo) return;
    vivo = false;
    if (rafId) cancelAnimationFrame(rafId);
    canvas.classList.remove("lab__campo--activo");
    removeEventListener("pointermove", alMover);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    canvas.removeEventListener("webglcontextlost", alPerderContexto);
    mq.removeEventListener("change", alCambiarTema);
    io.disconnect();
    ro.disconnect();
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }

  canvas.classList.add("lab__campo--activo");
  rafId = requestAnimationFrame(frame);
  return { destruir: apagar };
}
