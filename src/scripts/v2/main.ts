// The landing's entry: smooth scroll, the intro loader, the opening, and then
// one module per chapter. Lenis drives the scroll; ScrollTrigger reads it
// through the GSAP ticker.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { $, $$, scroller } from "./util";
import { intro, introStill } from "./intro";
import { peak, peakStill } from "./peak";
import { seats, seatsStill } from "./seats";
import { dd, ddStill } from "./dd";
import { journey, journeyStill } from "./journey";
import { work, workStill } from "./work";
import { close, closeStill } from "./close";
import { cvModal } from "./cvmodal";

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// A reload starts at the top, not where the browser left off: the page is
// one sequence and the loader opens it.
history.scrollRestoration = "manual";
scrollTo(0, 0);
// Back/forward cache restores the page frozen mid-scroll, loader skipped.
addEventListener("pageshow", (e) => e.persisted && location.reload());

function startLenis() {
  // Faster than Lenis's defaults on purpose (author, 2026-10-26): the page is
  // long and the pinned chapters already slow the reader down.
  const lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1.45, touchMultiplier: 1.6 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      lenis.scrollTo(a.getAttribute("href")!, { duration: 1.4 });
    });
  }
  // Lets the QA screenshots (DeltaDictum: landing-v2/qa) jump to exact
  // scroll positions.
  (window as unknown as { __lenis: Lenis }).__lenis = lenis;
  scroller.lenis = lenis;
  return lenis;
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The loader shows REAL progress, not a timer: each step of getting the page
 * ready reports its weight (they add up to 100), and the ring's outline draws
 * as the number climbs. It lets go the moment the last step lands — no
 * minimum time on screen.
 */
function loader() {
  const el = $("[data-loader]");
  const pct = $("[data-loader-pct]");
  const outline = el.querySelector<SVGPathElement>("[data-ring-outline]")!;
  const fill = el.querySelector("[data-ring-fill]");
  const n = el.querySelector<SVGPathElement>("[data-ring-n]")!;
  const len = outline.getTotalLength();
  const nLen = n.getTotalLength();
  gsap.set(outline, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set(n, { strokeDasharray: nLen, strokeDashoffset: nLen });
  gsap.set(fill, { opacity: 0 });

  const shown = { v: 0 };
  let target = 0;
  const paint = () => {
    pct.textContent = `${Math.round(shown.v)}%`;
    gsap.set(outline, { strokeDashoffset: len * (1 - shown.v / 100) });
  };
  // The number chases the real progress instead of jumping to it, so a step
  // that lands all at once still reads as counting.
  const chase = (duration: number) =>
    gsap.to(shown, { v: target, duration, ease: "power2.out", overwrite: true, onUpdate: paint });

  return {
    add(weight: number) {
      target = Math.min(100, target + weight);
      chase(0.35);
    },
    /** Resolves as the mark starts to leave, so the opening can come in under it. */
    finish() {
      target = 100;
      return new Promise<void>((resolve) => {
        gsap
          .timeline({ onComplete: () => el.remove() })
          .add(chase(0.2))
          .to(fill, { opacity: 1, duration: 0.25, ease: "power1.out" })
          .to(n, { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, "<")
          .to(pct, { autoAlpha: 0, duration: 0.2 }, "<")
          .call(resolve)
          .to(el.querySelector(".loader__mark"), { scale: 4, opacity: 0, duration: 0.55, ease: "power3.in" })
          .to(el, { opacity: 0, duration: 0.3, ease: "none" }, "-=0.25");
      });
    },
  };
}

/**
 * Chapters that hand off to each other with no seam: each one is pulled up by
 * one screen so it lands exactly on top of the previous one's last frame, and
 * its pin starts at the very scroll position where the previous pin ends.
 * Measured in px from `innerHeight` (what ScrollTrigger pins with), not in
 * `svh`, which on phones is not the same number.
 */
function overlap(selectors: string[]) {
  const set = () => selectors.forEach((s) => ($(s).style.marginTop = `${-innerHeight}px`));
  set();
  ScrollTrigger.addEventListener("refreshInit", set);
}

export async function start() {
  if (reduced) {
    $("[data-loader]")?.remove();
    $("[data-crt]")?.remove();
    document.documentElement.classList.add("still");
    introStill();
    peakStill();
    seatsStill();
    ddStill();
    journeyStill();
    workStill();
    closeStill();
    anchorTarget()?.scrollIntoView();
    return;
  }
  // Plays on EVERY load while the opening is being polished (author,
  // 2026-10-28). `?nointro` still skips it.
  const skip = new URLSearchParams(location.search).has("nointro");
  if (skip) $("[data-loader]").remove();
  const progress = skip ? { add: () => {}, finish: () => Promise.resolve() } : loader();

  const lenis = startLenis();
  lenis.stop();

  // Images and the rest of the page. Capped: one slow asset further down
  // must not hold the whole page behind the loader.
  const loaded = new Promise<void>((r) =>
    document.readyState === "complete" ? r() : addEventListener("load", () => r(), { once: true }),
  );
  const assets = Promise.race([loaded, wait(5000)]).then(() => progress.add(15));

  // Fonts before the chapters: SplitText and every pin measure text, and a
  // swap after that would leave them measuring the fallback font.
  await document.fonts.ready;
  progress.add(15);

  // Every chapter builds its timelines and pins under the loader. One frame
  // between them, so the number repaints instead of jumping at the end.
  let entrance: gsap.core.Timeline | undefined;
  const chapters: [() => unknown, number][] = [
    // Braces, not an expression: a GSAP timeline is a thenable that resolves
    // when it completes, and this one is paused — awaited, it never would.
    [
      () => {
        entrance = intro();
      },
      10,
    ],
    [peak, 16], // the map: the Voronoi and its layers are the heaviest step
    [seats, 10],
    [dd, 6],
    [journey, 6],
    [work, 6],
    [close, 6],
    [cvModal, 0], // after close(): it copies the close's C
  ];
  for (const [init, weight] of chapters) {
    // A chapter may return a promise (the map paints its layers over several
    // frames); the loader waits for it.
    await init();
    progress.add(weight);
    await frame();
  }

  // The overlap goes on only now, with every pin in place. Applied first, it
  // stacked the overlapping chapters at the very top of the page (each one a
  // screen tall with a minus-one-screen margin) until the pins pushed them
  // down: under the loader, invisible, but a layout shift all the same —
  // CLS 2 on a throttled phone in Lighthouse.
  overlap(["[data-peak]", "[data-seats]", "[data-dd]"]);
  await assets;
  ScrollTrigger.refresh();
  progress.add(5);
  // Two frames: the page as it now stands has been painted at least once.
  await frame();
  await frame();
  progress.add(5);

  scrollTo(0, 0);
  await progress.finish();
  lenis.start();
  entrance?.play();
  // A shared link with an anchor (`/#cv`) lands on its section once the
  // page is built, not on the opening the reload reset it to.
  // `resize()` first: Lenis measured the page before the pins added their
  // spacing, and would clamp the jump to that shorter page.
  const anchored = anchorTarget();
  if (anchored) {
    lenis.resize();
    lenis.scrollTo(anchored, { immediate: true });
  }
}

/** The element the URL's `#anchor` names, if any. */
function anchorTarget(): HTMLElement | null {
  const id = decodeURIComponent(location.hash.slice(1));
  return id ? document.getElementById(id) : null;
}
