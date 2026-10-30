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

/**
 * Words that must not end a line: every one-letter word, plus the articles,
 * prepositions and conjunctions of both locales that read as dangling at a
 * line's end ("Un mapa de / asientos", "…report: a / choropleth").
 */
const FUNCTION_WORDS = new Set([
  // es
  "de", "del", "en", "el", "la", "los", "las", "un", "una", "al", "con", "por", "que", "se", "su",
  // en
  "an", "the", "of", "in", "to", "at", "on", "by", "and", "or", "for",
]);

/**
 * Glues each function word to the word after it with a no-break space, so a
 * line never ends on one: "…the RPPL report: a / choropleth" becomes
 * "…report: / a choropleth". For short display copy (the landing's beats),
 * where a dangling short word shows; CSS `text-wrap` only guards the LAST
 * line. Presentation only: the dataset's text is not touched.
 *
 * A list, not "every word of two letters": that glued "Un mapa" and "de
 * asientos" into blocks too big for the column, and balancing them stranded
 * "dentro" on a line of its own (2026-10-29).
 */
export function glueShortWords(text: string): string {
  return text.replace(/(?<=^|\s)([\p{L}\p{N}]+) (?=\S)/gu, (whole, word: string) =>
    word.length === 1 || FUNCTION_WORDS.has(word.toLowerCase()) ? `${word}\u00A0` : whole,
  );
}

/**
 * For a heading: the function-word glue, plus its last two words held
 * together, so the last line always carries at least two ("The same / seats
 * everywhere.", never "The same seats / everywhere."), and, from four words
 * up, its first two, so it never opens on one word alone ("AsyncPile: one /
 * operation at a time."). `text-wrap: balance` evens the lines but happily
 * leaves one long word alone at either end.
 */
export function glueTitle(text: string): string {
  // Pieces between ordinary spaces; a piece with a no-break space inside
  // already holds two words or more.
  const NB = "\u00A0";
  let parts = glueShortWords(text).split(" ");
  const lone = (p: string | undefined) => p !== undefined && !p.includes(NB);
  if (parts.length >= 2 && lone(parts.at(-1))) {
    parts = [...parts.slice(0, -2), parts.at(-2) + NB + parts.at(-1)];
  }
  if (parts.length >= 3 && lone(parts[0])) {
    parts = [parts[0] + NB + parts[1], ...parts.slice(2)];
  }
  return parts.join(" ");
}

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
