// Regenerates assets/praviel-screens.jpg, the strip of app screens in the
// README's PRAVIEL section. Run on demand only; scripts/tools.mjs finds sharp:
//
//   node scripts/make-praviel-screens.mjs
//
// Source: PRAVIEL's own storefront screens, the Google Play en-US phone
// screenshots that praviel.com serves on its home page (praviel-website
// lib/storefront.ts, public/storefront/en/). Fetched from praviel.com, so a
// fresh clone can rebake the strip without the website checkout, and so the
// profile only ever shows a screen the product already shows the public.
//
// Which four: a language to choose, a word card, a conversation partner, and
// a real text, in the order a learner meets them. Four fill one row; the
// product tour on praviel.com has the rest.
//
// Recipe: the same mat as the Open source thumbnails (make-opera-minora.mjs),
// one sheet instead of four files so the row keeps its proportions on a phone
// and costs one request. 1600px wide: the README column is about 850 CSS
// pixels, so this covers 2x displays. Opaque parchment, so it reads the same
// on GitHub's light and dark themes.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { requireSharp } from './tools.mjs';
import { C } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharp = requireSharp();

// Order is reading order, left to right.
const SCREENS = ['choose-language', 'learn-words', 'conversations', 'reader'];
const SOURCE_W = 800; // one of the widths the site serves: 320, 480, 640, 800, 1080
const SOURCE_RATIO = 1920 / 1080;

const W = 1600;
const MAT = 16; // parchment border around the sheet
const GAP = 12; // parchment between two screens
const PIC_W = Math.floor((W - 2 * MAT - (SCREENS.length - 1) * GAP) / SCREENS.length);
const PIC_H = Math.round(PIC_W * SOURCE_RATIO);
const H = PIC_H + 2 * MAT;
const left = (i) => MAT + i * (PIC_W + GAP);

const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" fill="none" stroke="${C.gold}" stroke-width="1.5"/>
  ${SCREENS.map((_, i) => `<rect x="${left(i) - 0.5}" y="${MAT - 0.5}" width="${PIC_W + 1}" height="${PIC_H + 1}" fill="none" stroke="${C.goldInk}" stroke-opacity="0.45" stroke-width="1"/>`).join('\n  ')}
</svg>`);

async function fetchScreen(id) {
  const url = `https://praviel.com/storefront/en/${id}-${SOURCE_W}.webp`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const pictures = [];
for (const [i, id] of SCREENS.entries()) {
  const input = await sharp(await fetchScreen(id)).resize(PIC_W, PIC_H, { fit: 'cover' }).toBuffer();
  pictures.push({ input, left: left(i), top: MAT });
}

const buf = await sharp({ create: { width: W, height: H, channels: 3, background: C.card } })
  .composite([...pictures, { input: frame, left: 0, top: 0 }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

const out = join(__dirname, '..', 'assets', 'praviel-screens.jpg');
writeFileSync(out, buf);
console.log(`praviel-screens.jpg ${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB (${SCREENS.join(', ')})`);
