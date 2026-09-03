/**
 * `/en/cv.pdf` — the English CV printed on demand.
 *
 * Same layout, same handler, different locale: `../_handler.ts` holds the
 * whole implementation. This file's job is only to exist at THIS path, since
 * Pages routes by file location — see `functions/cv.pdf.ts` for the long
 * version of that comment.
 */

import { createPdfHandler } from "../_handler";

export const onRequestGet = createPdfHandler("en");

/** Same reasoning as `functions/cv.pdf.ts`'s `onRequestHead`. */
export const onRequestHead = onRequestGet;
