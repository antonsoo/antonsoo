// Renders assets/instrumenta.svg: the "Instrumenta" ledger of working tools,
// replacing the third-party skillicons strip. Three engraved rows (machine
// learning / web & mobile / systems), each headed by a Latin label: ars
// machinalis is Pliny's collocation for the engineer's art (machinalis
// scientia, NH 7.125), fabrica the workshop, fundamenta the foundations.
//
// Design: a tabula cerata (Roman wax tablet). A wooden border band around a
// recessed writing surface with cut corners, a margin rule separating the
// Latin labels from the tool lines, scratched row rules. All text baked to
// vector paths, like every card in this repo.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, escapeXml, staticize } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 860;
const H = 300;

const rows = [
  {
    latin: 'ARS MACHINALIS',
    gloss: 'machine learning',
    tools: ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn'],
  },
  {
    latin: 'FABRICA',
    gloss: 'web & mobile',
    tools: ['Dart', 'Flutter', 'TypeScript', 'React', 'Next.js', 'Tailwind', 'Node.js'],
  },
  {
    latin: 'FUNDAMENTA',
    gloss: 'systems & infrastructure',
    tools: ['C++', 'Docker', 'Postgres', 'Redis', 'Cloudflare', 'Git', 'Linux'],
  },
];

const missing = [];

// Wax tablet geometry: outer wooden band, inner writing surface.
const SX = 24, SY = 22;            // surface top-left
const SW = W - 48, SH = H - 50;    // surface size (24..836 x 22..272)
const PAD = 46;                    // text inset from card edge
const LABEL_X = PAD;
const RULE_X = 238;                // margin rule between labels and tools
const TOOLS_X = 254;
const TOOLS_MAX = W - PAD - TOOLS_X;
const rowBase = [126, 187, 248];

let rowSvg = '';
rows.forEach((r, i) => {
  const by = rowBase[i];

  const lab = layoutLine(r.latin, 14.5, { letterSpacing: 2.6 });
  const glo = layoutLine(r.gloss, 13, { letterSpacing: 0.8 });
  missing.push(...lab.missing, ...glo.missing);
  rowSvg += `<g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.25"><path transform="translate(${LABEL_X} ${by - 6})" d="${lab.d}"/></g>`;
  rowSvg += `<g fill="${C.brownSoft}"><path transform="translate(${LABEL_X} ${by + 13})" d="${glo.d}"/></g>`;

  // Tool line, shrunk to fit if a list ever grows.
  const text = r.tools.join('  ·  ');
  let size = 18;
  let line = layoutLine(text, size, { letterSpacing: 0.3 });
  while (line.width > TOOLS_MAX && size > 12) {
    size -= 0.5;
    line = layoutLine(text, size, { letterSpacing: 0.3 });
  }
  missing.push(...line.missing);
  rowSvg += `<g fill="${C.ink}"><path transform="translate(${TOOLS_X} ${by})" d="${line.d}"/></g>`;

  if (i < rows.length - 1) {
    const ry = by + 27;
    rowSvg += `<line x1="${PAD}" y1="${ry}" x2="${W - PAD}" y2="${ry}" stroke="${C.gold}" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>`;
  }
});

// Cut corners of the writing surface (the moulded recess of a wax tablet).
const NOTCH = 10;
const notches =
  `<path d="M${SX} ${SY}h${NOTCH}l${-NOTCH} ${NOTCH}Z" fill="${C.brown}" opacity="0.22"/>` +
  `<path d="M${SX + SW} ${SY}v${NOTCH}l${-NOTCH} ${-NOTCH}Z" fill="${C.brown}" opacity="0.22"/>` +
  `<path d="M${SX} ${SY + SH}h${NOTCH}l${-NOTCH} ${-NOTCH}Z" fill="${C.brown}" opacity="0.22"/>` +
  `<path d="M${SX + SW} ${SY + SH}v${-NOTCH}l${-NOTCH} ${NOTCH}Z" fill="${C.brown}" opacity="0.22"/>`;

// Header.
const title = layoutLine('INSTRVMENTA', 16, { letterSpacing: 3.4 });
const gloss = layoutLine('tools of the trade', 13, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

const aria = `Instrumenta, the tools of the trade. Machine learning: ${rows[0].tools.join(', ')}. Web and mobile: ${rows[1].tools.join(', ')}. Systems and infrastructure: ${rows[2].tools.join(', ')}.`;

const marginTop = 96;
const marginLen = 168;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(aria)}">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EDE2CE"/>
      <stop offset="1" stop-color="#E2D3B8"/>
    </linearGradient>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="124%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)"><rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="6" fill="url(#wood)" stroke="#C9B391" stroke-width="1"/></g>
  <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="1" fill="url(#parch)" stroke="${C.brown}" stroke-opacity="0.3" stroke-width="1"/>
  ${notches}

  <g fill="${C.crimson}" stroke="${C.crimson}" stroke-width="0.25"><path transform="translate(${PAD} 62)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}"><path transform="translate(${round(W - PAD - gloss.width)} 62)" d="${gloss.d}"/></g>
  <line x1="${PAD}" y1="78" x2="${W - PAD}" y2="78" stroke="${C.brown}" stroke-width="0.7" opacity="0.25"/>

  <line x1="${RULE_X}" y1="${marginTop}" x2="${RULE_X}" y2="${marginTop + marginLen}" stroke="${C.brown}" stroke-width="0.8" opacity="0.25" stroke-dasharray="${marginLen}" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" from="${marginLen}" to="0" dur="0.9s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${marginLen};0"/>
  </line>

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    ${rowSvg}
  </g>
</svg>`;

writeFileSync(join(ROOT, 'assets', 'instrumenta.svg'), svg, 'utf8');
console.log(`instrumenta.svg written (${svg.length} bytes), ${rows.length} rows.`);
if (missing.length) console.warn('MISSING GLYPHS:', JSON.stringify(missing));
else console.log('All glyphs resolved (no .notdef).');

if (process.env.STATIC) {
  const dir = join(ROOT, '.preview');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'instrumenta.svg'), staticize(svg), 'utf8');
}
