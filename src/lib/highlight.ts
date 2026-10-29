/**
 * Splits a sentence so the figures in it can be set apart: "~13.000",
 * "5 s", "500 ms", "7 MB", "v1.1.30", "29/10/2025".
 *
 * Presentation only. It derives nothing — the text and its numbers are the
 * dataset's, written once (invariant 3) — it only marks where the eye should
 * land first when the brief view is skimmed.
 *
 * Relative imports only, no `@content`: `tsx --test` runs this on its own.
 */

export interface Part {
  text: string;
  /** True for a figure: a number with its "~", version prefix or unit. */
  figure: boolean;
}

// A figure: optional "~" or "v", a digit, then digits and the separators
// numbers and dates use, then an optional unit glued or one space away.
// The unit needs a word boundary after it, so "19 specs" stops at "19".
// Never right after a letter: the "3" of "S3" is part of a name.
const FIGURE = /(?<![A-Za-z])(?:~|\bv)?\d[\d.,/]*\d?(?:\s?(?:ms|s|MB|KB|GB|%)\b)?/g;

/** A bare single digit ("Vue 3", "2 páginas") is a version or a count in
 *  passing, not the figure a reader scans for; with a mark or a unit it is. */
const isFigure = (s: string) => /\d\d|[~v%]|[a-zA-Z]$/.test(s);

export function splitFigures(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(FIGURE)) {
    const at = m.index ?? 0;
    // A trailing separator belongs to the sentence ("2025." ends a clause).
    const figure = m[0].replace(/[.,/]+$/, "");
    if (!isFigure(figure)) continue;
    if (at > last) parts.push({ text: text.slice(last, at), figure: false });
    parts.push({ text: figure, figure: true });
    last = at + figure.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), figure: false });
  return parts;
}
