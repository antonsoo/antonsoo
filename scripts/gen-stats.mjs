// Renders assets/stats.svg: the "Tabula" ledger. Figures are Roman numerals
// (modest counts, stated with intent). Data comes from scripts/stats-data.json,
// refreshed by the tabula workflow. No third-party stats service, so nothing
// here can 503 on the profile.
//
// Design: a tabula ansata, the dovetail-handled dedication plaque of Roman
// votive bronzes and military diplomata, complete with nail holes in the
// ansae. The numerals are cut into the stone (layered catch-light), labels
// are Latin with quiet English glosses, hederae divide the columns.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, escapeXml, hedera, ansaFrame, incised, toRoman, fontTitle, staticize } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const data = JSON.parse(readFileSync(join(__dirname, 'stats-data.json'), 'utf8'));

const W = 860;
const H = 300;

const thisYear = new Date().getUTCFullYear();
const years = Math.max(1, thisYear - data.createdYear);

const figures = [
  { roman: toRoman(years), latin: 'ANNI', gloss: 'years on GitHub' },
  { roman: toRoman(data.publicRepos), latin: 'OPERA', gloss: 'public repositories' },
  { roman: toRoman(data.followers), latin: 'SECTATORES', gloss: 'followers' },
];

const missing = [];
const TITLE = fontTitle();  // engraved Roman caps: title, numerals, Latin labels, focus line

// Plaque geometry.
const BX = 46, BY = 10, BW = W - 92, BH = H - 20;
const frame = ansaFrame(BX, BY, BW, BH, { ansaW: 32, ansaH: 88, taper: 18, holeR: 3.6 });

// Figures row.
const figY = 158;
const latY = 192;
const gloY = 213;
let figSvg = '';
// Column half-width budget: hederae sit at W*0.375 / W*0.625, each leaf body
// reaches ~5.8px from its centre; keep 4px clearance. The workflow feeds live
// numbers, so wide numerals (LXXXVIII and friends) must shrink, not collide.
const MAX_NUM_HALF = W * 0.125 - 5.8 - 4;
figures.forEach((f, i) => {
  const cx = W * (0.25 + 0.25 * i);
  // letterSpacing 1 (not 2): Cinzel's capitals are wider than the old Didone, so
  // the tighter spacing restores headroom in the half-width budget below (wide
  // live counts fed by tabula.yml, e.g. LXXXVIII / CCCLXXXVIII, must not collide
  // with the hederae). Still reads as monumental engraved caps at these sizes.
  let numSize = 56;
  let num = layoutLine(f.roman, numSize, { letterSpacing: 1, font: TITLE });
  while (num.width / 2 > MAX_NUM_HALF && numSize > 28) {
    numSize -= 1;
    num = layoutLine(f.roman, numSize, { letterSpacing: 1, font: TITLE });
  }
  if (num.width / 2 > MAX_NUM_HALF) {
    console.warn(`numeral "${f.roman}" still over budget at minimum size (half-width ${round(num.width / 2)} > ${round(MAX_NUM_HALF)})`);
    process.exitCode = 1;
  }
  const lat = layoutLine(f.latin, 14, { letterSpacing: 2.6, font: TITLE });
  const glo = layoutLine(f.gloss, 11.5, { letterSpacing: 0.8 });
  missing.push(...num.missing, ...lat.missing, ...glo.missing);
  figSvg += incised(num, cx - num.width / 2, figY);
  figSvg += `<g fill="${C.brown}" stroke="${C.brown}" stroke-width="0.2"><path transform="translate(${round(cx - lat.width / 2)} ${latY})" d="${lat.d}"/></g>`;
  figSvg += `<g fill="${C.brownSoft}"><path transform="translate(${round(cx - glo.width / 2)} ${gloY})" d="${glo.d}"/></g>`;
});
// Hederae between columns, tips turned outward like an inscription's dividers.
figSvg += hedera(W * 0.375, figY - 20, 14, C.crimson, 0.9);
figSvg += hedera(W * 0.625, figY - 20, 14, C.crimson, 0.9, true);

const title = layoutLine('TABVLA · RATIŌNVM', 16, { letterSpacing: 3.2, font: TITLE });
const gloss = layoutLine('the public ledger', 13, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

const focusText = data.focus.join(' · ').toUpperCase();
const focus = layoutLine(focusText, 13, { letterSpacing: 2.4, font: TITLE });
missing.push(...focus.missing);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The public ledger: ${escapeXml(years)} years on GitHub, ${escapeXml(data.publicRepos)} public repositories, ${escapeXml(data.followers)} followers. Focus: ${escapeXml(data.focus.join(', '))}.">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <filter id="lift" x="-10%" y="-10%" width="120%" height="128%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)">
    <path d="${frame.ansae}" fill="url(#parch)" stroke="${C.gold}" stroke-width="1.2" stroke-opacity="0.75"/>
    <path d="${frame.body}" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/>
  </g>
  <rect x="${BX + 10}" y="${BY + 10}" width="${BW - 20}" height="${BH - 20}" fill="none" stroke="${C.gold}" stroke-width="0.9" opacity="0.5"/>
  ${frame.holes.map((h) => `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="none" stroke="${C.gold}" stroke-width="1.1" opacity="0.8"/>`).join('')}

  <g fill="${C.crimson}" stroke="${C.crimson}" stroke-width="0.25"><path transform="translate(${round(W / 2 - title.width / 2)} 58)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}"><path transform="translate(${round(W / 2 - gloss.width / 2)} 80)" d="${gloss.d}"/></g>

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    ${figSvg}
  </g>

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2" opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${round(W / 2 - focus.width / 2)} 260)" d="${focus.d}"/></g>
</svg>`;

writeFileSync(join(ROOT, 'assets', 'stats.svg'), svg, 'utf8');
console.log(`stats.svg written: ${years}y, ${data.publicRepos} repos, ${data.followers} followers`);
if (missing.length) {
  console.warn('MISSING GLYPHS:', JSON.stringify(missing));
  process.exitCode = 1;
} else console.log('All glyphs resolved (no .notdef).');

if (process.env.STATIC) {
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stats.svg'), staticize(svg), 'utf8');
}
