// SPIKE — chapters 1 and 2 as ONE pinned stage. The opening plays its
// entrance; on scroll the C stops turning, crosses over the copy and grows
// until the screen is its color; "Quién soy" is revealed on that color. While
// the manifesto lights up, the stack breaks apart into Interfaz / Servidor /
// Entrega and the plates turn to face the reader.
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { $, $$, paced, pinPaced } from "./util";

/** Length of the cover, in timeline units. Everything after it is "Quién soy". */
const C = 1.1;

/** Height of each card in the pile (z, px): Interfaz on top. Spaced, not
 *  flush — flush, the three read as one slab for the whole stretch. */
const PILE = [80, 20, -40];

/**
 * The cover. It scales around a point INSIDE the ring's body (radius 10.5 of
 * the 32 box, midway between the hole at 6.4 and the rim at 14.6), and walks
 * that point to the center of the screen: at full scale the screen sits deep
 * inside solid accent, nowhere near the hole or the rim.
 *
 * The ring turns, so "the left side of the body" is wherever it has rotated
 * to: the anchor is read from the current angle the moment the cover starts,
 * and the turn is paused for as long as the cover is underway.
 */
function cover(spin: gsap.core.Tween) {
  const wrap = $("[data-ring-wrap]");
  const ring = $("[data-hero-ring]");
  const SCALE = 26;
  const grow = gsap.parseEase("power2.in");
  const walk = gsap.parseEase("power2.out");
  const state = { p: 0 };
  let anchor: { fx: number; fy: number } | null = null;

  const apply = () => {
    if (state.p <= 0.0001) {
      anchor = null;
      gsap.set(wrap, { x: 0, y: 0, scale: 1 });
      if (spin.paused()) spin.resume();
      return;
    }
    if (!anchor) {
      spin.pause();
      const theta = (Number(gsap.getProperty(ring, "rotation")) * Math.PI) / 180;
      const r = 10.5 / 32;
      anchor = { fx: 0.5 + r * Math.cos(Math.PI + theta), fy: 0.5 + r * Math.sin(Math.PI + theta) };
      gsap.set(wrap, { transformOrigin: `${anchor.fx * 100}% ${anchor.fy * 100}%` });
    }
    const ax = wrap.offsetLeft + anchor.fx * wrap.offsetWidth;
    const ay = wrap.offsetTop + anchor.fy * wrap.offsetHeight;
    const k = walk(state.p);
    gsap.set(wrap, {
      x: (innerWidth / 2 - ax) * k,
      y: (innerHeight / 2 - ay) * k,
      scale: 1 + (SCALE - 1) * grow(state.p),
    });
  };
  return { state, apply };
}

export function intro() {
  // --- the opening's entrance (time-based, not scroll) ---
  // Built paused: this runs under the loader, and the caller plays it the
  // moment the loader lets go.
  const split = SplitText.create("[data-hero-name] .hero__line", { type: "chars", mask: "lines" });
  const entrance = gsap
    .timeline({ paused: true })
    .from("[data-hero-ring]", { rotate: -70, opacity: 0, scale: 0.8, duration: 1.6, ease: "expo.out" }, 0)
    .from(split.chars, { yPercent: 115, duration: 1, ease: "expo.out", stagger: 0.025 }, 0.05)
    .from("[data-hero-fade]", { y: 18, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.07 }, 0.35);
  const spin = gsap.to("[data-hero-ring]", { rotate: "+=360", duration: 90, ease: "none", repeat: -1 });

  // --- "Quién soy", initial state ---
  const words = $$("[data-manifesto] .w");
  const plates = $$("[data-plate]");
  const stops = $$(".career__stop");
  // Phones get the same pile at less than half the spacing.
  const k = innerWidth < 760 ? 0.45 : 1;

  gsap.set("[data-about]", { autoAlpha: 0 });
  gsap.set("[data-stack-iso]", { rotateX: 58, rotateZ: -32 });
  gsap.set(words, { opacity: 0.2 });
  gsap.set(plates, { z: -420, yPercent: 0, autoAlpha: 0 });
  gsap.set("[data-about-summary], .about__kicker", { autoAlpha: 0, y: 16 });
  gsap.set(stops, { autoAlpha: 0, y: 12 });
  gsap.set("[data-career-line]", { scaleX: 0 });

  const c = cover(spin);
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  // 1 → 2: the C crosses the copy and floods the screen with its color.
  tl.to(c.state, { p: 1, duration: C, ease: "none", onUpdate: c.apply }, 0);
  // fromTo, not to: the entrance's `from` has already set opacity 0 when this
  // records its start, and reversing to THAT left the note hidden for good.
  tl.fromTo(".hero__choice", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, immediateRender: false }, 0);
  // Same color on both sides of the cut, so swapping layers is invisible.
  tl.set("[data-about]", { autoAlpha: 1 }, C);
  tl.set("[data-ring-wrap], [data-hero]", { autoAlpha: 0 }, C);

  // The manifesto lights up in reading order...
  tl.to(".about__kicker", { autoAlpha: 1, y: 0, duration: 0.3 }, C);
  tl.to(words, { opacity: 1, duration: 0.15, stagger: 1.7 / words.length, ease: "none" }, C + 0.1);

  // ...and, at the same time, the stack: the cards rise into a spaced pile
  // in reading order — Interfaz, then Servidor, then Entrega — each landing
  // BELOW the ones already there, so none passes through another. Then it
  // turns to face the reader as three cards, frontend on top.
  plates.forEach((p, i) =>
    tl.to(p, { z: PILE[i] * k, autoAlpha: 1, duration: 0.5, ease: "power3.out" }, C + 0.1 + i * 0.18),
  );

  // The turn to face the reader. It used to be one tween on one curve, and it
  // read as a hinge: straight, mechanical. Now nothing moves in lockstep —
  //  · the two camera angles run on DIFFERENT curves and start apart, so the
  //    stack swings through an arc instead of rotating about one axis;
  //  · each card leaves the pile a beat after the one above it;
  //  · each card yaws a little on the way and settles with a small overshoot.
  const F = C + 1.25;
  tl.to("[data-stack-iso]", { rotateZ: 0, duration: 1.1, ease: "sine.inOut" }, F);
  tl.to("[data-stack-iso]", { rotateX: 0, duration: 1.0, ease: "power2.inOut" }, F + 0.18);
  tl.fromTo("[data-stack-iso]", { scale: 1 }, { keyframes: { scale: [1, 0.93, 1], ease: "sine.inOut" }, duration: 1.1 }, F);
  plates.forEach((p, i) => {
    const t = F + i * 0.1;
    tl.to(p, { z: 0, duration: 0.75, ease: "power2.inOut" }, t);
    // Spreads out while the pile closes, not after: later, the cards pressed
    // together for a moment between the two.
    tl.to(p, { yPercent: (i - 1) * 112, duration: 0.95, ease: "back.out(1.25)" }, t + 0.1);
    tl.to(p, { keyframes: { rotateY: [0, -9, 0], rotateX: [0, 4, 0], ease: "sine.inOut" }, duration: 1.0 }, t);
    tl.to(p, { "--thick": 0, duration: 0.6, ease: "power1.in" }, t + 0.2);
  });

  tl.to("[data-about-summary]", { autoAlpha: 1, y: 0, duration: 0.3 }, F + 1.0);

  // The career line: quick, it is context, not a chapter.
  const K = F + 1.35;
  tl.to("[data-career-line]", { scaleX: 1, duration: 0.45, ease: "none" }, K);
  tl.to(stops, { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.1 }, K);
  tl.to({}, { duration: 0.3 });

  // The hand-off: everything on the violet lifts away until the screen is
  // nothing but the C's color again — exactly what the map chapter opens on,
  // where the same C shrinks away to uncover the map.
  const H = tl.duration();
  // The next chapter rises over this stage during the pin's last screen (that
  // is how the overlap works) as a violet curtain — the same violet. The
  // content lifts off DURING that screen, so it is never a screen of nothing.
  tl.to(".about__copy, .stack, .career", { y: -90, autoAlpha: 0, duration: 0.8, ease: "power2.in", stagger: 0.08 }, H);

  // Pacing, in screens of scroll. The cover is a transition: it should feel
  // like one push. "Quién soy" gets the most, because there is reading in it.
  const outer = paced(tl, [
    [C, 0.85], // the C floods the screen
    [K, 1.7], // manifesto + the stack breaking apart and turning
    [H, 0.5], // the career line
    [tl.duration(), 1.0], // the content lifts off while the map chapter slides over it
  ]);
  pinPaced("[data-intro]", "[data-intro-stage]", outer);
  return entrance;
}

/** Reduced motion: both layers laid out still, cards already facing out. */
export function introStill() {
  $$("[data-plate]").forEach((p, i) => gsap.set(p, { yPercent: (i - 1) * 112, "--thick": 0 }));
}
