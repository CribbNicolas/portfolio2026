/**
 * A markdown summary for agents (docs/04 §3). Spanish.
 *
 * Generated from the dataset: writing it by hand guarantees that in three
 * months it says something different from the CV.
 */

import type { APIRoute } from "astro";
import { content } from "@content";
import { renderLlmsTxt } from "../lib/llms-txt";

export const GET: APIRoute = async ({ site }) => {
  const locale = "es" as const;
  const view = await content.getView("public-api", locale);
  const base = site?.toString().replace(/\/$/, "") ?? "";

  return new Response(renderLlmsTxt(view, locale, base), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
