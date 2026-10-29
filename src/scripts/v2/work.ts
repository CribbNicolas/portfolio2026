// SPIKE — chapter "Cómo trabajo". Calm on purpose: plain scroll, text that
// rises in, and one quiet mechanism — the CI of this very site ticking its
// checks in order as the reader moves through the principles.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $, $$ } from "./util";

export function work() {
  [".work__head", ...$$("[data-principle]")].forEach((el) =>
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%", toggleActions: "play none none reverse" },
    }),
  );

  const gates = $$("[data-gate]");
  const deploy = $("[data-deploy]");
  const count = $("[data-gate-count]");
  let done = -1;
  const paint = (n: number) => {
    if (n === done) return;
    done = n;
    gates.forEach((g, i) => {
      g.classList.toggle("is-done", i < n);
      g.classList.toggle("is-running", i === n);
    });
    deploy.classList.toggle("is-done", n >= gates.length);
    count.textContent = String(Math.max(0, Math.min(n, gates.length)));
  };
  // The whole chapter is one pipeline run: by the time the limits are read,
  // every check has passed.
  ScrollTrigger.create({
    trigger: "[data-work]",
    start: "top 55%",
    end: "bottom 85%",
    onUpdate: (self) => paint(Math.floor(self.progress * (gates.length + 1))),
    onLeaveBack: () => paint(-1),
  });
}

export function workStill() {
  $$("[data-gate]").forEach((g) => g.classList.add("is-done"));
  $("[data-deploy]").classList.add("is-done");
  $("[data-gate-count]").textContent = String($$("[data-gate]").length);
}
