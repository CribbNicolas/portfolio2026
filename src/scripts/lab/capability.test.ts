/**
 * Tests of `frameMeter`, the only part of `capability.ts` that decides
 * anything by measuring rather than by reading a browser flag.
 *
 * It is testable without a browser because it is pure: frames go in as
 * timestamps, a verdict comes out. `mayAttempt` is not tested here — it reads
 * `matchMedia` and `navigator`, which would need a fake DOM to say anything,
 * and what it does with those values is a list of thresholds, not logic.
 *
 * This file exists because of a real regression in judgement, not a
 * hypothetical one: the careful median needed 30 samples, and on a slow phone
 * those 30 frames cost ~2.4 s of blocked main thread — the probe was more
 * expensive than the animation it was deciding about. The panic path fixes
 * that, and the risk it introduces is the opposite mistake: shutting the
 * animation down on a device that was merely having a bad moment. Both
 * directions are asserted below.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  frameMeter,
  FRAME_BUDGET_MS,
  PROBE_FRAMES,
  PANIC_FRAME_MS,
  PANIC_STREAK,
} from "./capability";

/** Feeds deltas and returns every verdict, in order. */
function run(deltas: number[]): (boolean | null)[] {
  const measure = frameMeter();
  const out: (boolean | null)[] = [];
  let now = 0;
  // The first call only seeds the clock; it never returns a verdict.
  out.push(measure(now));
  for (const d of deltas) {
    now += d;
    out.push(measure(now));
  }
  return out;
}

test("a device that keeps up gets no verdict until the median is in", () => {
  const verdicts = run(Array(PROBE_FRAMES - 1).fill(16));
  assert.ok(
    verdicts.every((v) => v === null),
    "a fast device was judged before the probe finished",
  );
});

test("a device that keeps up passes", () => {
  const verdicts = run(Array(PROBE_FRAMES + 2).fill(16));
  assert.equal(verdicts.at(-1), true);
});

test("a device just over budget fails on the median, not on panic", () => {
  // 25 ms is over FRAME_BUDGET_MS and well under PANIC_FRAME_MS: the slow-but-
  // not-hopeless case the median exists for.
  const deltas = Array(PROBE_FRAMES + 2).fill(FRAME_BUDGET_MS + 5);
  const verdicts = run(deltas);
  assert.equal(verdicts.at(-1), false);
  // And it did NOT bail early: everything before the median was undecided.
  assert.ok(
    verdicts.slice(0, PROBE_FRAMES - 1).every((v) => v === null),
    "the panic path fired on frames that were only mildly slow",
  );
});

test("a hopeless device is judged long before 30 frames", () => {
  // THE test. Frames of 80 ms are what a Moto G Power produced; waiting for
  // the median there is 2.4 s of blocked main thread.
  const verdicts = run(Array(PROBE_FRAMES).fill(80));
  const decidedAt = verdicts.findIndex((v) => v === false);

  assert.ok(decidedAt !== -1, "a hopeless device was never shut down");
  assert.ok(
    decidedAt <= PANIC_STREAK + 1,
    `the verdict took ${decidedAt} frames; the point of the panic path is that ` +
      `it lands within ${PANIC_STREAK + 1}`,
  );
});

test("one long frame is not a verdict", () => {
  // A GC pause, a resize, a tab returning from the background. Shutting the
  // animation down over one of these misjudges a capable device.
  const deltas = [16, 16, PANIC_FRAME_MS * 4, 16, 16, 16];
  assert.ok(
    run(deltas).every((v) => v === null),
    "a single slow frame ended the probe",
  );
});

test("panic needs the frames to be CONSECUTIVE", () => {
  // Interleaving a good frame resets the streak. Without the reset, a device
  // that hitches every other frame but averages fine would be shut down.
  const deltas: number[] = [];
  for (let i = 0; i < PANIC_STREAK * 3; i++) deltas.push(PANIC_FRAME_MS * 2, 10);
  assert.ok(
    run(deltas).every((v) => v === null),
    "a non-consecutive run of slow frames triggered the panic path",
  );
});

test("the startup exemption is consumed once, not while samples is empty", () => {
  // The bug this pins: the exemption used to be `samples.length === 0`, which
  // on a device where EVERY frame is over the startup threshold never expired
  // — no sample was ever recorded, so no verdict was ever returned and the
  // animation ran forever on the worst hardware there is.
  const measure = frameMeter();
  let now = 0;
  measure(now);
  const verdicts: (boolean | null)[] = [];
  for (let i = 0; i < 8; i++) {
    now += 400; // every frame is "startup-shaped"
    verdicts.push(measure(now));
  }
  assert.ok(
    verdicts.includes(false),
    "a device at 400 ms per frame was never judged: the startup exemption never expired",
  );
});

test("the first frame is still exempt", () => {
  // Shader compilation and buffer uploads land in frame one. Measuring it
  // measures the startup, and at 300 ms it would otherwise start a panic
  // streak on every device.
  const verdicts = run([300, 16, 16, 16]);
  assert.ok(verdicts.every((v) => v === null), "the startup frame was counted");
});
