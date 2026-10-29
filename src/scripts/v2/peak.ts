// Chapter 3, the map as the peak. It opens with the C of "Quién soy"
// shrinking away to uncover the map, plays five beats, and ends with an
// aerial descent: the map fades and the seats chapter's hall is waiting.
import gsap from "gsap";
import { createMap, CELL_COUNT, type MapState } from "./map";
import { $, $$, beatHelpers, numbers, paced, pinPaced, railUpdater } from "./util";

/**
 * The un-cover: the exact reverse of "Quién soy"'s cover. The chapter starts
 * with the C scaled so far up that the screen sits inside its solid body —
 * the same violet "Quién soy" ended on, so the hand-off is invisible — and it
 * shrinks back down and away, uncovering the map that was behind it.
 *
 * Same anchor as the cover (a point INSIDE the body, radius 10.5 of the 32
 * box, on the left side), walked from the screen's center back to its place.
 */
function uncover() {
  const wrap = $("[data-peak-ringwrap]");
  const SCALE = 26;
  const fx = 0.5 - 10.5 / 32;
  const fy = 0.5;
  gsap.set(wrap, { transformOrigin: `${fx * 100}% ${fy * 100}%` });
  // power3: the scale falls off fast from full cover, so the map shows up
  // almost as soon as the chapter pins instead of after a stretch of violet.
  const grow = gsap.parseEase("power3.in");
  const walk = gsap.parseEase("power2.out");
  // p = 1: covering the screen. p = 0: the C at its normal size, centered.
  const state = { p: 1 };
  const apply = () => {
    const ax = wrap.offsetLeft + fx * wrap.offsetWidth;
    const ay = wrap.offsetTop + fy * wrap.offsetHeight;
    const k = walk(state.p);
    gsap.set(wrap, {
      x: (innerWidth / 2 - ax) * k,
      y: (innerHeight / 2 - ay) * k,
      scale: 1 + (SCALE - 1) * grow(state.p),
    });
  };
  addEventListener("resize", apply);
  apply();
  return { state, apply };
}

/** The pose of the plane at the hand-off: the map tips into it, the hall
 *  arrives in it (seats.ts), then levels out. */
export const GHOST = { scale: 1.3, rotateX: 55 } as const;

/** Where the hall arrives on screen: the MAP's center, which is offset right
 *  by the map's margin, so the hall lands where the map was. */
export function ghostCenter() {
  const shift = parseFloat(getComputedStyle($("[data-peak-tilt]")).marginLeft) || 0;
  // clientWidth, not innerWidth: the scrollbar's gutter is not page.
  return { x: document.documentElement.clientWidth / 2 + shift / 2, y: innerHeight / 2 };
}

let map: ReturnType<typeof createMap> | undefined;

/** The districts that leave the map for the hall (morph.ts). */
export const mapSites = (n: number) => map?.sites(n) ?? [];

export async function peak() {
  const canvas = $<HTMLCanvasElement>("[data-peak-canvas]");
  // The layers paint a frame apart under the loader (map.ts buildLazy): the
  // pins and timelines below need none of them, only the geometry.
  const m = createMap(canvas, { defer: true });
  map = m;
  const state: MapState = { reveal: 0, glitch: 0, scan: 0, heal: 0, dim: 0 };
  const counter = $("[data-counter]");
  const target = Number(counter.dataset.target);
  const fmt = numbers();
  const beats = $$("[data-beat]");
  const rail = $$("[data-rail]");
  const c = uncover();

  const T = 1.8;
  let live = false;
  const draw = () => {
    m.render(state);
    counter.textContent = fmt.format(Math.round((m.revealedCount(state.reveal) / CELL_COUNT) * target));
  };
  // The artifacts flicker on their own, so while the chapter is on screen we
  // repaint every frame; off screen, never.
  gsap.ticker.add(() => {
    if (live) draw();
  });
  addEventListener("resize", () => {
    m.build();
    draw();
  });

  gsap.set(beats, { autoAlpha: 0, y: 40 });
  gsap.set("[data-bar-before], [data-bar-after]", { "--w": 0 });
  gsap.set("[data-bar-val]", { autoAlpha: 0 });
  gsap.set("[data-peak] .rail, [data-peak] .chapter__note", { autoAlpha: 0 });

  const tl: gsap.core.Timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
  const { at, beatIn, beatOut } = beatHelpers(tl, beats, T);
  const updateRail = railUpdater(tl, rail, [0, 2, 4.2, 6.2, 9.6].map(at));

  // 00 — the C shrinks, uncovering the map, and rolls off to the left. The
  // exit starts before the shrink ends, so it never parks at the center: one
  // continuous move from "the whole screen" to "gone off the left edge".
  tl.to(c.state, { p: 0, duration: T * 0.7, ease: "none", onUpdate: c.apply }, 0);
  // On the inner svg, not the wrapper: the wrapper's transform belongs to
  // apply(). Rolling = moving left while turning counter-clockwise.
  tl.to(
    "[data-peak-ring]",
    {
      x: () => -(innerWidth / 2 + $("[data-peak-ringwrap]").offsetWidth),
      scale: 0.55,
      rotate: -200,
      duration: T * 0.5,
      ease: "power2.in",
    },
    T * 0.5,
  );
  tl.fromTo("[data-peak-tilt]", { scale: 1.3 }, { scale: 0.92, duration: T, ease: "power2.out" }, 0);
  tl.to("[data-peak] .rail, [data-peak] .chapter__note", { autoAlpha: 1, duration: 0.4 }, T - 0.4);

  // 01 — the brief. The map tilts into 3D.
  beatIn(0, 0);
  tl.fromTo(
    "[data-peak-tilt]",
    { rotateX: 0, rotateZ: 0 },
    { rotateX: 52, rotateZ: -18, scale: 1, duration: 2.2, immediateRender: false },
    at(0),
  );
  beatOut(0, 1.6);

  // 02 — the scale: thirteen thousand districts fill in from one point.
  beatIn(1, 2);
  tl.to(state, { reveal: 1, duration: 1.8, ease: "power1.inOut" }, at(2));
  tl.to("[data-peak-tilt]", { rotateZ: -6, scale: 1.04, duration: 1.8 }, at(2));
  beatOut(1, 3.8);

  // 03 — what broke: districts without data paint garbage.
  beatIn(2, 4.2);
  tl.to(state, { glitch: 1, duration: 0.6, ease: "power1.out" }, at(4.2));
  tl.to("[data-peak-tilt]", { rotateX: 38, rotateZ: 8, duration: 1.4 }, at(4.2));
  beatOut(2, 5.8);

  // 04 — the decision: an index sweeps the map left to right and stops the
  // artifacts; then the sweep comes back right to left and the cells it
  // fixed take their neighbours' colors — the map is whole again.
  beatIn(3, 6.2);
  tl.to(state, { scan: 1, duration: 1.4, ease: "none" }, at(6.2));
  tl.to(state, { heal: 1, duration: 1.4, ease: "none" }, at(7.75));
  beatOut(3, 9.2);

  // 05 — the result: the map stays in perspective and dims for the number.
  // The bars are as long as the two ends of the metric: ~500 ms is a tenth of
  // ~5 s. Each number lands as its bar stops.
  beatIn(4, 9.6);
  tl.to(state, { dim: 1, duration: 1.2 }, at(9.6));
  tl.to("[data-bar-before]", { "--w": 1, duration: 0.6, ease: "power3.out" }, at(9.9));
  tl.to("[data-bar-after]", { "--w": 0.1, duration: 0.6, ease: "power3.out" }, at(10.3));
  tl.to("[data-bar-val]", { autoAlpha: 1, duration: 0.25, stagger: 0.4 }, at(10.35));
  tl.to({}, { duration: 0.8 }, at(10.9));

  // 06 — the map tips into the hall's exact pose (same angle, centered where
  // the hall will appear), then dissolves. The dissolve is the LAST screen of
  // this pin, the one where the seats chapter rises over this one: there the
  // seats chapter brings in its hall — the one and only hall, held fixed at
  // the center while its section slides up (seats.ts) — so the map dissolves
  // into it instead of handing over to a copy.
  const D = at(11.7);
  beatOut(4, 11.7);
  tl.to("[data-peak] .rail, [data-peak] .chapter__note", { autoAlpha: 0, duration: 0.3 }, D);
  tl.to("[data-peak-tilt]", { rotateX: GHOST.rotateX, rotateZ: 0, scale: 1.04, duration: 1.0, ease: "power2.inOut" }, D);
  tl.to(state, { dim: 0.5, duration: 0.6 }, D);
  const Hd = D + 1.0;
  // Fades in place — no scale: the points leaving it (morph.ts) start from
  // where its districts are, and a moving map would drag them along. A beat
  // late, so the points are seen to lift off it first.
  tl.to("[data-peak-world]", { autoAlpha: 0, duration: 0.6, ease: "power1.in" }, Hd + 0.25);
  tl.to({}, { duration: 1 }, Hd);

  tl.eventCallback("onUpdate", () => (draw(), updateRail()));
  // Pacing, in screens of scroll per beat. The scale (02) and the index
  // sweep (04) are the two moments to linger on; the rest move along.
  const outer = paced(tl, [
    [T, 0.9], // 00 the C shrinks away
    [at(2), 0.8], // 01 the brief
    [at(4.2), 1.1], // 02 the scale
    [at(6.2), 0.8], // 03 what broke
    [at(9.6), 1.5], // 04 the decision: the sweep there and back
    [at(11.7), 0.9], // 05 the result
    [Hd, 0.8], // 06 the map tips into the hall's pose
    [tl.duration(), 1.0], // the map dissolves while the hall arrives over it
  ]);
  pinPaced("[data-peak]", "[data-peak-stage]", outer);
  // Repaint while the section is anywhere in view — before the pin too, when
  // the ring and the mesh in its hole are already on screen.
  new IntersectionObserver(([e]) => (live = e.isIntersecting)).observe($("[data-peak]"));
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  await m.buildLazy(frame);
  draw();
}

export function peakStill() {
  const canvas = $<HTMLCanvasElement>("[data-peak-canvas]");
  const map = createMap(canvas);
  map.render({ reveal: 1, glitch: 0, scan: 0, heal: 1, dim: 0 });
  gsap.set("[data-bar-before]", { "--w": 1 });
  gsap.set("[data-bar-after]", { "--w": 0.1 });
  const counter = $("[data-counter]");
  counter.textContent = numbers().format(Number(counter.dataset.target));
}
