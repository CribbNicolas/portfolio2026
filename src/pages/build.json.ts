/**
 * Which commit is published. It exists for one consumer: the smoke test.
 *
 * `smoke-deploy.yml` runs on a push to `staging` or `main`, but the push and
 * the deploy are not the same event: Cloudflare takes a minute or two. With no
 * way to ask "are you serving THIS commit yet?", the smoke would have to sleep
 * for a fixed while and cross its fingers — and would verify the previous
 * deploy every time the build ran long.
 *
 * Why it was needed: the original smoke listened for `deployment_status`,
 * assuming Pages created GitHub Deployments. It does not: it publishes a *check
 * run* called "Cloudflare Pages". The event never fired and the gate went weeks
 * without running once (technical debt §14).
 *
 * `CF_PAGES_COMMIT_SHA` is injected by Cloudflare into the build environment.
 * Locally it does not exist and `"local"` comes out, which is exactly what we
 * want to see if somebody points the smoke at a hand-served `dist/`.
 *
 * It carries NEITHER the `package.json` version NOR a timestamp. The version
 * because docs/08 §3 decided not to expose it while nothing consumes it, and
 * the smoke does not need it. The timestamp because it would make two builds of
 * the same commit produce different bytes, and build determinism is a property
 * this repo already protects elsewhere (`graph-layout.ts`).
 */

import type { APIRoute } from "astro";

/**
 * No cache header here, and not by oversight: with `output: "static"` Astro
 * prerenders this to a file and discards the `Response` headers. Pages sets
 * them, and for static assets it serves `max-age=0, must-revalidate` — verified
 * against the published site — so every request revalidates. The workflow also
 * appends a `?t=<epoch>` so it does not depend on that.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ commit: process.env.CF_PAGES_COMMIT_SHA ?? "local" }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
