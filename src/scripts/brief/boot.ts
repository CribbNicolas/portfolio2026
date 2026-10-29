/**
 * The brief view's script: the animated background and the reveal as you
 * scroll. Both are decoration over a page that is complete without them.
 *
 * The reveal is NOT tied to the scroll position (no scrub, no pin): a block
 * fades in once, the first time it enters the screen, and stays. With no
 * script nothing is hidden — the CSS only hides `[data-reveal]` once this file
 * has added `reveal-ready` to `<html>` — and with reduced motion the CSS
 * shows everything at once.
 *
 * Like everything in `src/scripts/`, nothing here imports `@content`.
 */
import { mayAttempt } from "./capability";

export function start(): void {
  reveal();

  const field = document.querySelector<HTMLCanvasElement>("[data-field]");
  if (field && mayAttempt()) {
    // Behind the load event and an idle moment: the text is the page, the
    // background can wait until it is painted.
    afterLoad(() =>
      whenIdle(async () => {
        try {
          const { mountField } = await import("./field");
          const scene = await mountField(field);
          if (scene) addEventListener("pagehide", () => scene.destroy(), { once: true });
        } catch {
          /* The flat `--bg` is already underneath. */
        }
      }),
    );
  }
}

function reveal(): void {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (!blocks.length || !("IntersectionObserver" in window)) return;

  // Whatever is already on screen when the script runs stays as it is: the
  // first paint has happened, and fading it out to fade it back in is a
  // flicker, not an entrance.
  for (const el of blocks) {
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-in");
  }
  document.documentElement.classList.add("reveal-ready");

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const el of blocks) if (!el.classList.contains("is-in")) io.observe(el);
}

function afterLoad(fn: () => void): void {
  if (document.readyState === "complete") fn();
  else addEventListener("load", fn, { once: true });
}

function whenIdle(fn: () => void): void {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}
