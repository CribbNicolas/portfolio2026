/**
 * Version comparison. Pure functions, no I/O.
 *
 * It lives apart from `version-bump.check.ts` so the logic deciding whether a
 * bump is valid can be tested without a git repo around it.
 *
 * ONLY `major.minor.patch` with integers is accepted. No prereleases and no
 * metadata (`1.0.0-rc.1`, `1.0.0+build`): they are valid semver but would mean
 * nothing here — there is no prerelease channel and no numbered builds — and
 * accepting them would force defining how they order. If it is ever needed, it
 * gets added with an explicit ordering rule, not through parser sloppiness.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/** `null` when the string is not exactly `x.y.z` with non-negative integers. */
export function parse(text: string): Version | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** <0 when a precedes b, 0 when equal, >0 when a comes after. */
export function compare(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export type Bump = "major" | "minor" | "patch" | "irregular";

/**
 * What kind of jump there is between two versions.
 *
 * `irregular` is anything that goes up but is not ONE clean step: 0.1.0 →
 * 0.3.0, or 1.2.3 → 2.0.1. Not an error — sometimes you skip on purpose — but
 * it is the signature of a typo, so it is reported without blocking.
 */
export function bump(base: Version, next: Version): Bump {
  if (next.major === base.major + 1 && next.minor === 0 && next.patch === 0) return "major";
  if (next.major === base.major && next.minor === base.minor + 1 && next.patch === 0) {
    return "minor";
  }
  if (
    next.major === base.major &&
    next.minor === base.minor &&
    next.patch === base.patch + 1
  ) {
    return "patch";
  }
  return "irregular";
}

export interface Verdict {
  ok: boolean;
  /** Explains the failure, or describes the jump when it passes. Always printed. */
  reason: string;
}

/**
 * The hard rule: the new version has to be STRICTLY greater than the base
 * branch's.
 *
 * Equal is not enough. Two different merges into `staging` with the same number
 * mean "the version" stopped identifying what is deployed, which is the only
 * thing it is good for.
 */
export function checkBump(baseText: string, nextText: string): Verdict {
  const base = parse(baseText);
  const next = parse(nextText);

  if (!base) return { ok: false, reason: `the base branch version is not x.y.z: "${baseText}"` };
  if (!next) {
    return { ok: false, reason: `the package.json version is not x.y.z: "${nextText}"` };
  }

  const order = compare(next, base);
  if (order === 0) {
    return {
      ok: false,
      reason:
        `package.json is still at ${nextText}: this merge does not raise the version.\n` +
        `  Raise it in the same PR. patch for a fix, minor for something new,\n` +
        `  major when something that already existed changes shape.`,
    };
  }
  if (order < 0) {
    return {
      ok: false,
      reason: `package.json (${nextText}) is BEHIND the base branch (${baseText}): the version went down`,
    };
  }

  const kind = bump(base, next);
  if (kind === "irregular") {
    return {
      ok: true,
      reason:
        `${baseText} → ${nextText}: it goes up, but it is not a clean step.\n` +
        `  If that was on purpose, ignore this. If you expected another number, it is a typo.`,
    };
  }
  return { ok: true, reason: `${baseText} → ${nextText} (${kind})` };
}
