/**
 * El dataset resuelto, servido como JSON. Para agentes y para cualquiera que
 * quiera consumir estos datos sin scrapear HTML.
 *
 * Superficie `public-api`: `resolveView` ya sacó el teléfono y la dirección.
 */

import type { APIRoute } from "astro";
import { content } from "@content";

export const GET: APIRoute = async () => {
  const view = await content.getView("public-api", "es");

  return new Response(JSON.stringify(view, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
