/**
 * The brief view's script: the reveal as you scroll, and the CV dialog
 * closing on a click or tap off its halves. The page is complete without it. (The background — the blurred, turning C with its parallax — is
 * CSS only, in brief.css.)
 *
 * The reveal is NOT tied to the scroll position (no scrub, no pin): a block
 * fades in once, the first time it enters the screen, and stays. With no
 * script nothing is hidden — the CSS only hides `[data-reveal]` once this file
 * has added `reveal-ready` to `<html>` — and with reduced motion the CSS
 * shows everything at once.
 *
 * Like everything in `src/scripts/`, nothing here imports `@content`.
 */

export function start(): void {
  reveal();
  dismissCvPick();
}

/**
 * The popover's own light dismiss closes it on a click OUTSIDE it, but the
 * dialog covers the whole screen, so every click lands inside. Anywhere but
 * a half (a download) or × (closes by itself) closes it, like the landing's.
 * Without the script, × and Esc still do.
 */
function dismissCvPick(): void {
  const pick = document.getElementById("cv-pick");
  pick?.addEventListener("click", (e) => {
    if (!(e.target as Element).closest(".close__half, .cvpick__x")) pick.hidePopover();
  });
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
