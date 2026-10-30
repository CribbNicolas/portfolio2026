// Shared bits for the landing's chapters.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** The phone layout's media query — phones, and tablets held upright. Keep
 *  in step with the big block in v2.css. */
export const NARROW = "(max-width: 760px), (max-width: 1100px) and (orientation: portrait)";

/** Numbers in the page's own language (`<html lang>`): 13.000 in Spanish,
 *  13,000 in English — the same grouping the dataset's labels use. */
export const numbers = () => new Intl.NumberFormat(document.documentElement.lang);

/** The page's smooth scroll, for the few moments a chapter holds it still
 *  (the DD interception). Set by main.ts; typed loosely so this file does
 *  not import Lenis. */
export const scroller: { lenis: { stop(): void; start(): void } | null } = { lenis: null };

/**
 * Holds the page still while a scene that must be watched whole plays (the
 * switch-off and interception, the DD race). Everything that scrolls is
 * stopped: Lenis (wheel, touch), the keys, and the native scroll itself —
 * `html.is-held` hides the overflow, so a dragged scrollbar or a finger on a
 * phone cannot move it either. The gutter stays reserved (v2.css), so
 * hiding the scrollbar shifts nothing.
 */
const KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);
const block = (e: Event) => e.preventDefault();
const blockKeys = (e: KeyboardEvent) => KEYS.has(e.key) && e.preventDefault();
/**
 * `at`: the scroll position the held scene belongs to. The pins scrub 0.7 s
 * behind the scroll, so a fast flick on a phone has carried the page past
 * the scene by the time it fires, and iOS momentum keeps going under
 * `overflow: hidden`: the scene played on a screen the reader had already
 * left (author, 2026-10-30, iPhone). Given `at`, the page goes back there
 * and stays, whatever the momentum does, until it is let go.
 */
let heldAt: number | null = null;
const stay = () => {
  if (heldAt !== null && Math.abs(scrollY - heldAt) > 1) scrollTo(0, heldAt);
};
export function holdScroll(at?: number) {
  scroller.lenis?.stop();
  document.documentElement.classList.add("is-held");
  addEventListener("wheel", block, { passive: false });
  addEventListener("touchmove", block, { passive: false });
  addEventListener("keydown", blockKeys);
  if (at !== undefined) {
    heldAt = Math.round(at);
    scrollTo(0, heldAt);
    addEventListener("scroll", stay, { passive: true });
  }
}
export function releaseScroll() {
  heldAt = null;
  removeEventListener("scroll", stay);
  document.documentElement.classList.remove("is-held");
  removeEventListener("wheel", block);
  removeEventListener("touchmove", block);
  removeEventListener("keydown", blockKeys);
  scroller.lenis?.start();
}

/** True while ScrollTrigger refreshes. The pins render their timelines at
 *  several times during a refresh; a chapter that ACTS on its timeline's
 *  position (a scene that plays) must wait it out. */
export const refreshing = { now: false };
ScrollTrigger.addEventListener("refreshInit", () => void (refreshing.now = true));
ScrollTrigger.addEventListener("refresh", () => void (refreshing.now = false));

export const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) =>
  root.querySelector<T>(s)!;
export const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(s));

/**
 * A pinned chapter's beats: each one rises in, stays, and lifts out. `offset`
 * shifts every beat (time spent on an intro, like the dive).
 */
export function beatHelpers(tl: gsap.core.Timeline, beats: HTMLElement[], offset = 0) {
  const at = (t: number) => t + offset;
  return {
    at,
    beatIn: (i: number, t: number) =>
      tl.to(beats[i], { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" }, at(t)),
    beatOut: (i: number, t: number) =>
      tl.to(beats[i], { autoAlpha: 0, y: -40, duration: 0.4, ease: "power2.in" }, at(t)),
  };
}

/**
 * The page's pacing, in ONE unit: viewport heights of scroll.
 *
 * Each chapter's timeline keeps its own internal clock (what happens in what
 * order). `paced` re-times it: every segment `[innerEnd, vh]` says "play the
 * inner timeline up to `innerEnd` over `vh` screens of scroll". So the rhythm
 * of the whole page is a list of numbers you can read side by side, instead of
 * pin lengths and timeline durations that only make sense together.
 */
export function paced(inner: gsap.core.Timeline, segments: [innerEnd: number, vh: number][]) {
  inner.pause();
  const outer = gsap.timeline();
  let from = 0;
  for (const [to, vh] of segments) {
    outer.add(inner.tweenFromTo(from, to, { duration: vh, ease: "none", immediateRender: false }));
    from = to;
  }
  return outer;
}

/** Pin `stage` for exactly as many screens as the paced timeline lasts. */
export function pinPaced(trigger: string, stage: string, outer: gsap.core.Timeline) {
  return ScrollTrigger.create({
    trigger,
    start: "top top",
    end: () => `+=${outer.duration() * innerHeight}`,
    pin: stage,
    scrub: 0.7,
    animation: outer,
    invalidateOnRefresh: true,
  });
}

/** Lights the rail segments whose beat has started. */
export function railUpdater(tl: gsap.core.Timeline, rail: HTMLElement[], starts: number[]) {
  return () => {
    const t = tl.time();
    rail.forEach((r, j) => r.classList.toggle("on", t >= starts[j]));
  };
}
