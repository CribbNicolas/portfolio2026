/**
 * The resolved English dataset, served as JSON.
 *
 * `public-api` surface: `resolveView` already removed the phone and the address.
 */

import type { APIRoute } from "astro";
import { content } from "@content";

export const GET: APIRoute = async () => {
  const view = await content.getView("public-api", "en");

  return new Response(JSON.stringify(view, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
