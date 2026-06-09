// Renders assets/stats.svg: a bespoke "Tabula" ledger in the parchment/gold
// house style. Figures are Roman numerals (modest counts, stated with intent).
// Data comes from scripts/stats-data.json, refreshed by the tabula workflow.
// No third-party stats service, so nothing here can 503 on the profile.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, textBlock, round } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const data = JSON.parse(readFileSync(join(__dirname, 'stats-data.json'), 'utf8'));

const W = 860;
const H = 300;
const PAD = 46;

function toRoman(n) {
  if (n <= 0) return 'N'; // nulla
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

const thisYear = new Date().getUTCFullYear();
const years = Math.max(1, thisYear - data.createdYear);

const figures = [
  { roman: toRoman(years), label: 'YEARS ON GITHUB' },
  { roman: toRoman(data.publicRepos), label: 'PUBLIC REPOS' },
  { roman: toRoman(data.followers), label: 'FOLLOWERS' },
];

function diamond(cx, cy, r, fill, opacity = 1) {
  return `<path d="M${round(cx)} ${round(cy - r)}L${round(cx + r)} ${round(cy)}L${round(cx)} ${round(cy + r)}L${round(cx - r)} ${round(cy)}Z" fill="${fill}" opacity="${opacity}"/>`;
}

const missing = [];

// Figures row.
const figY = 168;
const labY = 198;
let figSvg = '';
figures.forEach((f, i) => {
  const cx = W * (0.25 + 0.25 * i);
  const num = layoutLine(f.roman, 54, { letterSpacing: 2 });
  const lab = layoutLine(f.label, 14.5, { letterSpacing: 2.4 });
  missing.push(...num.missing, ...lab.missing);
  figSvg += `<g fill="${C.ink}"><path transform="translate(${round(cx - num.width / 2)} ${figY})" d="${num.d}"/></g>`;
  figSvg += `<g fill="${C.brown}" stroke="${C.brown}" stroke-width="0.2"><path transform="translate(${round(cx - lab.width / 2)} ${labY})" d="${lab.d}"/></g>`;
  if (i < figures.length - 1) {
    const sx = W * (0.375 + 0.25 * i);
    figSvg += diamond(sx, figY - 16, 2.6, C.gold, 0.6);
  }
});

const title = layoutLine('TABVLA  RATIŌNVM', 15, { letterSpacing: 3.4 });
const gloss = layoutLine('the public ledger', 14, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

const focusText = data.focus.join('   ·   ').toUpperCase();
const focus = layoutLine(focusText, 14.5, { letterSpacing: 2.6 });
missing.push(...focus.missing);

const ruleY = 224;
const ruleHalf = 150;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The public ledger: ${years} years on GitHub, ${data.publicRepos} public repositories, ${data.followers} followers. Focus: ${data.focus.join(', ')}.">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.14" r="0.9">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.13"/>
      <stop offset="0.5" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0"/></filter>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="124%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)"><rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/></g>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#glow)"/>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="#000" filter="url(#grain)" opacity="0.5" clip-path="inset(0 round 15px)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 36}" rx="9" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.55"/>
  ${diamond(26, 26, 2.6, C.gold, 0.7)}${diamond(W - 26, 26, 2.6, C.gold, 0.7)}${diamond(26, H - 26, 2.6, C.gold, 0.7)}${diamond(W - 26, H - 26, 2.6, C.gold, 0.7)}

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2"><path transform="translate(${PAD} 58)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}"><path transform="translate(${round(W - PAD - gloss.width)} 58)" d="${gloss.d}"/></g>

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    ${figSvg}
  </g>

  <g opacity="0.9">
    <line x1="${W / 2 - ruleHalf}" y1="${ruleY}" x2="${W / 2 + ruleHalf}" y2="${ruleY}" stroke="${C.gold}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="${ruleHalf * 2}" stroke-dashoffset="0">
      <animate attributeName="stroke-dashoffset" from="${ruleHalf * 2}" to="0" dur="1.1s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${ruleHalf * 2};0"/>
    </line>
  </g>

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2" opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${round(W / 2 - focus.width / 2)} 258)" d="${focus.d}"/></g>
</svg>`;

writeFileSync(join(ROOT, 'assets', 'stats.svg'), svg, 'utf8');
console.log(`stats.svg written: ${years}y, ${data.publicRepos} repos, ${data.followers} followers`);
if (missing.length) console.warn('MISSING GLYPHS:', JSON.stringify(missing));
else console.log('All glyphs resolved.');

if (process.env.STATIC) {
  const stat = svg
    .replaceAll(' opacity="0"', ' opacity="1"')
    .replaceAll(`stroke-dashoffset="${ruleHalf * 2}"`, 'stroke-dashoffset="0"');
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stats.svg'), stat, 'utf8');
}
