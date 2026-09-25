// Regenerates assets/opera-minora/*.jpg, the thumbnails in the README's
// Opera minora gallery. Run on demand only; scripts/tools.mjs finds sharp:
//
//   node scripts/make-opera-minora.mjs
//
// Source: each tool's own link-preview image (1200x630, docs/assets/og.png in
// its repo), fetched from GitHub, so a fresh clone can rebake these without
// any local master.
//
// Recipe: mount the screenshot on the card parchment like a print on a mat, a
// gold hairline just inside the edge and a faint gold-ink rule around the
// picture, the same plain vocabulary as the other cards (no rounded corners,
// no glow). JPEG at 640px wide: the gallery shows three to a row at roughly
// 260px, so this covers 2x displays, and the mat is opaque on purpose so the
// thumbnails read the same on GitHub's light and dark themes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { requireSharp } from './tools.mjs';
import { C } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharp = requireSharp();

// Order is the README's reading order, three to a row.
const TOOLS = ['horologium', 'planisphere', 'tracelens', 'errorbars', 'veil', 'splitscope'];

const W = 640;
const MAT = 14; // parchment border around the picture
const PIC_W = W - 2 * MAT;
const PIC_H = Math.round((PIC_W * 630) / 1200);
const H = PIC_H + 2 * MAT;

const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" fill="none" stroke="${C.gold}" stroke-width="1.5"/>
  <rect x="${MAT - 0.5}" y="${MAT - 0.5}" width="${PIC_W + 1}" height="${PIC_H + 1}" fill="none" stroke="${C.goldInk}" stroke-opacity="0.45" stroke-width="1"/>
</svg>`);

async function fetchOg(repo) {
  const url = `https://raw.githubusercontent.com/antonsoo/${repo}/main/docs/assets/og.png`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const outDir = join(__dirname, '..', 'assets', 'opera-minora');
mkdirSync(outDir, { recursive: true });

for (const repo of TOOLS) {
  const pic = await sharp(await fetchOg(repo)).resize(PIC_W, PIC_H, { fit: 'cover' }).toBuffer();
  const buf = await sharp({ create: { width: W, height: H, channels: 3, background: C.card } })
    .composite([
      { input: pic, left: MAT, top: MAT },
      { input: frame, left: 0, top: 0 },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  writeFileSync(join(outDir, `${repo}.jpg`), buf);
  console.log(`${repo}.jpg ${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB`);
}
