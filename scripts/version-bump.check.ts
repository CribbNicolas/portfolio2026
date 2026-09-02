/**
 * Gate: every PR entering `develop` has to raise the `package.json` version.
 *
 * `package.json` is the ONLY source of truth for versioning (docs/08). That
 * claim only holds while the number changes when the code changes, and that is
 * not sustained by discipline: it is sustained by a check that breaks the PR.
 *
 * Versioning happens at `develop` because that is where each change enters one
 * at a time. The `develop` → `staging` → `main` PRs carry the number along,
 * they do not touch it.
 *
 * The bump is done BY HAND, in the same PR. Choosing between patch, minor and
 * major is a semantic decision about what changed for whoever consumes the
 * site, and a machine looking at diffs cannot make it well. What the machine
 * can do is not let you forget.
 *
 * It is not a `*.test.ts`: it needs the git repo with the base branch
 * available, so it cannot run in anybody's `pnpm test`. The pure logic that can
 * lives in `version.ts` and is tested in `version.test.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkBump } from "./version";

/**
 * The branch to compare against. In CI the workflow sets it from
 * `github.base_ref`; locally the default is enough to check before opening the
 * PR.
 */
const BASE = process.env.VERSION_BASE_REF ?? "origin/develop";

function versionOf(json: string): string {
  const v = JSON.parse(json).version;
  assert.equal(typeof v, "string", "package.json declares no version");
  return v;
}

function versionOnBase(): string {
  try {
    const json = execFileSync("git", ["show", `${BASE}:package.json`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return versionOf(json);
  } catch (e) {
    // The most likely failure mode is not a bug in the check: it is the base
    // branch not being fetched. Saying so with the exact command saves the time
    // spent reading the check's code looking for an error that is not there.
    throw new Error(
      `could not read package.json from "${BASE}".\n` +
        `  If you are local: git fetch origin ${BASE.replace(/^origin\//, "")}\n` +
        `  Original cause: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

test("the merge raises the package.json version", () => {
  const base = versionOnBase();
  const next = versionOf(readFileSync("package.json", "utf8"));

  const { ok, reason } = checkBump(base, next);
  // Printed pass or fail: when it passes, the PR log ends up saying which
  // version is being published, which is exactly what you want to see there.
  console.log(`version: ${reason}`);
  assert.ok(ok, reason);
});
