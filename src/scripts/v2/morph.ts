// SPIKE — the hand-off from the map to the hall: districts become seats.
// While the seats chapter slides up over the map's last screen, one district
// per seat lifts off the map as a point of light and flies to its seat; the
// seat lights up as it lands, row by row from the stage out. Same problem,
// another map: thousands of pieces, each with a state of its own.
//
// Everything is a pure function of the hand-off's progress `p` (0..1), so it
// scrubs both ways. Both ends are measured every frame from the DOM — probes
// inside the tilted map, the seats themselves — so whatever pose either side
// is in (the map's pin lags behind the scroll), the points start and land
// exactly on what is on screen.
import gsap from "gsap";
import { $ } from "./util";

/** How long one point flies, in units of `p`. */
const FLIGHT = 0.34;
/** When the first and the last point take off. */
const FIRST = 0.12;
const LAST = 0.5;

export function cellsToSeats(sites: { fx: number; fy: number }[], seats: SVGCircleElement[]) {
  const tilt = $("[data-peak-tilt]");
  const n = Math.min(sites.length, seats.length);

  // Pair by x, so the flights run side by side instead of crossing: the
  // leftmost district goes to the leftmost seat. Seats keep their DOM order
  // (row by row from the stage) as the order they light up in.
  const byX = seats
    .slice(0, n)
    .map((s, i) => ({ i, x: s.cx.baseVal.value }))
    .sort((a, b) => a.x - b.x);
  const fromX = sites.slice(0, n).sort((a, b) => a.fx - b.fx);
  const source: { fx: number; fy: number }[] = new Array(n);
  byX.forEach((s, rank) => (source[s.i] = fromX[rank]));

  const probes = source.map(({ fx, fy }) => {
    const el = document.createElement("i");
    el.className = "peak__probe";
    el.style.left = `${fx * 100}%`;
    el.style.top = `${fy * 100}%`;
    tilt.append(el);
    return el;
  });

  const canvas = document.createElement("canvas");
  canvas.className = "morph";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  let dpr = 1;
  // From the canvas's own box, not innerWidth: the page reserves a gutter
  // for the scrollbar, so the box is narrower than the window, and a backing
  // store sized to the window squeezed every point a few px to the left —
  // the points missed their seats, more so the further right.
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  };
  size();
  addEventListener("resize", size);

  const color = getComputedStyle(document.documentElement).getPropertyValue("--accent-ink").trim();
  const ease = gsap.parseEase("power2.inOut");
  const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lit = new Array<boolean | null>(n).fill(null);
  const setLit = (i: number, on: boolean) => {
    if (lit[i] === on) return;
    lit[i] = on;
    seats[i].style.opacity = on ? "" : "0";
  };

  function render(p: number) {
    if (p <= 0 || p >= 1) {
      // setProperty, not a property access on style: invariants.test.ts
      // reads any visibility property access in src/ as dataset logic.
      canvas.style.setProperty("visibility", "hidden");
      for (let i = 0; i < n; i++) setLit(i, p >= 1);
      return;
    }
    canvas.style.setProperty("visibility", "visible");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    // The points show up on the map first, before any of them leaves.
    const appear = clamp(p / FIRST);
    const arc = innerHeight * 0.14;

    for (let i = 0; i < n; i++) {
      const go = FIRST + (LAST - FIRST) * (i / (n - 1));
      const t = clamp((p - go) / FLIGHT);
      if (t >= 1) {
        setLit(i, true);
        // The seat lights up as it lands — filled with the accent, a ring
        // opening around it — and dims to an ordinary seat as the hand-off
        // ends: the house lights coming up row by row.
        const land = go + FLIGHT;
        const g = clamp((p - land) / (1 - land));
        if (g < 1) {
          // An ellipse, the seat's own projected shape: in perspective a
          // seat is flattened, and a round glow stuck out above and below
          // it and read as landing beside it.
          const r = seats[i].getBoundingClientRect();
          const c = center(r);
          ctx.globalAlpha = (1 - g) * 0.9;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          const ring = clamp((p - land) / 0.1);
          if (ring < 1) {
            const k = 1 + 1.6 * ring;
            ctx.globalAlpha = (1 - ring) * 0.7;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, (r.width / 2) * k, (r.height / 2) * k, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        continue;
      }
      setLit(i, false);
      const a = center(probes[i].getBoundingClientRect());
      const seat = seats[i].getBoundingClientRect();
      const b = center(seat);
      const k = ease(t);
      // A quadratic arc, lifted at its middle: the points rise off the map
      // before they drop into their seats.
      const mx = (a.x + b.x) / 2;
      const my = Math.min(a.y, b.y) - arc;
      const u = 1 - k;
      const x = u * u * a.x + 2 * u * k * mx + k * k * b.x;
      const y = u * u * a.y + 2 * u * k * my + k * k * b.y;
      // Round in flight, the seat's flattened shape on arrival.
      ctx.globalAlpha = appear;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + (seat.width / 2 - 2) * k, 2 + (seat.height / 2 - 2) * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { render };
}
