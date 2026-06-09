// Builds a tiny OFL subset of Noto Serif SC holding only the Han characters the
// Linguae card displays, so the repo never carries the full ~25 MB CJK font.
// The full font is fetched to scripts/fonts/.cache/ (gitignored) on demand and
// the ~3 KB subset (scripts/fonts/NotoSerifSC-subset.ttf) is committed.
//
// Re-run this only if you change the Han string on the card:
//   node scripts/make-cjk-subset.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS = join(__dirname, 'fonts');
const CACHE = join(FONTS, '.cache');
const FULL = join(CACHE, 'NotoSerifSC-full.ttf');
const OUT = join(FONTS, 'NotoSerifSC-subset.ttf');
const URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf';

// The exact Han characters used on the card. Keep in sync with gen-linguae.mjs.
export const CJK_CHARS = '文言';

mkdirSync(CACHE, { recursive: true });
if (!existsSync(FULL)) {
  console.log('Fetching Noto Serif SC (full, ~25 MB) to cache ...');
  const res = await fetch(URL);
  if (!res.ok) throw new Error('download failed: ' + res.status);
  writeFileSync(FULL, Buffer.from(await res.arrayBuffer()));
}

const full = opentype.loadSync(FULL);
const notdef = full.glyphs.get(0);
notdef.name = '.notdef';
const glyphs = [notdef];
for (const ch of CJK_CHARS) {
  const g = full.charToGlyph(ch);
  g.getPath(0, 0, full.unitsPerEm); // force composite resolution into an outline
  g.name = 'u' + ch.codePointAt(0).toString(16).toUpperCase();
  glyphs.push(g);
}

const sub = new opentype.Font({
  familyName: 'NotoSerifSCSubset',
  styleName: 'Regular',
  unitsPerEm: full.unitsPerEm,
  ascender: full.ascender,
  descender: full.descender,
  glyphs,
});
writeFileSync(OUT, Buffer.from(sub.toArrayBuffer()));

// Verify the written subset reloads and every char has a real outline.
const re = opentype.loadSync(OUT);
for (const ch of CJK_CHARS) {
  const g = re.charToGlyph(ch);
  const bb = g.getPath(0, 0, 40).getBoundingBox();
  if (g.index === 0 || (bb.x2 - bb.x1) < 0.1) throw new Error('subset verify failed for ' + ch);
}
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes) covering: ${CJK_CHARS}`);
