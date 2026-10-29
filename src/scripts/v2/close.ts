// SPIKE — the close. Peak-end: the C that opened the page comes back, turns
// into place, and its hole becomes the download button, split in ESP / EN.
// Not pinned, and not scrubbed (author, 2026-10-28): the entrance PLAYS on its
// own once the section is on screen — the C turns into place, then the two
// download halves pop out of its hole — and rewinds if the reader goes back.
import gsap from "gsap";
import { $$ } from "./util";

export function close() {
  const halves = $$(".close__half");
  gsap.set(halves, { scale: 0, autoAlpha: 0 });
  gsap.set("[data-close-copy] > *", { y: 24, autoAlpha: 0 });

  gsap
    .timeline({
      scrollTrigger: { trigger: "[data-close]", start: "top 60%", toggleActions: "play none none reverse" },
    })
    .fromTo("[data-close-ring]", { scale: 0.35, rotate: -200, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, ease: "power3.out", duration: 1.2 }, 0)
    // The two halves grow out of the hole's center, a beat apart.
    .to(halves, { scale: 1, autoAlpha: 1, duration: 0.55, stagger: 0.14, ease: "back.out(1.8)" }, 0.8)
    .to("[data-close-copy] > *", { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: "power2.out" }, 0.5);
}

export function closeStill() {
  gsap.set(".close__half, [data-close-copy] > *", { clearProps: "all" });
}
