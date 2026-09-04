/**
 * Forces a re-render of the published PDFs. `pnpm run pdf:refresh`.
 *
 * The edge keeps a rendered PDF for thirty days (`functions/_pdf.ts`), and its
 * key carries the deployed commit, so a dataset edit busts it on deploy with
 * nobody doing anything. This exists for the other case: the bytes are wrong
 * and the deploy that would fix them is not coming — a font that failed to
 * load during the render, a Browser Rendering hiccup that got cached, a change
 * on the source page that shipped in the same commit as the cached PDF.
 *
 * Not a *.check.ts and not a test: it CHANGES production. It is run by hand.
 *
 * Two things it does that a bare `curl` does not, both learned the hard way on
 * 2026-09-04:
 *
 *  - It spaces the two locales apart. Browser Rendering rate-limits bursts (3
 *    concurrent browsers, a new instance every 20 s); firing both at once
 *    answers 429 for the second one, and a 429 arrives fast enough to look
 *    like success in a script that only checks for a 200.
 *  - It tells a real re-render from a silent no-op. A wrong token is IGNORED
 *    exactly like `?utm_source=` — by design, so a probe cannot tell the
 *    parameter exists — which means it answers 200 from cache. Fast and 200
 *    is the failure, not the success, and it is the one a person cannot see.
 */

import { argv, env, exit, loadEnvFile } from "node:process";

/** Where the render stops being plausible and starts being a cache hit. */
const RENDER_FLOOR_MS = 1500;
/** A new Browser Rendering instance every 20 s. 25 leaves margin. */
const SPACING_MS = 25_000;
/** One retry is worth it: the burst limit clears in seconds. */
const RETRY_WAIT_MS = 30_000;

const DEFAULT_SITE = "https://cribbnicolas.pages.dev";

try {
  loadEnvFile(".env");
} catch {
  // No `.env` is fine — CI and any shell that exports the variable directly.
}

const token = env.PDF_REFRESH_TOKEN;
if (!token) {
  console.error(
    "PDF_REFRESH_TOKEN is missing.\n" +
      "  Put it in `.env` (never committed) with the SAME value configured in\n" +
      "  Cloudflare Pages → Settings → Variables and Secrets → Production.\n" +
      "  Different values are the silent failure this script is built to catch:\n" +
      "  the request succeeds, the PDF is not re-rendered.",
  );
  exit(1);
}

const site = (argv[2] ?? env.SITE ?? DEFAULT_SITE).replace(/\/+$/, "");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Attempt {
  status: number;
  ms: number;
  bytes: number;
}

async function hit(path: string): Promise<Attempt> {
  const url = `${site}${path}?refresh=${encodeURIComponent(token!)}`;
  const started = Date.now();
  const res = await fetch(url);
  const bytes = (await res.arrayBuffer()).byteLength;
  return { status: res.status, ms: Date.now() - started, bytes };
}

/** Returns true when the PDF was really re-rendered. */
async function refresh(path: string): Promise<boolean> {
  let a = await hit(path);

  if (a.status === 429) {
    console.log(`  ${path}  429, the burst limit. Waiting ${RETRY_WAIT_MS / 1000}s and retrying once.`);
    await sleep(RETRY_WAIT_MS);
    a = await hit(path);
  }

  if (a.status !== 200) {
    console.error(`  ${path}  FAILED: ${a.status} after ${a.ms} ms`);
    return false;
  }

  if (a.ms < RENDER_FLOOR_MS) {
    console.error(
      `  ${path}  answered 200 in ${a.ms} ms — too fast to be a render, so this came\n` +
        "        from the cache and NOTHING was refreshed. The token in `.env` does not\n" +
        "        match the one in the Pages project (a wrong token is ignored on purpose).",
    );
    return false;
  }

  console.log(`  ${path}  re-rendered: ${a.bytes} bytes in ${(a.ms / 1000).toFixed(1)} s`);
  return true;
}

console.log(`Refreshing the PDFs at ${site}`);
console.log("Each locale is one Browser Rendering call. This is a repair tool, not a cron job.\n");

const es = await refresh("/cv.pdf");
await sleep(SPACING_MS);
const en = await refresh("/en/cv.pdf");

if (!es || !en) {
  console.error("\nSomething did not refresh. Nothing was broken by trying: the old bytes stay served.");
  exit(1);
}
console.log("\nBoth PDFs re-rendered and stored. The next visitor gets the new bytes from cache.");
