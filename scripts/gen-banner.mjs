// Renders assets/banner.svg: the dramatic dark "imperial" hero. A gold-framed
// PRAVIEL fresco panel under a segmental arch (an aedicule niche), a meander
// frieze along the foot of the wall, the name column to the right with
// staggered SMIL reveals. All text is baked to vector paths; the fresco is an
// embedded base64 JPEG (768px, cut from the 4096px master icon).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, meanderStrip } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ANGEL = readFileSync(join(__dirname, 'angel.b64'), 'utf8').trim();

const W = 1000;
const H = 340;

// Banner-specific tones (dark ground, warm metals).
const T = {
  cream: '#F4EFE4',
  roleCream: '#E7DCC9',
  gold: '#D9BE7A',
  goldLine: '#C5A059',
  muted: '#CDC2AE',
};

const missing = [];
function lineSvg(text, x, y, size, ls, fill, anchor = 'start') {
  const l = layoutLine(text, size, { letterSpacing: ls });
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

// Fresco panel geometry (left).
const PX = 72;
const PS = 192;
const PY = (H - PS) / 2;

// Text column (right of panel).
const TX = 304;
const eyebrow = lineSvg('ΓΝΩΘΙ  ΣΑΥΤΟΝ', TX + 2, 114, 19, 6, T.gold);
const name = lineSvg('ANTON SOLOVIEV', TX, 178, 52, 2.4, T.cream);
const role1 = lineSvg('Founder & CEO of PRAVIEL', TX + 1, 232, 22, 0.4, T.roleCream);
const role2 = lineSvg('AI researcher. Reviving the languages the world calls dead.', TX + 1, 263, 18, 0.2, T.muted);

const ulY = 196;
const ulW = name.width;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Anton Soloviev. Founder and CEO of PRAVIEL. AI researcher.">
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
    <clipPath id="panelClip"><rect x="${PX}" y="${PY}" width="${PS}" height="${PS}" rx="16"/></clipPath>
    <clipPath id="bgClip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/></filter>
  </defs>

  <rect width="${W}" height="${H}" rx="18" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#crimson)"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#goldwash)"/>
  <rect width="${W}" height="${H}" rx="18" fill="#000" filter="url(#grain)" opacity="0.45" clip-path="url(#bgClip)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.30"/>

  <!-- Meander frieze along the foot of the wall -->
  ${meanderStrip(40, H - 32, W - 80, 3, C.gold, 1, 0.22)}

  <!-- Fresco panel in an aedicule: a segmental arch springs from behind it -->
  <path d="M${PX - 8} ${PY + 10}A${PS / 2 + 8} 56 0 0 1 ${PX + PS + 8} ${PY + 10}" fill="none" stroke="${C.gold}" stroke-width="1.1" opacity="0.5"/>
  <g opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1s" begin="0s" fill="freeze"/>
    <rect x="${PX - 2}" y="${PY - 2}" width="${PS + 4}" height="${PS + 4}" rx="18" fill="#0E0B08"/>
    <image href="${ANGEL}" x="${PX}" y="${PY}" width="${PS}" height="${PS}" clip-path="url(#panelClip)" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${PX}" y="${PY}" width="${PS}" height="${PS}" rx="16" fill="none" stroke="${C.gold}" stroke-width="1.8" opacity="0.85"/>
  </g>

  <!-- Text column -->
  ${fadeUp(eyebrow.svg, 0.2)}
  ${fadeUp(name.svg, 0.35)}
  <line x1="${TX}" y1="${ulY}" x2="${round(TX + ulW)}" y2="${ulY}" stroke="${T.goldLine}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="${round(ulW)}" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" values="${round(ulW)};${round(ulW)};0" keyTimes="0;0.4;1" dur="1.35s" begin="0s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>
  </line>
  ${fadeUp(role1.svg, 0.7)}
  ${fadeUp(role2.svg, 0.9)}
</svg>`;

writeFileSync(join(ROOT, 'assets', 'banner.svg'), svg, 'utf8');
console.log(`banner.svg written (${svg.length} bytes). name width=${round(name.width)}`);
if (missing.length) console.warn('MISSING GLYPHS:', JSON.stringify(missing));
else console.log('All glyphs resolved.');

// Static QA copy (animations collapsed to final state).
if (process.env.STATIC) {
  const stat = svg
    .replaceAll(' opacity="0"', ' opacity="1"')
    .replace(new RegExp(`stroke-dashoffset="${round(ulW)}"`), 'stroke-dashoffset="0"');
  const dir = join(ROOT, '.preview');
  writeFileSync(join(dir, 'banner.svg'), stat, 'utf8');
}
