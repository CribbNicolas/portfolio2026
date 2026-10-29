// SPIKE — chapter "DeltaDictum", the second hook. It opens on the black the
// seats chapter switched off into (seats.ts does the switch-off and the
// interception), then three acts in one pin:
//  1 · the name and the claim, scrubbed — the words light up as you scroll;
//  2 · the race: the same request to the same agent, without DD and with it.
//      Without DD the test hangs, and its clock runs three real seconds and
//      then races to ten minutes; with DD the memory arrives before the edit;
//  3 · the same session, annotated: while that clock races, the left side
//      goes, the right one slides over and three notes explain how it works,
//      wired to the lines they talk about.
// 2 and 3 are ONE automatic scene, with the scroll held from the race's first
// frame until it says "Seguí bajando" (author, 2026-10-28).
// After the pin, in plain scroll: the takeaway line, harnesses, links.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { $, $$, holdScroll, paced, pinPaced, refreshing, releaseScroll } from "./util";

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

export function dd() {
  const race = $("[data-ddrace]");
  const off = $("[data-race='off']");
  const on = $("[data-race='on']");
  const notes = $$("[data-note]");
  const links = $<SVGSVGElement>("[data-ddlinks]");
  const rail = $$("[data-dd-rail]");
  const words = $$("[data-ddm-claim] .w");
  const name = SplitText.create("[data-ddm-name]", { type: "chars" });

  gsap.set("[data-ddm-kicker], [data-ddm-lede]", { autoAlpha: 0, y: 16 });
  gsap.set(name.chars, { yPercent: 110, autoAlpha: 0 });
  gsap.set(race, { autoAlpha: 0 });

  // --- act 1: the name (scrubbed) -------------------------------------------
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
  tl.to("[data-ddm-kicker]", { autoAlpha: 1, y: 0, duration: 0.3 }, 0);
  tl.to(name.chars, { yPercent: 0, autoAlpha: 1, duration: 0.5, stagger: 0.03, ease: "power3.out" }, 0.05);
  tl.to(words, { opacity: 1, duration: 0.12, stagger: 0.9 / words.length, ease: "none" }, 0.6);
  tl.to("[data-ddm-lede]", { autoAlpha: 1, y: 0, duration: 0.3 }, 1.5);
  tl.to({}, { duration: 0.4 }, 1.8);
  tl.to("[data-ddm]", { autoAlpha: 0, scale: 0.94, y: -30, duration: 0.4, ease: "power2.in" }, 2.2);
  // Acts 2 and 3 are a scene: the pin only measures how far the reader is.
  // What follows SHOW is the notes held on screen for reading, after the
  // scroll is let go.
  const SHOW = 2.6;
  tl.to({}, { duration: 1.4 }, SHOW);

  // --- the scenes ---------------------------------------------------------------
  const lines = (term: HTMLElement) => $$("[data-l]", term);
  const line = (term: HTMLElement, l: string) => $(`[data-l='${l}']`, term);
  const showAll = (term: HTMLElement, on: boolean) => lines(term).forEach((x) => x.classList.toggle("on", on));
  // The hung test's clock: a value the scene tweens (three real seconds,
  // then a race to ten minutes), and a spinner that turns while it runs.
  const clock = { s: 0, running: false };
  const clockEl = $("[data-clock]", off);
  const spinEl = $("[data-spin]", off);
  const tick = () => {
    const sec = Math.round(clock.s);
    clockEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  };
  gsap.ticker.add((time) => {
    if (clock.running) spinEl.textContent = SPIN[Math.floor(time * 12) % SPIN.length];
  });
  const go = $("[data-dd-go]");

  const type = (tl: gsap.core.Timeline, el: HTMLElement, at: number) => {
    const text = el.dataset.full ?? (el.dataset.full = el.textContent ?? "");
    const st = { n: 0 };
    tl.call(() => void (el.textContent = ""), [], at);
    tl.to(st, {
      n: text.length,
      duration: text.length * 0.032,
      ease: "none",
      onUpdate: () => void (el.textContent = text.slice(0, Math.round(st.n))),
    }, at);
  };
  const reveal = (tl: gsap.core.Timeline, term: HTMLElement, l: string, at: number) =>
    tl.call(() => line(term, l).classList.add("on"), [], at);

  const twoColumns = () => getComputedStyle(race).gridTemplateColumns.split(" ").length > 1;
  const gap = () => parseFloat(getComputedStyle(race).rowGap) || 0;
  // From layout, not rects: the left session may already be sliding away.
  const shift = () => (twoColumns() ? -(on.offsetLeft - off.offsetLeft) : 0);
  const wire = () => {
    const box = race.getBoundingClientRect();
    links.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    links.innerHTML = notes
      .filter((n) => Number(getComputedStyle(n).opacity) > 0.05)
      .map((n) => {
        const a = $(`[data-note-anchor='${n.dataset.note}']`, on).getBoundingClientRect();
        const b = n.getBoundingClientRect();
        const x1 = Math.min(a.right, on.getBoundingClientRect().right - 12) - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + 24 - box.top;
        const mx = (x1 + x2) / 2;
        return `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" style="opacity:${getComputedStyle(n).opacity}"/><circle cx="${x1}" cy="${y1}" r="3"/>`;
      })
      .join("");
  };
  let wiring = false;
  gsap.ticker.add(() => {
    if (wiring) wire();
  });

  /** The whole race and the notes, automatic. The scroll is held on entry
   *  and let go with the invitation to go on. */
  const show = () => {
    const s = gsap.timeline({ onComplete: releaseScroll });
    s.call(() => {
      clock.running = false;
      clock.s = 0;
      tick();
      showAll(off, false);
      showAll(on, false);
      on.classList.remove("is-hit");
      $$(".is-lit", race).forEach((x) => x.classList.remove("is-lit"));
      links.innerHTML = "";
    }, [], 0);
    s.set(off, { autoAlpha: 1, x: 0, clearProps: "height,marginBottom" }, 0);
    s.set(on, { autoAlpha: 1, x: 0 }, 0);
    s.set(notes, { autoAlpha: 0, x: 20 }, 0);
    s.set(go, { autoAlpha: 0 }, 0);
    s.fromTo([off, on], { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.1, ease: "power3.out" }, 0);
    // Same request, typed into both at once.
    for (const term of [off, on]) {
      reveal(s, term, "prompt", 0.4);
      type(s, $("[data-type]", term), 0.4);
      reveal(s, term, "answer", 2.0);
    }
    // Here they part. Without DD the agent goes straight to the edit...
    reveal(s, off, "update", 2.6);
    reveal(s, off, "diff", 3.0);
    reveal(s, off, "run", 3.6);
    reveal(s, off, "result", 4.1);
    reveal(s, off, "verdict", 4.3);
    // ...and hangs. The clock speeds up steadily, never in a jump: it starts
    // near real time and grows exponentially to ten minutes in six seconds
    // (s = (e^(k·t) − 1) / k, k chosen so s(6) = 600: 0:01, 0:06, 0:22,
    // 1:09, 3:25, 10:00 at each second).
    const K = 1.08;
    const run = { t: 0 };
    s.call(() => void (clock.running = true), [], 4.3);
    s.fromTo(run, { t: 0 }, {
      t: 6,
      duration: 6,
      ease: "none",
      onUpdate: () => ((clock.s = Math.min(600, (Math.exp(K * run.t) - 1) / K)), tick()),
    }, 4.3);
    s.call(() => void (clock.running = false), [], 10.3);
    // ...with DD the hook speaks first: the memory lands before the edit.
    reveal(s, on, "hook", 2.6);
    s.call(() => on.classList.add("is-hit"), [], 2.6);
    s.call(() => on.classList.remove("is-hit"), [], 3.6);
    reveal(s, on, "update", 3.5);
    reveal(s, on, "diff", 3.9);
    reveal(s, on, "run", 4.5);
    reveal(s, on, "result", 5.0);
    reveal(s, on, "verdict", 5.2);
    // Well before the clock gets to ten minutes (around the one-minute mark)
    // the hung session starts to leave, still counting; the other takes its
    // place and the notes explain it, each wired to its line.
    if (twoColumns()) {
      s.to(off, { autoAlpha: 0, x: -40, duration: 1.6, ease: "power1.in" }, 7.9);
      s.call(() => void (wiring = true), [], 9.0);
    } else {
      // One column (phones): the hung session folds away, so the other one
      // rises into its place and the notes sit right under it — no wires,
      // which across one column only crossed the text.
      s.to(off, { autoAlpha: 0, height: 0, marginBottom: () => -gap(), duration: 1.1, ease: "power2.inOut" }, 7.9);
    }
    s.fromTo(on, { x: 0 }, { x: shift, duration: 0.8, ease: "power3.inOut" }, 9.2);
    notes.forEach((n, i) => {
      const t = 10.1 + i * 0.6;
      s.fromTo(n, { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "power3.out" }, t);
      s.call(() => $(`[data-note-anchor='${n.dataset.note}']`, on).classList.add("is-lit"), [], t);
    });
    // And the reader is let go.
    s.to(go, { autoAlpha: 1, duration: 0.5, ease: "power1.out" }, 12.1);
    return s;
  };

  /** The end of the scene, at once — for a reader coming back up into it. */
  const shown = () => {
    clock.running = false;
    clock.s = 600;
    tick();
    showAll(on, true);
    gsap.set(off, twoColumns() ? { autoAlpha: 0 } : { autoAlpha: 0, height: 0, marginBottom: -gap() });
    gsap.set(on, { autoAlpha: 1, y: 0, x: shift() });
    gsap.set(notes, { autoAlpha: 1, x: 0 });
    notes.forEach((n) => $(`[data-note-anchor='${n.dataset.note}']`, on).classList.add("is-lit"));
    gsap.set(go, { autoAlpha: 1 });
    wiring = twoColumns();
  };

  // --- where the scroll is (decided once a frame, never mid-refresh) -----
  let want = false;
  let active = false;
  let scene: gsap.core.Timeline | null = null;
  tl.eventCallback("onUpdate", () => {
    const t = tl.time();
    want = t >= SHOW;
    rail.forEach((r, j) => r.classList.toggle("on", j === 0 || (j > 0 && t >= SHOW)));
  });
  gsap.ticker.add(() => {
    if (refreshing.now || want === active) return;
    active = want;
    if (scene) {
      // Cut short (a resize, a jump): never leave the page held.
      scene.kill();
      scene = null;
      releaseScroll();
    }
    wiring = false;
    if (!active) {
      clock.running = false;
      gsap.to(race, { autoAlpha: 0, duration: 0.3, overwrite: true });
      gsap.set(go, { autoAlpha: 0 });
      links.innerHTML = "";
      return;
    }
    gsap.to(race, { autoAlpha: 1, duration: 0.3, overwrite: true });
    // Coming down into it, it plays and holds the scroll; coming back up
    // into it, it is simply there, finished.
    // Jumping past it (a dragged scrollbar, a link) must not hold the page
    // for a scene that is no longer on screen.
    if (pin.direction < 0 || !pin.isActive) return shown();
    holdScroll();
    scene = show();
  });

  const outer = paced(tl, [
    [0.6, 0.45], // the name: right away, it is what the reader came down for
    [2.2, 1.3], // the claim lighting up, the lede
    [SHOW, 0.5], // the manifesto steps back
    [tl.duration(), 1.2], // the notes, once the race has played and let go
  ]);
  const pin = pinPaced("[data-dd]", "[data-dd-stage]", outer);
  // See-through until it pins: it rises over the last seats beat (overlap),
  // which must stay visible; black from the moment it takes over.
  ScrollTrigger.create({
    trigger: "[data-dd]",
    start: "top top",
    end: "max",
    toggleClass: { targets: "[data-dd-stage]", className: "is-lit" },
  });
  // The switch-off's black (seats.ts) is still over everything when this
  // pins: the hand-off between the two pins happens underneath it, unseen.
  // It dissolves over the first stretch of this pin, as the name rises.
  gsap.fromTo(
    "[data-crt]",
    { opacity: 1 },
    {
      opacity: 0,
      ease: "power1.in",
      scrollTrigger: { trigger: "[data-dd]", start: "top top", end: () => `+=${innerHeight * 0.3}`, scrub: true },
    },
  );

  // "Seguí bajando" belongs to the pinned stage; once the reader goes on and
  // the stage scrolls away, it must not ride along at the top of the screen.
  ScrollTrigger.create({
    trigger: "[data-dd]",
    start: () => pin.end - innerHeight * 0.4,
    end: () => pin.end + innerHeight,
    onEnter: () => gsap.to([go, ...rail], { autoAlpha: 0, duration: 0.3, overwrite: true }),
    onLeaveBack: () => {
      gsap.to(rail, { autoAlpha: 1, duration: 0.3, overwrite: true });
      if (active) gsap.to(go, { autoAlpha: 1, duration: 0.3, overwrite: true });
    },
  });

  // After the pin: plain reveals.
  $$("[data-dd-reveal]").forEach((el) =>
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
    }),
  );
}

export function ddStill() {
  // Still: everything at once, the race finished, the notes in place.
  $$("[data-ddrace] [data-l]").forEach((l) => l.classList.add("on"));
  $$("[data-note-anchor]").forEach((l) => l.classList.add("is-lit"));
}
