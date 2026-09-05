/**
 * Can this device run the animation?
 *
 * Four steps, and only the third one actually measures. Steps 1 and 2 are
 * browser signals; step 3 is the clock.
 *
 * Why the distinction matters: on iOS `saveData`, `effectiveType` and
 * `deviceMemory` do NOT exist — they are Chromium APIs. A guard leaning only on
 * them is deciding blind on half the phones out there. Measuring the frame is
 * the only thing that works everywhere.
 */

/** Median frame time above which it shuts down. 20 ms ≈ 50 fps. */
export const FRAME_BUDGET_MS = 20;
/** How many frames get measured before deciding. At 60 fps, half a second. */
export const PROBE_FRAMES = 30;

/**
 * A frame this slow is not a hiccup, it is an answer. 50 ms is 2.5x the budget
 * and under 20 fps.
 */
export const PANIC_FRAME_MS = 50;

/**
 * How many consecutive panic frames end the probe early.
 *
 * Three and not one: a single frame that long is a garbage collection, a
 * `resize`, or the tab coming back from the background, and shutting the
 * animation down over one of those would misjudge a device that is perfectly
 * capable. Three in a row is the device.
 */
export const PANIC_STREAK = 3;

/**
 * A first frame longer than this is startup — shader compilation and buffer
 * uploads — and is discarded rather than measured. Exactly one frame is ever
 * discarded this way.
 */
export const STARTUP_FRAME_MS = 100;

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** Step 1: decided before a single byte of the 3D chunk is downloaded. */
export function mayAttempt(): boolean {
  if (typeof window === "undefined") return false;

  // A continuous animation is not optional for someone who asked for less
  // motion.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  // Without WebGL2 there is nothing to attempt. The global constructor is
  // checked rather than creating a probe context: creating contexts costs, and
  // there is a per-page cap.
  if (typeof WebGL2RenderingContext === "undefined") return false;

  const nav = navigator as ExtendedNavigator;

  // Data saver mode: downloading ~150 KB for decoration is exactly what the
  // user asked not to happen.
  if (nav.connection?.saveData === true) return false;

  const network = nav.connection?.effectiveType;
  if (network === "slow-2g" || network === "2g" || network === "3g") return false;

  // These two exist only in Chromium. `undefined` is NOT a reason to block: if
  // I do not know, I let step 3 measure.
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return false;
  if (navigator.hardwareConcurrency <= 2) return false;

  return true;
}

/**
 * Step 3: measures the first frames and reports if it does not keep up. The
 * caller shuts things down.
 *
 * Returns a function to call on every frame. While it collects samples it
 * returns `null`; once done it returns `true` (keep going) or `false` (shut
 * down). Shutting down is invisible: the SVG has been painted underneath since
 * the first byte.
 *
 * TWO verdicts, not one, and the second one exists because the first was
 * expensive on exactly the devices it was written to protect.
 *
 * The median over `PROBE_FRAMES` is the careful answer: it needs 30 samples,
 * which on a capable device is half a second and costs nothing. On a slow one
 * each of those frames is 70-100 ms, so the probe spent ~2.4 s of main thread
 * to conclude the device could not afford the animation — measured on a Moto G
 * Power through PageSpeed Insights on 2026-09-04: twenty long tasks, all of
 * them this loop, and 1,140 ms of total blocking time. The measurement cost
 * more than what it was measuring.
 *
 * So a streak of `PANIC_STREAK` frames over `PANIC_FRAME_MS` answers
 * immediately. It is deliberately a streak and a high threshold: one long
 * frame is a GC, a resize, or a tab returning from the background, and a
 * device that produces three of those in a row is not having a bad moment.
 *
 * On a device that keeps up, nothing about this changes — the streak never
 * reaches three and the median decides exactly as before.
 */
export function frameMeter(): (now: number) => boolean | null {
  const samples: number[] = [];
  let previous = 0;
  let panicStreak = 0;
  let startupFrameSeen = false;

  return (now: number) => {
    if (previous === 0) { previous = now; return null; }
    const delta = now - previous;
    previous = now;

    // The first frame after mounting includes shader compilation and buffer
    // uploads. Measuring it would measure the startup, not the steady state.
    //
    // Consumed ONCE, tracked by its own flag. The condition used to be
    // `samples.length === 0`, which is the same thing only while frames are
    // fast: on a device where EVERY frame is over the startup threshold, no
    // sample was ever recorded, so the exemption never expired and the meter
    // never returned a verdict at all. The animation ran forever on exactly
    // the hardware this whole file exists to protect. Found by the test below,
    // not in production.
    if (!startupFrameSeen) {
      startupFrameSeen = true;
      if (delta > STARTUP_FRAME_MS) return null;
    }

    samples.push(delta);

    // Checked BEFORE the sample count: the whole point is not waiting for 30.
    panicStreak = delta > PANIC_FRAME_MS ? panicStreak + 1 : 0;
    if (panicStreak >= PANIC_STREAK) return false;

    if (samples.length < PROBE_FRAMES) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    return median <= FRAME_BUDGET_MS;
  };
}
