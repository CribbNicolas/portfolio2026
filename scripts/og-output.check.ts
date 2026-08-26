/**
 * The social card: that it exists, that it fits the limits the platforms
 * impose, that it has not gone stale, and that the published HTML points at it.
 *
 * It exists because `public/og.jpg` is a COMMITTED artifact — generated with
 * `pnpm run og:local` and not in the build, because the Cloudflare builder has
 * no Chromium (docs/07 §18). A committed artifact drifts out of sync silently:
 * you change the role in the dataset, the site says one thing and the image
 * LinkedIn sees keeps saying the other. Nobody finds out until someone shares
 * the link.
 *
 * The name does NOT end in `.test.ts` on purpose: it needs a prior build to
 * look at `dist/`. Same reason as `pdf-output.check.ts` and
 * `single-landing.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { RING_PATH } from "../src/lib/brand";
import { PHOTO, fingerprint, ICON, IMAGE, LOCK, BRAND, TEMPLATE, ogTexts } from "./og-data";
import { ICON_SIDE, OG_HEIGHT, OG_WIDTH, OG_MAX_BYTES } from "./og-template";

const jpeg = await readFile(IMAGE);
const lock = JSON.parse(await readFile(LOCK, "utf8")) as {
  fingerprint: string;
  width: number;
  height: number;
  texts: Record<string, string>;
};
const landing = await readFile(join("dist", "index.html"), "utf8");

/**
 * The real width and height of the JPEG, read from the SOF marker.
 *
 * Parsed by hand rather than adding an image dependency: it is twenty lines,
 * and the precedent is `build-pdf.ts`, which starts its own server for the same
 * reason — "adding a dependency for this would be more maintenance surface than
 * the problem it solves".
 */
function measureJpeg(bin: Buffer): { width: number; height: number } {
  let i = 2; // skip SOI
  while (i < bin.length) {
    if (bin[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bin[i + 1];
    // The SOFs (C0–CF) carry the dimensions. C4, C8 and CC are not SOFs.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bin.readUInt16BE(i + 5), width: bin.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    i += 2 + bin.readUInt16BE(i + 2);
  }
  throw new Error(`${IMAGE} does not look like a JPEG: no SOF marker found.`);
}

test("the card measures 1200×630", () => {
  const { width, height } = measureJpeg(jpeg);
  // 1.91:1 is what Facebook, LinkedIn, WhatsApp, Slack and Discord ask for, and
  // also Twitter's `summary_large_image`. Outside that ratio each platform crops
  // on its own and the face ends up cut off in one of them.
  assert.equal(width, OG_WIDTH, `width ${width}, expected ${OG_WIDTH}`);
  assert.equal(height, OG_HEIGHT, `height ${height}, expected ${OG_HEIGHT}`);
});

test("the card fits WhatsApp's weight ceiling", () => {
  assert.ok(
    jpeg.byteLength <= OG_MAX_BYTES,
    `og.jpg weighs ${(jpeg.byteLength / 1024).toFixed(0)} KB and the ceiling is ${OG_MAX_BYTES / 1024} KB. ` +
      `Past that point WhatsApp does not show the preview: lower QUALITY in scripts/build-og.ts.`,
  );
});

test("the card has not gone stale: the fingerprint matches the dataset", async () => {
  const texts = await ogTexts();
  const photo = await readFile(PHOTO);
  const template = await readFile(TEMPLATE);
  const brand = await readFile(BRAND);

  assert.equal(
    fingerprint(texts, photo, template, brand),
    lock.fingerprint,
    "The dataset, the photo, the template or the brand changed, and the artifacts are still the old ones.\n" +
      "Run `pnpm run og:local` and commit og.jpg + apple-touch-icon.png together with og.lock.json.",
  );
});

test("the card texts come from the dataset", async () => {
  // The fingerprint matching is not enough: if someone edits the lock by hand
  // to silence the previous test, this catches it again against the real source.
  assert.deepEqual(lock.texts, await ogTexts());
});

test("the landing publishes an absolute og:image with its dimensions", () => {
  // Absolute and not relative: no scraper resolves relative paths, and an
  // `og:image` that cannot be fetched is the same as having none.
  const image = landing.match(/<meta property="og:image" content="([^"]+)"/);
  assert.ok(image, "og:image missing from the landing");
  assert.match(image[1], /^https?:\/\/\S+\/og\.jpg$/, `og:image is not absolute: ${image[1]}`);

  // LinkedIn and Slack reserve the space with these two before downloading the
  // image. Without them the card jumps size once it finishes loading.
  assert.match(landing, new RegExp(`<meta property="og:image:width" content="${OG_WIDTH}"`));
  assert.match(landing, new RegExp(`<meta property="og:image:height" content="${OG_HEIGHT}"`));
  assert.match(landing, /<meta property="og:image:alt" content="[^"]+"/, "og:image with no alt");
});

test("Twitter asks for the large card, not the small one", () => {
  // `summary` reserves a small square beside the text. Now that there is a
  // 1.91:1 image, the right one is `summary_large_image`: left on `summary`,
  // Twitter would crop the card into a little square.
  assert.match(landing, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(landing, /<meta name="twitter:image" content="https?:\/\/\S+\/og\.jpg"/);
});

test("/cv still emits no social tags", async () => {
  // The `Base.astro` opt-in already covers this, and so does
  // `single-landing.check.ts`, but the image is new: if someone adds it as a
  // layout default, /cv would become shareable without anybody deciding it.
  const cv = await readFile(join("dist", "cv", "index.html"), "utf8");
  assert.doesNotMatch(cv, /og:image/, "/cv emits og:image and should not");
});

test("the iOS icon exists, is a PNG and measures 180×180", async () => {
  // Safari does NOT accept SVG for `apple-touch-icon`. Without this bitmap,
  // saving the site to the home screen does not give an icon: it gives an
  // unreadable shrunken screenshot of the page.
  const png = await readFile(ICON);
  // The PNG signature. If someone replaces it with a renamed JPEG, iOS does not
  // show it and the file extension gives nothing away.
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${ICON} is not a PNG`);
  // The IHDR starts at byte 8 and carries width and height as 32-bit integers.
  assert.equal(png.readUInt32BE(16), ICON_SIDE);
  assert.equal(png.readUInt32BE(20), ICON_SIDE);
});

test("every page declares the iOS icon and the chrome color", async () => {
  const pages = [
    ["landing", landing],
    ["/cv", await readFile(join("dist", "cv", "index.html"), "utf8")],
    ["404", await readFile(join("dist", "404.html"), "utf8")],
  ] as const;

  for (const [name, html] of pages) {
    assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/, `${name}: no apple-touch-icon`);
    // Two tags and not one: the site has a dark mode, and with a single value
    // the system bar ends up light over a dark page or the other way around.
    assert.match(html, /name="theme-color" content="#ffffff"/, `${name}: no light theme-color`);
    assert.match(html, /name="theme-color" content="#131417"/, `${name}: no dark theme-color`);
  }
});

test("the favicon draws the same ring as src/lib/brand.ts", async () => {
  // The favicon is a static file: it cannot import the module, so its `d=` is
  // the only copy of that geometry outside `brand.ts`. This is what keeps them
  // from separating — you adjust the curve on one side and the tab icon keeps
  // the old one forever.
  const favicon = await readFile("public/favicon.svg", "utf8");
  assert.ok(
    favicon.includes(RING_PATH),
    "public/favicon.svg does not draw the ring from src/lib/brand.ts. Copy RING_PATH there.",
  );
});

test("the favicon parses as XML", async () => {
  // An SVG loaded as an image is parsed as STRICT XML, and XML forbids two
  // consecutive hyphens inside a comment. When it happens there is no visible
  // error anywhere: no console, no 404, the file is served with a 200 and the
  // icon simply does not appear. That already happened once, from writing the
  // custom property names inside a comment.
  const favicon = await readFile("public/favicon.svg", "utf8");
  for (const comment of favicon.match(/<!--[\s\S]*?-->/g) ?? []) {
    assert.ok(
      !comment.slice(4, -3).includes("--"),
      "There is a comment with two consecutive hyphens in public/favicon.svg.\n" +
        "XML forbids it and the favicon silently stops rendering.",
    );
  }
});
