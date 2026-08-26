/**
 * The Open Graph card: the HTML `public/og.jpg` comes from.
 *
 * A PURE function on purpose — it reads no files and opens no browser: it takes
 * already resolved texts and binaries already as `data:`. That keeps it
 * testable without Chromium and makes `build-og.ts` the only thing with I/O,
 * the same way `render-pdf.ts` relates to `build-pdf.ts`.
 *
 * Why a loose template and not a page in `src/pages/`: a page gets built, lands
 * in `dist/`, and the three checks walking `dist/` — `no-client-js`,
 * `bundle-budget`, `single-landing` — would have to learn to ignore it. An
 * exception inside a check is a permanent crack. It would also be an indexable
 * route that is not a destination, exactly what the single landing promises
 * does not exist.
 */

/**
 * 1200×630 is the 1.91:1 ratio Facebook, LinkedIn, WhatsApp, Slack and Discord
 * ask for, and also Twitter's `summary_large_image`. One image per platform is
 * NOT needed: they all read the same `og:image` tag, and what differs between
 * them is how they crop it, not which file they ask for.
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * The weight ceiling. WhatsApp does not get as far as showing the preview when
 * the image is too heavy, so this number is not tidiness: it is the difference
 * between the card appearing in a chat or not. That is why the file comes out
 * as JPEG and not PNG — with a photo inside, a PNG goes past 800 KB.
 */
export const OG_MAX_BYTES = 300 * 1024;

export interface OgData {
  /** `identity.fullName`. */
  name: string;
  /** `identity.brandTitle`. The kicker on top. */
  kicker: string;
  /** Role, seniority and city, already formatted with the contract helpers. */
  role: string;
  /** The photo as `data:`. Square; clipped to the circle. */
  photoDataUri: string;
  /** Manrope's `@font-face` rules with the fonts embedded as `data:`. */
  fontCss: string;
  /** The brand SVG, from `src/lib/brand.ts`. */
  brand: string;
}

// Tokens from `src/styles/tokens.css`, resolved by hand because this HTML does
// not go through the bundler and there is no cascade to inherit from. Always
// light mode: the card is rendered by each social network's server, not by
// anybody's browser, so there is no `prefers-color-scheme` to consult.
const BACKGROUND = "#f7f6f4";
const INK = "#17181c";
const SOFT = "#5f636e";
const ACCENT = "#b0472a";
const LINE = "#e5e3df";

/** The ring framing the photo. Same language as the brand: open on the right. */
const GAP = 24; // % of the perimeter
const PORTRAIT = 380;

function portrait(photoDataUri: string): string {
  const c = PORTRAIT / 2;
  const ringR = c - 12;
  const photoR = c - 30;
  const side = photoR * 2;
  return (
    `<svg width="${PORTRAIT}" height="${PORTRAIT}" viewBox="0 0 ${PORTRAIT} ${PORTRAIT}" aria-hidden="true">` +
    `<defs><clipPath id="clip"><circle cx="${c}" cy="${c}" r="${photoR}"/></clipPath></defs>` +
    `<image href="${photoDataUri}" x="${c - photoR}" y="${c - photoR}" width="${side}" height="${side}"` +
    ` clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice"/>` +
    // `pathLength=100` makes the gap measured as a percentage of the perimeter
    // rather than in units, and `rotate(gap * 1.8)` centers it exactly on the
    // right. The arithmetic is the same as the brand ring's.
    `<circle cx="${c}" cy="${c}" r="${ringR}" fill="none" stroke="${ACCENT}" stroke-width="14"` +
    ` stroke-linecap="round" pathLength="100" stroke-dasharray="${100 - GAP} ${GAP}"` +
    ` transform="rotate(${GAP * 1.8} ${c} ${c})"/>` +
    `</svg>`
  );
}

export function buildOgHtml(d: OgData): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
${d.fontCss}
* { box-sizing: border-box; margin: 0; }
body {
  width: ${OG_WIDTH}px;
  height: ${OG_HEIGHT}px;
  background: ${BACKGROUND};
  color: ${INK};
  font-family: "Manrope", system-ui, sans-serif;
  /* The same ligatures switched off as on the site: there is no parser reading
     them here, but a raster that differed from the HTML would be a surprise. */
  font-variant-ligatures: none;
  letter-spacing: -0.005em;
  display: flex;
  flex-direction: column;
  padding: 60px 68px;
}
.body { display: flex; flex: 1; align-items: center; gap: 52px; min-width: 0; }
.text { display: flex; flex-direction: column; gap: 18px; min-width: 0; flex: 1; }
/* The brand on top and alone: it does not carry the domain beside it, because
   every network already prints the host below the card and repeating it is noise. */
.brand { display: flex; margin-bottom: 10px; }
.kicker {
  font-size: 19px; font-weight: 800; letter-spacing: 0.13em;
  text-transform: uppercase; color: ${ACCENT};
}
.name {
  font-size: 76px; font-weight: 800; letter-spacing: -0.035em;
  line-height: 1.02; text-wrap: balance;
}
.role {
  font-size: 26px; font-weight: 400; color: ${SOFT}; line-height: 1.35;
  text-wrap: pretty; padding-top: 14px; border-top: 1px solid ${LINE};
}
.portrait { flex: none; display: flex; }
</style>
</head>
<body>
  <div class="body">
    <div class="text">
      <div class="brand">${d.brand}</div>
      <p class="kicker">${escapeHtml(d.kicker)}</p>
      <h1 class="name">${escapeHtml(d.name)}</h1>
      <p class="role">${escapeHtml(d.role)}</p>
    </div>
    <div class="portrait">${portrait(d.photoDataUri)}</div>
  </div>
</body>
</html>`;
}

/**
 * The side of the iOS icon. 180 is what the iPhone asks for at 3x, and the
 * single size Apple recommends declaring since iOS 8: it derives the rest.
 */
export const ICON_SIDE = 180;

/**
 * The iOS home screen icon.
 *
 * It exists apart from the favicon because Safari **does not accept SVG** for
 * `apple-touch-icon`: it has to be a bitmap. Without this file, saving the site
 * to the home screen gives an unreadable shrunken screenshot of the page
 * instead of an icon.
 *
 * It carries the COMPLETE brand — the ring with the N — and not only the ring:
 * there are 180 px here, four times what a favicon has, and at that size the
 * letters read fine. The "silhouette only" rule was about the 16 px, not about
 * taste.
 *
 * Opaque background and square corners on purpose: iOS applies its own rounded
 * mask and composites transparency over black, so rounding here leaves a odd
 * edge and leaving it transparent puts it on a black square.
 */
export function buildIconHtml(brand: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;width:${ICON_SIDE}px;height:${ICON_SIDE}px;background:${BACKGROUND};display:flex;align-items:center;justify-content:center">
${brand}
</body>
</html>`;
}

/** The texts come from the dataset, not from us: they can carry `&` or quotes. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
