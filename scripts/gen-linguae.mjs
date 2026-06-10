// Renders assets/linguae.svg: the "Linguae" card. Each language PRAVIEL teaches
// is shown in its OWN native script, baked to vector paths so every script
// renders identically everywhere (no font dependency at view time).
//
// Two rendering paths feed the same vector output:
//   - opentype.js (svglib.layoutLine) for scripts that need no shaping: Latin,
//     Greek, Cyrillic (Church Slavonic), the Han subset (Classical Chinese), and
//     the non-joining RTL scripts Hebrew + Imperial Aramaic (reversed for RTL).
//   - HarfBuzz (shape.mjs) for scripts that DO need shaping: Arabic (contextual
//     joining) and Devanagari (Sanskrit conjuncts + reordering).
// Egyptian hieroglyphs (quadrat layout) are named in the footer, not drawn here.
//
// Design: a monumental titulus (inscription panel). Sharp-cornered incised
// frame, a Greek-key frieze under the heading, the grid divided by faint
// column rules as on a stone tablet. Heading rubricated (epigraphic V for U).
//
// Languages are ordered by global reach, leading with Classical Chinese, Arabic,
// and Sanskrit.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, escapeXml, font, loadFont, fontFile, meanderStrip, staticize } from './svglib.mjs';
import { shapeLine } from './shape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 860;
const H = 360;
const PAD = 44;

// Faces (opentype.js).
const disp = font();                                       // Latin / Greek / Cyrillic
const heb = loadFont(fontFile('NotoSerifHebrew.ttf'));     // Hebrew
const imp = loadFont(fontFile('NotoSansImperialAramaic.ttf')); // Imperial Aramaic
const got = loadFont(fontFile('NotoSansGothic.ttf'));      // Gothic
const cjk = loadFont(fontFile('NotoSerifSC-subset.ttf'));  // Classical Chinese (subset)
// Font paths (HarfBuzz-shaped).
const ARABIC = fontFile('NotoNaskhArabic.ttf');
const DEVA = fontFile('NotoSerifDevanagari.ttf');

// Each tongue in its own hand, the `native` being the language's own name for
// itself, verified against primary references:
//   文言 wényán · العربية al-ʿarabiyya · संस्कृतम् saṃskṛtam · Latīna · Ἑλληνική ·
//   עברית ʿivrit · 𐡀𐡓𐡌𐡉𐡀 ʾrmyʾ (Imperial Aramaic) · словѣньскъ slověnьskъ ·
//   Englisch (Middle English, attested c1225) · 𐌲𐌿𐍄𐌹𐍃𐌺𐌰 gutiska.
const tiles = [
  { native: '文言',        label: 'CLASSICAL CHINESE', face: cjk,  size: 31 },
  { native: 'العربية',     label: 'CLASSICAL ARABIC',  shaped: ARABIC, size: 33 },
  { native: 'संस्कृतम्',    label: 'CLASSICAL SANSKRIT', shaped: DEVA, size: 27 },
  { native: 'Latīna',     label: 'CLASSICAL LATIN',   face: disp, size: 30 },
  { native: 'Ἑλληνική',   label: 'ANCIENT GREEK',     face: disp, size: 27 },
  { native: 'עברית',      label: 'HEBREW',            face: heb,  size: 32, rtl: true },
  { native: '𐡀𐡓𐡌𐡉𐡀',    label: 'ARAMAIC',           face: imp,  size: 26, rtl: true },
  { native: 'словѣньскъ', label: 'CHURCH SLAVONIC',   face: disp, size: 25 },
  { native: 'Englisch',   label: 'MIDDLE ENGLISH',    face: disp, size: 30 },
  { native: '𐌲𐌿𐍄𐌹𐍃𐌺𐌰', label: 'GOTHIC',          face: got,  size: 28 },
];

const missing = [];

// Lay out one native word as { inner, width } with baseline at y=0, left edge at
// x=0, shrinking to fit maxWidth. `inner` is one or more <path> elements.
function fitNative(t, maxWidth) {
  let s = t.size;
  if (t.shaped) {
    let r = shapeLine(t.shaped, t.native, s);
    while (r.width > maxWidth && s > 12) { s -= 0.5; r = shapeLine(t.shaped, t.native, s); }
    if (r.missing.length) missing.push(...r.missing);
    return { inner: r.svg, width: r.width };
  }
  let r = layoutLine(t.native, s, { font: t.face, letterSpacing: 0.4, rtl: !!t.rtl });
  while (r.width > maxWidth && s > 12) { s -= 0.5; r = layoutLine(t.native, s, { font: t.face, letterSpacing: 0.4, rtl: !!t.rtl }); }
  missing.push(...r.missing);
  return { inner: `<path d="${r.d}"/>`, width: r.width };
}

// Geometry: 5 columns x 2 rows, faint column rules between them.
const colX = [121, 276, 430, 584, 739];
const TILE_W = 146;
const rowNative = [150, 246];
const rowLabel = [174, 270];

// The grid is fixed; an 11th tile would index past rowNative and render as a
// silent NaN transform. Fail loudly instead.
if (tiles.length !== colX.length * rowNative.length) {
  throw new Error(`linguae tile count mismatch: ${tiles.length} tiles, grid holds ${colX.length * rowNative.length}`);
}

// One shared label size so every caption matches: largest <= 13 that fits.
// Cap width at 148 (column pitch 155 minus a gutter) so neighbouring captions
// can never run into each other.
const LABEL_MAX_W = 148;
let labelSize = 13;
for (const t of tiles) {
  while (labelSize > 9.5 && layoutLine(t.label, labelSize, { font: disp, letterSpacing: 1.2 }).width > LABEL_MAX_W) labelSize -= 0.5;
}

let tileSvg = '';
tiles.forEach((t, i) => {
  const cx = colX[i % 5];
  const ny = rowNative[Math.floor(i / 5)];
  const ly = rowLabel[Math.floor(i / 5)];

  const nat = fitNative(t, TILE_W);
  const lab = layoutLine(t.label, labelSize, { font: disp, letterSpacing: 1.2 });
  missing.push(...lab.missing);

  tileSvg += `<g fill="${C.ink}" transform="translate(${round(cx - nat.width / 2)} ${ny})">${nat.inner}</g>`;
  tileSvg += `<g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.25"><path transform="translate(${round(cx - lab.width / 2)} ${ly})" d="${lab.d}"/></g>`;
  tileSvg += `<line x1="${round(cx - 12)}" y1="${round(ly + 9)}" x2="${round(cx + 12)}" y2="${round(ly + 9)}" stroke="${C.gold}" stroke-width="0.8" opacity="0.35" stroke-linecap="round"/>`;
});

// Faint column rules between tiles, like the ruled guides of a lapicide.
const colRuleX = [198.5, 353, 507, 661.5];
let colRules = '';
for (const rx of colRuleX) {
  colRules += `<line x1="${rx}" y1="96" x2="${rx}" y2="284" stroke="${C.gold}" stroke-width="0.6" opacity="0.2"/>`;
}

// Header (epigraphic V for U, rubricated) and gloss.
const title = layoutLine('LINGVAE', 16, { letterSpacing: 3.6 });
const gloss = layoutLine('each tongue in its own hand', 13, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

// Footer: the script we teach but do not draw as vectors here.
const footer = layoutLine('ALSO IN THE APP · ANCIENT EGYPTIAN, IN HIEROGLYPHS', 12.5, { letterSpacing: 2 });
missing.push(...footer.missing);

const aria = `Linguae. The languages PRAVIEL teaches, each in its native script: Classical Chinese, Classical Arabic, Classical Sanskrit, Classical Latin, Ancient Greek, Hebrew, Aramaic, Church Slavonic, Middle English, and Gothic. Ancient Egyptian, in hieroglyphs, is also taught in the app.`;

// Hook length of one meander unit at s=3 (for the draw-in intro).
const hookLen = 14 * 3;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(aria)}">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)"><rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="3" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/></g>
  <rect x="20" y="18" width="${W - 40}" height="${H - 36}" fill="none" stroke="${C.gold}" stroke-width="1.1" opacity="0.55"/>

  <g fill="${C.crimson}" stroke="${C.crimson}" stroke-width="0.25"><path transform="translate(${PAD} 56)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}"><path transform="translate(${round(W - PAD - gloss.width)} 56)" d="${gloss.d}"/></g>

  ${meanderStrip(PAD, 68, W - 2 * PAD, 3, C.gold, 1, 0.4, { len: hookLen, dur: '1s' })}

  ${colRules}

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    ${tileSvg}
  </g>

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2" opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${PAD} 327)" d="${footer.d}"/></g>
</svg>`;

writeFileSync(join(ROOT, 'assets', 'linguae.svg'), svg, 'utf8');
console.log(`linguae.svg written (${svg.length} bytes), ${tiles.length} tongues in-script, labelSize ${labelSize}.`);
if (missing.length) {
  console.warn('MISSING GLYPHS:', JSON.stringify(missing));
  process.exitCode = 1;
} else console.log('All glyphs resolved (no .notdef).');

if (process.env.STATIC) {
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'linguae.svg'), staticize(svg), 'utf8');
}
