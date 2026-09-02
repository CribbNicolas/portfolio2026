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
 */
export function frameMeter(): (now: number) => boolean | null {
  const samples: number[] = [];
  let previous = 0;

  return (now: number) => {
    if (previous === 0) { previous = now; return null; }
    const delta = now - previous;
    previous = now;

    // The first frame after mounting includes shader compilation and buffer
    // uploads. Measuring it would measure the startup, not the steady state.
    if (samples.length === 0 && delta > 100) return null;

    samples.push(delta);
    if (samples.length < PROBE_FRAMES) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    return median <= FRAME_BUDGET_MS;
  };
}
