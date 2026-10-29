// SPIKE — the illustrative district map. Generated geometry, not RPPL's:
// ~13,000 Voronoi cells inside a made-up landmass, painted once into
// offscreen layers so each frame is a handful of drawImage calls.
import { Delaunay } from "d3-delaunay";
import { NARROW } from "./util";

/** Fewer on a phone: a smaller canvas, a slower CPU, and the cells are
 *  illustrative (the counter shows the dataset's figure either way). */
export const CELL_COUNT = matchMedia(NARROW).matches ? 6000 : 13000;

const W = 1600;
const H = 1000;
// The coastline reaches 1.22× its radius to the east (the lobes of
// `shore`) and 1.01× to the west: at RX 700 around the center it ran 50
// units past the canvas's right edge and was cut straight. Smaller radii and
// a center nudged west and south keep ~90 units of sea on every side.
const CX = W / 2 - 60;
const CY = H / 2 + 55;
const RX = 640;
const RY = 380;

export interface MapState {
  /** 0..1 — radial reveal of the choropleth. */
  reveal: number;
  /** 0..1 — paint artifacts on districts without data. */
  glitch: number;
  /** 0..1 — the index sweep; artifacts left of it are fixed. */
  scan: number;
  /** 0..1 — the sweep back, right to left: the cells the index fixed take the
   *  color of the districts around them, and the map is whole again. */
  heal: number;
  /** 0..1 — dims the map for the closing beat. */
  dim: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shore = (theta: number) =>
  1 + 0.16 * Math.sin(3 * theta + 0.6) + 0.09 * Math.sin(5 * theta + 2.1) + 0.05 * Math.sin(11 * theta + 0.3);

function inside(x: number, y: number) {
  const dx = (x - CX) / RX;
  const dy = (y - CY) / RY;
  return Math.hypot(dx, dy) <= shore(Math.atan2(dy, dx));
}

function shorePath(): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * Math.PI * 2;
    const r = shore(t);
    const x = CX + Math.cos(t) * r * RX;
    const y = CY + Math.sin(t) * r * RY;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(" ")})`;

function layer(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** `defer`: leave the first paint of the layers to `buildLazy()`. */
export function createMap(canvas: HTMLCanvasElement, { defer = false } = {}) {
  const rand = mulberry32(2026);
  // Denser toward the east and around a few "metros", like real districts.
  const metros = [
    [1180, 420, 90],
    [1300, 560, 70],
    [520, 600, 80],
    [900, 300, 60],
  ];
  const pts: number[] = [];
  while (pts.length < CELL_COUNT * 2) {
    const x = rand() * W;
    const y = rand() * H;
    if (!inside(x, y)) continue;
    let w = 0.25 + 0.55 * (x / W);
    for (const [mx, my, r] of metros) w += 1.4 * Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (2 * r * r));
    if (rand() * 2 > w) continue;
    pts.push(x, y);
  }
  const delaunay = new Delaunay(Float64Array.from(pts));
  const voronoi = delaunay.voronoi([0, 0, W, H]);

  const value = new Float32Array(CELL_COUNT);
  const noData = new Uint8Array(CELL_COUNT);
  const dist = new Float32Array(CELL_COUNT);
  const ox = CX + 120;
  const oy = CY - 40;
  for (let i = 0; i < CELL_COUNT; i++) {
    const x = pts[2 * i];
    const y = pts[2 * i + 1];
    const v =
      0.5 +
      0.28 * Math.sin(x * 0.0045 + 1.3) * Math.cos(y * 0.006 - 0.4) +
      0.16 * Math.sin((x + y) * 0.011) +
      (rand() - 0.5) * 0.22;
    value[i] = Math.min(0.999, Math.max(0, v));
    noData[i] = rand() < 0.035 ? 1 : 0;
    dist[i] = Math.hypot(x - ox, y - oy);
  }
  // What a no-data district would read like: the mean of its neighbours that
  // have data. Only the return sweep paints it.
  const healed = new Float32Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!noData[i]) continue;
    let sum = 0;
    let n = 0;
    for (const j of delaunay.neighbors(i)) if (!noData[j]) (sum += value[j]), n++;
    healed[i] = n ? sum / n : 0.5;
  }
  const sorted = Float32Array.from(dist).sort();
  const maxR = sorted[sorted.length - 1] + 2;

  const css = getComputedStyle(document.documentElement);
  const tok = (n: string) => css.getPropertyValue(n).trim();
  const bg = hexToRgb(tok("--bg-raised"));
  // The ramp tops out at the LIGHT accent: on a dark map the deep one would
  // leave the densest districts barely brighter than the empty ones.
  const accent = hexToRgb(tok("--accent-ink"));
  const ink = tok("--ink");
  const inkSoft = tok("--ink-soft");

  const ctx = canvas.getContext("2d")!;
  let scale = 1;
  let outline: HTMLCanvasElement;
  let fill: HTMLCanvasElement;
  let glitch: HTMLCanvasElement;
  let clean: HTMLCanvasElement;
  let heal: HTMLCanvasElement;
  const coast = shorePath();

  function paintCells(c: CanvasRenderingContext2D, pick: (i: number) => boolean) {
    c.beginPath();
    for (let i = 0; i < CELL_COUNT; i++) if (pick(i)) voronoi.renderCell(i, c);
  }

  // The layers are painted in steps — one per pass over the cells — so a
  // slow phone can paint them a frame apart instead of in one long task
  // (it was ~1 s of blocked main thread at 4x CPU throttling: Lighthouse's
  // TBT). `build()` runs them all at once (a resize); `buildLazy()` yields
  // between them (the first build, under the loader).
  const STEPS = 6;
  const ramp = (s: number) => mix(bg, accent, 0.12 + (s / (STEPS - 1)) * 0.88);
  function buildSteps(): (() => void)[] {
    let make: () => readonly [HTMLCanvasElement, CanvasRenderingContext2D];
    let fc: CanvasRenderingContext2D;
    let f: HTMLCanvasElement;
    let hc: CanvasRenderingContext2D;
    let hl: HTMLCanvasElement;
    return [
      () => {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        // Layout size, not getBoundingClientRect: the rect is the TRANSFORMED
        // box — rebuilt mid-tilt (a resize), rotateX squashed its height and
        // the backing store came out short, cutting the bottom of the map off.
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        scale = canvas.width / W;
        make = () => {
          const l = layer(canvas.width, canvas.height);
          const c = l.getContext("2d")!;
          c.setTransform(scale, 0, 0, scale, 0, 0);
          c.clip(coast);
          return [l, c] as const;
        };
        const [o, oc] = make();
        oc.beginPath();
        voronoi.render(oc);
        // Bright enough that the mesh reads through the ring's hole before
        // any district is colored: the teaser is the cells themselves.
        oc.strokeStyle = inkSoft;
        oc.globalAlpha = 0.28;
        oc.lineWidth = 0.6 / scale;
        oc.stroke();
        oc.globalAlpha = 1;
        oc.lineWidth = 1.6 / scale;
        oc.strokeStyle = inkSoft;
        oc.globalAlpha = 0.5;
        oc.stroke(coast);
        outline = o;
        [f, fc] = make();
      },
      // The choropleth, one band of the ramp per step.
      ...Array.from({ length: STEPS }, (_, s) => () => {
        paintCells(fc, (i) => !noData[i] && Math.floor(value[i] * STEPS) === s);
        fc.fillStyle = ramp(s);
        fc.fill();
      }),
      () => {
        fc.beginPath();
        voronoi.render(fc);
        fc.strokeStyle = tok("--bg");
        fc.lineWidth = 0.5 / scale;
        fc.stroke();
        fill = f;
      },
      () => {
        const [g, gc] = make();
        paintCells(gc, (i) => noData[i] === 1);
        gc.fillStyle = ink;
        gc.fill();
        gc.strokeStyle = tok("--accent");
        gc.lineWidth = 3 / scale;
        gc.stroke();
        glitch = g;
        const [k, kc] = make();
        paintCells(kc, (i) => noData[i] === 1);
        kc.fillStyle = ink;
        kc.globalAlpha = 0.9;
        kc.fill();
        clean = k;
      },
      // The no-data cells on the same ramp as the rest, from their neighbours.
      () => {
        [hl, hc] = make();
        for (let s = 0; s < STEPS; s++) {
          paintCells(hc, (i) => noData[i] === 1 && Math.floor(healed[i] * STEPS) === s);
          hc.fillStyle = ramp(s);
          hc.fill();
        }
        paintCells(hc, (i) => noData[i] === 1);
        hc.strokeStyle = tok("--bg");
        hc.lineWidth = 0.5 / scale;
        hc.stroke();
        heal = hl;
        ready = true;
      },
    ];
  }
  let ready = false;
  function build() {
    for (const step of buildSteps()) step();
  }
  async function buildLazy(next: () => Promise<void>) {
    for (const step of buildSteps()) {
      step();
      await next();
    }
  }

  /** How many districts the reveal circle has swept — drives the counter. */
  function revealedCount(reveal: number) {
    const r = reveal * maxR;
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const shake = { at: 0, x: 0, y: 0, a: 1 };

  /** The scan line at x, its glow trailing on the side it came from. */
  function sweep(x: number, trail: -1 | 1) {
    const h = canvas.height;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clip(coast);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const band = 90 * scale;
    const grad = ctx.createLinearGradient(x + trail * band, 0, x, 0);
    grad.addColorStop(0, "rgb(255 255 255 / 0)");
    grad.addColorStop(1, "rgb(255 255 255 / 0.22)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(trail < 0 ? x - band : x, 0, band, h);
    ctx.fillStyle = tok("--accent-ink");
    ctx.fillRect(x - 1.5 * scale, 0, 3 * scale, h);
    ctx.restore();
  }

  function render(s: MapState) {
    if (!ready) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1 - s.dim * 0.65;
    ctx.drawImage(outline, 0, 0);

    if (s.reveal > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ox * scale, oy * scale, s.reveal * maxR * scale, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(fill, 0, 0);
      ctx.restore();
    }

    const sx = s.scan * w;
    if (s.glitch > 0) {
      // The artifacts hold each offset for a few frames instead of taking a
      // new one every frame: they still twitch, they no longer buzz.
      const now = performance.now();
      if (now - shake.at > 70) {
        shake.at = now;
        shake.x = Math.random() - 0.5;
        shake.y = Math.random() - 0.5;
        shake.a = Math.random();
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, 0, w - sx, h);
      ctx.clip();
      ctx.globalAlpha = s.glitch * (0.7 + 0.3 * shake.a) * (1 - s.dim);
      ctx.drawImage(glitch, shake.x * 5 * scale * s.glitch, shake.y * 2 * scale);
      ctx.restore();
      if (s.scan > 0) {
        // Only where the return sweep has not been yet: both layers are
        // translucent once the map dims, and the white would show through.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, Math.min(sx, (1 - s.heal) * w), h);
        ctx.clip();
        ctx.globalAlpha = 1 - s.dim * 0.65;
        ctx.drawImage(clean, 0, 0);
        ctx.restore();
      }
    }

    const hx = (1 - s.heal) * w;
    if (s.heal > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(hx, 0, w - hx, h);
      ctx.clip();
      ctx.globalAlpha = 1 - s.dim * 0.65;
      ctx.drawImage(heal, 0, 0);
      ctx.restore();
    }

    if (s.scan > 0 && s.scan < 1) sweep(sx, -1);
    if (s.heal > 0 && s.heal < 1) sweep(hx, 1);
    ctx.globalAlpha = 1;
  }

  /**
   * `n` districts from the body of the map (not the coast, never a no-data
   * one), as fractions of the map's box. Seeded: the same districts on every
   * load. They are the ones that leave the map and become seats (morph.ts).
   */
  function sites(n: number) {
    const pick = mulberry32(77);
    const out: { fx: number; fy: number }[] = [];
    const tried = new Set<number>();
    while (out.length < n && tried.size < CELL_COUNT) {
      const i = Math.floor(pick() * CELL_COUNT);
      if (tried.has(i)) continue;
      tried.add(i);
      const x = pts[2 * i];
      const y = pts[2 * i + 1];
      if (noData[i] || Math.hypot((x - CX) / RX, (y - CY) / RY) > 0.7) continue;
      out.push({ fx: x / W, fy: y / H });
    }
    return out;
  }

  if (!defer) build();
  return { build, buildLazy, render, revealedCount, sites };
}
