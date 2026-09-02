/**
 * Tests of the version comparison.
 *
 * Runs in `pnpm test` because it needs neither a build nor a git repo: the
 * logic deciding whether a bump is valid is pure, and that was the reason for
 * splitting it out of `version-bump.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, bump, checkBump } from "./version";

test("parse accepts x.y.z and nothing else", () => {
  assert.deepEqual(parse("1.2.3"), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parse("  0.1.0 "), { major: 0, minor: 1, patch: 0 });

  // Valid semver, rejected here on purpose: there is no prerelease channel and
  // no numbered builds, so accepting them would force defining how they order.
  assert.equal(parse("1.0.0-rc.1"), null);
  assert.equal(parse("1.0.0+build.5"), null);
  assert.equal(parse("1.2"), null);
  assert.equal(parse("v1.2.3"), null);
  assert.equal(parse(""), null);
});

test("the bump has to go up", () => {
  assert.equal(checkBump("0.1.0", "0.2.0").ok, true);
  assert.equal(checkBump("0.1.0", "0.1.1").ok, true);
  assert.equal(checkBump("0.9.0", "1.0.0").ok, true);
});

test("the same version fails: it is the case the gate exists to catch", () => {
  const v = checkBump("0.2.0", "0.2.0");
  assert.equal(v.ok, false);
  assert.match(v.reason, /does not raise the version/);
});

test("lowering the version fails", () => {
  const v = checkBump("0.3.0", "0.2.0");
  assert.equal(v.ok, false);
  assert.match(v.reason, /BEHIND/);
});

test("a malformed version fails, quoting the text that caused it", () => {
  const v = checkBump("0.1.0", "0.2");
  assert.equal(v.ok, false);
  assert.match(v.reason, /"0\.2"/);
});

test("classifying the jump: one clean step of each kind", () => {
  assert.equal(bump({ major: 0, minor: 1, patch: 0 }, { major: 0, minor: 1, patch: 1 }), "patch");
  assert.equal(bump({ major: 0, minor: 1, patch: 5 }, { major: 0, minor: 2, patch: 0 }), "minor");
  assert.equal(bump({ major: 0, minor: 9, patch: 2 }, { major: 1, minor: 0, patch: 0 }), "major");
});

test("an irregular jump passes but says so", () => {
  // 0.1.0 → 0.3.0 goes up, so it does not block. But it is the signature of a
  // typo (you meant 0.2.0), and staying quiet would be worse than over-warning.
  const v = checkBump("0.1.0", "0.3.0");
  assert.equal(v.ok, true);
  assert.match(v.reason, /not a clean step/);
});

test("a minor that does not reset the patch is irregular", () => {
  assert.equal(bump({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 3, patch: 4 }), "irregular");
});
