/**
 * Content entry point.
 *
 * THIS is the only line that changes when you migrate to Sanity or to your own
 * backend. The whole frontend imports from here, never from `json-source`
 * directly.
 */

import { JsonContentSource } from "./json-source";
import type { ContentSource } from "../schema/content-schema";

export const content: ContentSource = new JsonContentSource();

export * from "../schema/content-schema";

// The output contract travels with the content: whoever consumes data also
// needs to turn it into text without reimplementing rules 1, 2 and 4. That way
// `src/` imports EVERYTHING from one place and invariant 2 stays true.
export * from "../schema/format";
export * from "../schema/format-metric";
// How the skills are grouped and ordered. Shared by the CV and `/llms.txt`,
// which used to keep two lists that drifted apart.
export * from "../schema/skill-groups";

// The graph is another view derived from the same content, same as formatting.
// It runs ONLY at build time (page frontmatter): none of this reaches the
// browser.
export * from "../schema/knowledge-graph";
export * from "../schema/graph-layout";

// The PDF's file name is text derived from the data, same as a duration.
// `functions/` imports it directly: a Worker has no `@content` alias.
export * from "../schema/pdf-filename";
