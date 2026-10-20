// Renders assets/banner.svg: the dramatic dark "imperial" hero. A centred
// monumental inscription (eyebrow, the name in Cinzel over a drawn-in gold
// rule, the role and the tagline in EB Garamond), a hedera rule along the foot,
// staggered SMIL reveals. All text is baked to vector paths.
//
// Behind the inscription, barely there, a sea chart: a Mercator graticule
// (meridians evenly spaced, parallels pulled apart toward the edges by the
// projection's own formula, the equator running under the name as the gold
// rule) crossed by rhumb lines from two wind points. It is a pun on the name.
// A mercer sold cloth, a mercātor sold anything, and Gerard Kremer ("merchant")
// Latinized himself into Mercator before he drew the 1569 world map whose grid
// this is.
//
// History worth knowing before editing the geometry. Until 2026-10 the banner
// carried a device on the left (a fresco panel, then family arms) with the
// text in a column to its right. The device was removed at the owner's
// request, and the text moved to the centre: a left-weighted column with
// nothing beside it reads as a layout with a hole in it.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, font, fontTitle, hederaRule, staticize } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 1000;
const H = 340;

// Banner-specific tones (dark ground, warm metals). Lifted brighter than the
// page palette for legibility of small text over the grainy dark ground.
const T = {
  cream: '#F6F1E7',
  roleCream: '#F1E7D6',
  gold: '#E3CA84',
  goldLine: '#C9A661',
  muted: '#DBD0BB',
};

const missing = [];
function lineSvg(text, x, y, size, ls, fill, { anchor = 'start', font: fnt } = {}) {
  const l = layoutLine(text, size, { letterSpacing: ls, font: fnt });
  missing.push(...l.missing);
  let dx = x;
  if (anchor === 'middle') dx = x - l.width / 2;
  else if (anchor === 'end') dx = x - l.width;
  return { width: l.width, svg: `<g fill="${fill}"><path transform="translate(${round(dx)} ${y})" d="${l.d}"/></g>` };
}

// Staggered entrance with a VISIBLE base state: the group is opacity 1 by
// default (so it shows even if SMIL never runs or a SMIL bug creeps in), and
// the intro is held at hidden for `delay` seconds via keyTimes, all begin=0s
// so there is no visible-then-hidden flash.
function fadeUp(inner, delay = 0, dy = 9) {
  if (delay > 0) {
    const dur = (0.9 + delay).toFixed(2);
    const k = (delay / (0.9 + delay)).toFixed(3);
    return `<g opacity="1">` +
      `<animate attributeName="opacity" values="0;0;1" keyTimes="0;${k};1" dur="${dur}s" begin="0s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 ${dy};0 ${dy};0 0" keyTimes="0;${k};1" dur="${dur}s" begin="0s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>` +
      `${inner}</g>`;
  }
  return `<g opacity="1">` +
    `<animate attributeName="opacity" from="0" to="1" dur="0.9s" begin="0s" fill="freeze"/>` +
    `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" dur="0.9s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 ${dy};0 0"/>` +
    `${inner}</g>`;
}

// Text block, centred. Titling (eyebrow + name) is Cinzel (Roman monumental
// caps); the role and the tagline are EB Garamond (the readable body serif).
// The name is fit to the available width so Cinzel's wide caps never overrun.
const CX = W / 2;
const TEXT_MAXW = W - 160;
const TITLE = fontTitle();
const BODY = font();
const NAME = 'ANTHONY MERCER';

let nameSize = 76;
while (nameSize > 40 && layoutLine(NAME, nameSize, { letterSpacing: 3, font: TITLE }).width > TEXT_MAXW) {
  nameSize -= 1;
}

const eyebrow = lineSvg('AI · SOFTWARE · SAN FRANCISCO', CX, 96, 15, 4.6, T.gold, { anchor: 'middle', font: TITLE });
const name = lineSvg(NAME, CX, 174, nameSize, 3, T.cream, { anchor: 'middle', font: TITLE });
const role1 = lineSvg('AI/ML and Software Engineer', CX, 240, 25, 0.2, T.roleCream, { anchor: 'middle', font: BODY });
const role2 = lineSvg('Founder of PRAVIEL. The old languages, out loud again.', CX, 273, 21, 0.2, T.muted, { anchor: 'middle', font: BODY });

// Only the name is auto-fit; fail the bake rather than let another line run
// past the text block.
for (const [label, line] of [['eyebrow', eyebrow], ['role1', role1], ['role2', role2]]) {
  if (line.width > TEXT_MAXW) throw new Error(`banner ${label} is ${line.width}px, over the ${TEXT_MAXW}px text block`);
}

// The gold rule under the name doubles as the graticule's equator.
const ulY = 196;
const ulW = name.width;
const ulX = CX - ulW / 2;

// Mercator graticule, 15 degrees both ways. A parallel at latitude phi sits
// R * ln(tan(pi/4 + phi/2)) from the equator, so the bands grow from about 32px
// to 52px toward the edges, which is the projection's signature. R sets the
// density, not the size of a globe: the projection is cylindrical, so the
// meridians simply repeat across the width.
const R = 120;
const STEP = Math.PI / 12;
const meridianGap = R * STEP;
let grid = '';
for (let k = -Math.ceil(CX / meridianGap); k <= Math.ceil(CX / meridianGap); k++) {
  const x = round(CX + k * meridianGap);
  if (x > 0 && x < W) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
}
for (let i = 1; i < 6; i++) {
  const dy = R * Math.log(Math.tan(Math.PI / 4 + (i * STEP) / 2));
  for (const y of [ulY - dy, ulY + dy]) {
    if (y > 0 && y < H) grid += `<line x1="0" y1="${round(y)}" x2="${W}" y2="${round(y)}"/>`;
  }
}

// Rhumb lines from two wind-points, as on the sea charts the projection was
// made for: on a Mercator map a course of constant compass bearing is a
// straight line, which is the whole reason Mercator drew it. Sixteen bearings
// from each point, clipped by the frame and faded by the same mask as the grid.
const ROSES = [[70, ulY], [W - 70, ulY]];
const REACH = W * 1.2;
let rhumbs = '';
for (const [rx, ry] of ROSES) {
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    rhumbs += `<line x1="${rx}" y1="${ry}" x2="${round(rx + REACH * Math.cos(a))}" y2="${round(ry + REACH * Math.sin(a))}"/>`;
  }
}
const roseMarks = ROSES.map(([rx, ry]) => `<circle cx="${rx}" cy="${ry}" r="2.2"/>`).join('');

const ARIA =
  'Anthony Mercer. AI, software, San Francisco. AI/ML and Software Engineer. Founder of PRAVIEL. ' +
  'The old languages, out loud again. Behind the name, a faint sea chart: a map grid in Mercator\'s ' +
  'projection, crossed by rhumb lines, its equator running under the name as a gold rule.';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ARIA}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#17130E"/>
      <stop offset="1" stop-color="#0B0907"/>
    </linearGradient>
    <radialGradient id="crimson" cx="0.86" cy="0.1" r="0.7">
      <stop offset="0" stop-color="${C.crimson}" stop-opacity="0.30"/>
      <stop offset="0.6" stop-color="${C.crimson}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldwash" cx="0.16" cy="0.92" r="0.7">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.18"/>
      <stop offset="0.6" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gridFade" cx="0.5" cy="0.55" r="0.62">
      <stop offset="0.3" stop-color="#FFF" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFF" stop-opacity="1"/>
    </radialGradient>
    <mask id="gridMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#gridFade)"/></mask>
    <clipPath id="bgClip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/></filter>
  </defs>

  <rect width="${W}" height="${H}" rx="18" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#crimson)"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#goldwash)"/>

  <!-- Mercator graticule, faded toward the inscription -->
  <g clip-path="url(#bgClip)" mask="url(#gridMask)">
    <g stroke="${C.gold}" stroke-width="0.8" opacity="0.16" fill="none">${grid}</g>
    <g stroke="${C.gold}" stroke-width="0.7" opacity="0.17" fill="none">${rhumbs}</g>
    <line x1="0" y1="${ulY}" x2="${W}" y2="${ulY}" stroke="${T.goldLine}" stroke-width="1" opacity="0.32"/>
    <g fill="${T.gold}" opacity="0.5">${roseMarks}</g>
  </g>

  <rect width="${W}" height="${H}" rx="18" fill="#000" filter="url(#grain)" opacity="0.45" clip-path="url(#bgClip)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.30"/>

  <!-- Hedera rule along the foot of the wall (a single Roman divider, gold leaf on the dark ground) -->
  ${hederaRule(W / 2, H - 28, 300, { stroke: T.goldLine, leaf: T.gold, size: 19, opacity: 0.6 })}

  <!-- Inscription -->
  ${fadeUp(eyebrow.svg, 0.2)}
  ${fadeUp(name.svg, 0.35)}
  <line x1="${round(ulX)}" y1="${ulY}" x2="${round(ulX + ulW)}" y2="${ulY}" stroke="${T.goldLine}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="${round(ulW)}" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" values="${round(ulW)};${round(ulW)};0" keyTimes="0;0.4;1" dur="1.35s" begin="0s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>
  </line>
  ${fadeUp(role1.svg, 0.7)}
  ${fadeUp(role2.svg, 0.9)}
</svg>`;

writeFileSync(join(ROOT, 'assets', 'banner.svg'), svg, 'utf8');
console.log(`banner.svg written (${svg.length} bytes). name size=${nameSize} width=${round(name.width)}`);
if (missing.length) {
  console.warn('MISSING GLYPHS:', JSON.stringify(missing));
  process.exitCode = 1;
} else console.log('All glyphs resolved (no .notdef).');

// Static QA copy (SMIL stripped; base state is already the final frame).
if (process.env.STATIC) {
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'banner.svg'), staticize(svg), 'utf8');
}
