/**
 * The inertia of the floating bar.
 *
 * The bar is already fixed and usable without this script: all it adds is
 * weight while scrolling. It is decoration, which is why it lives behind a
 * `prefers-reduced-motion` guard and never touches the DOM beyond a
 * `transform`.
 *
 * The model is a **damped spring**, not an interpolation. An exponential lerp
 * (`current += (target - current) * k`) only knows how to slow down: it
 * approaches the destination and never passes it, and the eye reads that as
 * lag, not as mass. An underdamped spring overshoots and comes back, which is
 * what a weighted object hanging off something moving does.
 *
 * The bar is the mass; scroll velocity is what pulls on it. When scrolling
 * stops the pull disappears, the spring brings it back and lets it swing once
 * before settling.
 *
 * Two details that are the difference between "smooth" and "clumsy":
 *
 * 1. **Fixed timestep.** The physics runs at 60 Hz off an accumulator, not once
 *    per frame. With a variable step, the same spring constant gives one motion
 *    on a 60 Hz monitor and a different one on a 120 Hz — and a long frame can
 *    make the simulation unstable.
 * 2. **Scroll velocity is smoothed before it enters.** Scroll events arrive in
 *    bursts: the raw measurement jumps between 0 and 80 px from one frame to
 *    the next, and feeding the spring that puts the noise inside it.
 *
 * Imports nothing from `@content` (rule 1 of the map frontend).
 */

/** The simulation step. 60 Hz, independent of the screen's refresh rate. */
const STEP_MS = 1000 / 60;

/**
 * How hard the spring pulls toward the target, per step. Lower = heavier and
 * slower to react.
 */
const STIFFNESS = 0.055;

/**
 * How much velocity it keeps per step. This is what decides whether it swings:
 * 1 = swings forever, ~0.7 = stops without overshooting. 0.88 leaves exactly
 * one visible overshoot, which is what reads as mass.
 */
const DAMPING = 0.88;

/** Pixels of offset per pixel/step of scroll velocity. */
const AMPLITUDE = 0.35;

/** How much the measured velocity is averaged. Lower = smoother and later. */
const SMOOTHING = 0.22;

/** Offset ceiling. Without it, a fast wheel scroll throws it off screen. */
const MAX_PX = 22;

/** Below this there is nothing to see: the settle countdown starts. */
const STILL_PX = 0.05;

/**
 * Still steps before the loop shuts off. Not zero: a scroll with inertia has
 * micro-pauses, and shutting off on the first one makes the next frame start
 * with a jump.
 */
const STILL_STEPS = 12;

/**
 * Delta ceiling. A tab returning from the background brings a `dt` of seconds:
 * with no cap the accumulator would run hundreds of steps at once and the bar
 * would jump instead of picking up.
 */
const DT_MAX_MS = 100;

export function followScroll(el: HTMLElement): void {
  // It is ornament: for anyone who asked for less motion, the bar stays still.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let previousScroll = scrollY;
  /** Scroll velocity in px per step, already smoothed. This is what pulls. */
  let pull = 0;

  /** Position and velocity of the mass. */
  let y = 0;
  let vy = 0;

  let previous = 0;
  let accumulated = 0;
  let stillSteps = 0;
  let running = false;

  const step = (): void => {
    const target = Math.max(-MAX_PX, Math.min(MAX_PX, -pull * AMPLITUDE));
    // Spring: accelerates toward the target and loses a fraction to friction.
    vy += (target - y) * STIFFNESS;
    vy *= DAMPING;
    y += vy;

    if (Math.abs(y) < STILL_PX && Math.abs(vy) < STILL_PX && Math.abs(pull) < STILL_PX) {
      stillSteps += 1;
    } else {
      stillSteps = 0;
    }
  };

  const frame = (now: number): void => {
    const dt = Math.min(now - previous, DT_MAX_MS);
    previous = now;

    // One sample per frame, normalized to a 60 Hz step so velocity means the
    // same thing on any screen.
    const raw = dt > 0 ? ((scrollY - previousScroll) * STEP_MS) / dt : 0;
    previousScroll = scrollY;
    pull += (raw - pull) * SMOOTHING;

    accumulated = Math.min(accumulated + dt, DT_MAX_MS);
    while (accumulated >= STEP_MS) {
      step();
      accumulated -= STEP_MS;
    }

    if (stillSteps >= STILL_STEPS) {
      // Back to the CSS `transform` instead of leaving a translate3d of 0: that
      // way the bar does not sit in its own layer with nothing to animate.
      y = 0;
      vy = 0;
      el.style.transform = "";
      running = false;
      return;
    }

    el.style.transform = `translate3d(-50%, ${y.toFixed(2)}px, 0)`;
    requestAnimationFrame(frame);
  };

  addEventListener(
    "scroll",
    () => {
      stillSteps = 0;
      if (running) return;
      running = true;
      // Start the clock and the reference here: otherwise the first `dt` would
      // be the time since the last scroll — minutes, maybe — and the first
      // frame would measure an absurd velocity.
      previous = performance.now();
      previousScroll = scrollY;
      accumulated = 0;
      requestAnimationFrame(frame);
    },
    { passive: true },
  );
}
