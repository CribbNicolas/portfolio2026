// Chapter 5, "Recorrido". Not pinned: plain scroll, on purpose, after
// two pinned chapters in a row. The stages scroll on the left; on the right a
// sticky toolbox shows the year and grows with every stage, each skill popping
// in at the stage of its first recorded use.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $, $$ } from "./util";

const DIM_NEXT = 0.74;
const DIM_PAST = 0.86;

export function journey() {
  const stages = $$("[data-stage]");
  const chips = $$("[data-chip-stage]");
  const yearEl = $("[data-toolbox-year]");
  const countEl = $("[data-toolbox-count]");
  const years = stages.map((s) => Number(s.dataset.year));
  const shown = { year: years[0], count: 0 };
  let current = -2;

  gsap.set(chips, { autoAlpha: 0, scale: 0.6, y: 10 });
  // Dimmed, not faded out: the stages not reached yet still have to clear
  // the text contrast minimum (at 0.28 they failed Lighthouse's check).
  gsap.set(stages, { opacity: DIM_NEXT });

  // The thread down the left edge draws with the scroll.
  gsap.fromTo(
    "[data-journey-line]",
    { scaleY: 0 },
    {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: ".journey__stages", start: "top 62%", end: "bottom 62%", scrub: 0.4 },
    },
  );

  const paint = () => {
    yearEl.textContent = String(Math.round(shown.year));
    countEl.textContent = String(Math.round(shown.count));
  };

  const setStage = (i: number) => {
    if (i === current) return;
    current = i;
    stages.forEach((s, j) => {
      s.classList.toggle("is-current", j === i);
      gsap.to(s, { opacity: j === i ? 1 : j < i ? DIM_PAST : DIM_NEXT, duration: 0.45, ease: "power2.out", overwrite: true });
    });

    const on = chips.filter((c) => Number(c.dataset.chipStage) <= i);
    const off = chips.filter((c) => Number(c.dataset.chipStage) > i);
    chips.forEach((c) => c.classList.toggle("is-fresh", Number(c.dataset.chipStage) === i));
    // Guarded: GSAP warns "target not found" on an empty list, and the last
    // stage has nothing left to hide.
    if (off.length) gsap.to(off, { autoAlpha: 0, scale: 0.6, y: 10, duration: 0.25, ease: "power2.in", overwrite: true });
    // Only the chips that were hidden pop; the ones already there stay put.
    const arriving = on.filter((c) => Number(gsap.getProperty(c, "autoAlpha")) < 1);
    if (arriving.length) gsap.to(arriving, {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: "back.out(2.2)",
      stagger: 0.045,
      overwrite: true,
    });

    gsap.to(shown, {
      year: i < 0 ? years[0] : years[i],
      count: on.length,
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
      onUpdate: paint,
    });
  };

  stages.forEach((s, i) =>
    ScrollTrigger.create({
      trigger: s,
      start: "top 62%",
      end: "bottom 62%",
      onToggle: (self) => self.isActive && setStage(i),
      onLeaveBack: () => i === 0 && setStage(-1),
    }),
  );
  setStage(-1);
}

/** Reduced motion: every stage lit, the whole toolbox showing. */
export function journeyStill() {
  const stages = $$("[data-stage]");
  $("[data-toolbox-year]").textContent = stages.at(-1)?.dataset.year ?? "";
  $("[data-toolbox-count]").textContent = String($$("[data-chip-stage]").length);
}
