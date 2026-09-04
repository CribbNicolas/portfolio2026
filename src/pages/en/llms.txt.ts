/**
 * A markdown summary for agents (docs/04 §3). English.
 *
 * Same renderer as `/llms.txt`, different locale. Two URLs, no content
 * negotiation — the same pair as the PDFs.
 */

import type { APIRoute } from "astro";
import { content } from "@content";
import { renderLlmsTxt } from "../../lib/llms-txt";

export const GET: APIRoute = async ({ site }) => {
  const locale = "en" as const;
  const view = await content.getView("public-api", locale);
  const base = site?.toString().replace(/\/$/, "") ?? "";

  return new Response(renderLlmsTxt(view, locale, base), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
