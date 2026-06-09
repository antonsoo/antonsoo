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
// Languages are ordered by global reach, leading with Classical Chinese, Arabic,
// and Sanskrit.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, escapeXml, font, loadFont, fontFile } from './svglib.mjs';
import { shapeLine } from './shape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 860;
const H = 360;
const PAD = 46;

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

function diamond(cx, cy, r, fill, opacity = 1) {
  return `<path d="M${round(cx)} ${round(cy - r)}L${round(cx + r)} ${round(cy)}L${round(cx)} ${round(cy + r)}L${round(cx - r)} ${round(cy)}Z" fill="${fill}" opacity="${opacity}"/>`;
}

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

// Geometry: 5 columns x 2 rows.
const colX = [121, 276, 430, 584, 739];
const TILE_W = 146;
const rowNative = [137, 227];
const rowLabel = [161, 251];

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
  tileSvg += `<line x1="${round(cx - 12)}" y1="${round(ly + 9)}" x2="${round(cx + 12)}" y2="${round(ly + 9)}" stroke="${C.gold}" stroke-width="1" opacity="0.45" stroke-linecap="round"/>`;
});

// Header.
const title = layoutLine('LINGUAE', 15, { letterSpacing: 3.6 });
const gloss = layoutLine('each tongue in its own hand', 14, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

// Footer: the script we teach but do not draw as vectors here.
const footer = layoutLine('ALSO IN THE APP   ·   ANCIENT EGYPTIAN, IN HIEROGLYPHS', 13.5, { letterSpacing: 2.2 });
missing.push(...footer.missing);

const ruleY = 286;
const ruleHalf = 150;
const fy2 = H - 16;

const aria = `Linguae. The languages PRAVIEL teaches, each in its native script: Classical Chinese, Classical Arabic, Classical Sanskrit, Classical Latin, Ancient Greek, Hebrew, Aramaic, Church Slavonic, Middle English, and Gothic. Ancient Egyptian, in hieroglyphs, is also taught in the app.`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(aria)}">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.12" r="0.9">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.13"/>
      <stop offset="0.5" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0"/></filter>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)"><rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/></g>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#glow)"/>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="#000" filter="url(#grain)" opacity="0.5" clip-path="inset(0 round 15px)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 36}" rx="9" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.55"/>
  ${diamond(26, 26, 2.6, C.gold, 0.7)}${diamond(W - 26, 26, 2.6, C.gold, 0.7)}${diamond(26, fy2 + 6, 2.6, C.gold, 0.7)}${diamond(W - 26, fy2 + 6, 2.6, C.gold, 0.7)}

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2"><path transform="translate(${PAD} 58)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}"><path transform="translate(${round(W - PAD - gloss.width)} 58)" d="${gloss.d}"/></g>

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    ${tileSvg}
  </g>

  <g opacity="0.9">
    <line x1="${W / 2 - ruleHalf}" y1="${ruleY}" x2="${W / 2 + ruleHalf}" y2="${ruleY}" stroke="${C.gold}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="${ruleHalf * 2}" stroke-dashoffset="0">
      <animate attributeName="stroke-dashoffset" from="${ruleHalf * 2}" to="0" dur="1.1s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${ruleHalf * 2};0"/>
    </line>
    ${diamond(W / 2, ruleY, 3.2, C.crimson, 1)}
  </g>

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2" opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${round(W / 2 - footer.width / 2)} 312)" d="${footer.d}"/></g>
</svg>`;

writeFileSync(join(ROOT, 'assets', 'linguae.svg'), svg, 'utf8');
console.log(`linguae.svg written (${svg.length} bytes), ${tiles.length} tongues in-script, labelSize ${labelSize}.`);
if (missing.length) console.warn('MISSING GLYPHS:', JSON.stringify(missing));
else console.log('All glyphs resolved (no .notdef).');

if (process.env.STATIC) {
  const stat = svg
    .replaceAll(' opacity="0"', ' opacity="1"')
    .replaceAll(`stroke-dashoffset="${ruleHalf * 2}"`, 'stroke-dashoffset="0"');
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'linguae.svg'), stat, 'utf8');
}
