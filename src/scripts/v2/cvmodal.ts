// SPIKE — "Descargar CV", from anywhere on the page: the close's C and its two
// halves (ESP / EN) are pulled up from the last section into the middle of
// the screen, over a dark scrim (author, 2026-10-28). If the close is on
// screen, the C leaves its own place; from anywhere else it rises from below,
// where that section is. Esc, a click outside or × sends it back.
//
// The links keep their href and `download`: without JS they download the
// Spanish PDF directly, as before.
import gsap from "gsap";
import { $, $$, holdScroll, releaseScroll } from "./util";

export function cvModal() {
  const modal = $("[data-cvmodal]");
  const scrim = $("[data-cvmodal-scrim]");
  const slot = $("[data-cvmodal-slot]");
  const kicker = $("[data-cvmodal-kicker]");
  const shut = $<HTMLButtonElement>("[data-cvmodal-close]");
  const source = $(".close__ringwrap");

  // The same C and halves as the close, copied once. Its data-* hooks are
  // stripped, so nothing that queries the close can grab the copy, and so
  // are the inline styles the close's own entrance left on it (hidden).
  const ring = source.cloneNode(true) as HTMLElement;
  [ring, ...Array.from(ring.querySelectorAll("*"))].forEach((n) => {
    n.getAttributeNames().filter((a: string) => a.startsWith("data-")).forEach((a: string) => n.removeAttribute(a));
    n.removeAttribute("style");
  });
  slot.append(ring);
  const halves = $$<HTMLAnchorElement>(".close__half", ring);
  const focusables: HTMLElement[] = [...halves, shut];

  let tl: gsap.core.Timeline | null = null;
  let opener: HTMLElement | null = null;
  let open = false;

  const show = (from: HTMLElement) => {
    if (open) return;
    open = true;
    opener = from;
    holdScroll();
    modal.hidden = false;
    gsap.set([ring, ...halves, kicker, shut], { clearProps: "transform,opacity,visibility" });

    // Where the C comes from: its own place if it is on screen, otherwise
    // straight up from below the screen — the direction of the last section.
    const to = ring.getBoundingClientRect();
    const at = source.getBoundingClientRect();
    const onScreen = at.bottom > 0 && at.top < innerHeight;
    const from_ = onScreen
      ? { x: at.left + at.width / 2, y: at.top + at.height / 2, scale: at.width / to.width }
      : { x: to.left + to.width / 2, y: innerHeight + to.height * 0.55, scale: 0.7 };
    const dx = from_.x - (to.left + to.width / 2);
    const dy = from_.y - (to.top + to.height / 2);
    if (onScreen) gsap.set(source, { visibility: "hidden" });

    tl = gsap
      .timeline({
        onComplete: () => halves[0].focus({ preventScroll: true }),
        onReverseComplete: () => {
          modal.hidden = true;
          gsap.set(source, { visibility: "visible" });
          releaseScroll();
          opener?.focus({ preventScroll: true });
          open = false;
        },
      })
      .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: "power1.out" }, 0)
      .fromTo(
        ring,
        { x: dx, y: dy, scale: from_.scale, rotate: onScreen ? 0 : -120 },
        { x: 0, y: 0, scale: 1, rotate: 0, duration: 1.0, ease: "power3.out" },
        0,
      )
      .fromTo(halves, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.12, ease: "back.out(1.8)" }, 0.75)
      .fromTo([kicker, shut], { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power2.out" }, 0.8);
  };

  const hide = () => {
    if (!open || !tl) return;
    // Back the way it came, a little quicker.
    tl.timeScale(1.6).reverse();
  };

  $$<HTMLElement>("[data-cv-open]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      show(a);
    }),
  );
  scrim.addEventListener("click", hide);
  shut.addEventListener("click", hide);
  // A half downloads its PDF (its own href + download), then the C goes back.
  halves.forEach((h) => h.addEventListener("click", () => setTimeout(hide, 450)));
  addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") return hide();
    // Keep the focus inside while it is open.
    if (e.key === "Tab") {
      const i = focusables.indexOf(document.activeElement as HTMLElement);
      const next = focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length];
      e.preventDefault();
      next.focus();
    }
  });
}
