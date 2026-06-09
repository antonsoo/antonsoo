// Renders assets/instrumenta.svg: the "Instrumenta" ledger of working tools in
// the parchment/gold house style, replacing the third-party skillicons strip.
// Three engraved rows (machine learning / web & mobile / systems), each headed
// by a Latin label: ars machinalis is Pliny's collocation for the engineer's
// art (machinalis scientia, NH 7.125), fabrica the workshop, fundamenta the
// foundations. All text baked to vector paths, like every card in this repo.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, layoutLine, round, escapeXml } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 860;
const H = 300;
const PAD = 46;

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

function diamond(cx, cy, r, fill, opacity = 1) {
  return `<path d="M${round(cx)} ${round(cy - r)}L${round(cx + r)} ${round(cy)}L${round(cx)} ${round(cy + r)}L${round(cx - r)} ${round(cy)}Z" fill="${fill}" opacity="${opacity}"/>`;
}

// Geometry: a left column of Latin labels, a right column of engraved tool
// lines, thin gold rules between rows.
const LABEL_X = PAD;
const TOOLS_X = 250;
const TOOLS_MAX = W - PAD - TOOLS_X;
const rowBase = [124, 186, 248];

let rowSvg = '';
rows.forEach((r, i) => {
  const by = rowBase[i];

  const lab = layoutLine(r.latin, 13, { letterSpacing: 2.6 });
  const glo = layoutLine(r.gloss, 11.5, { letterSpacing: 0.8 });
  missing.push(...lab.missing, ...glo.missing);
  rowSvg += `<g fill="${C.goldInk}" opacity="0.92"><path transform="translate(${LABEL_X} ${by - 6})" d="${lab.d}"/></g>`;
  rowSvg += `<g fill="${C.brownSoft}" opacity="0.75"><path transform="translate(${LABEL_X} ${by + 12})" d="${glo.d}"/></g>`;

  // Tool line, shrunk to fit if a list ever grows.
  const text = r.tools.join('  ·  ');
  let size = 17.5;
  let line = layoutLine(text, size, { letterSpacing: 0.3 });
  while (line.width > TOOLS_MAX && size > 12) {
    size -= 0.5;
    line = layoutLine(text, size, { letterSpacing: 0.3 });
  }
  missing.push(...line.missing);
  rowSvg += `<g fill="${C.ink}"><path transform="translate(${TOOLS_X} ${by})" d="${line.d}"/></g>`;

  if (i < rows.length - 1) {
    const ry = by + 27;
    rowSvg += `<line x1="${PAD}" y1="${ry}" x2="${W - PAD}" y2="${ry}" stroke="${C.gold}" stroke-width="0.8" opacity="0.35" stroke-linecap="round"/>`;
    rowSvg += diamond(W / 2, ry, 2.2, C.gold, 0.55);
  }
});

// Header.
const title = layoutLine('INSTRVMENTA', 13.5, { letterSpacing: 3.6 });
const gloss = layoutLine('tools of the trade', 12.5, { letterSpacing: 1.2 });
missing.push(...title.missing, ...gloss.missing);

const fy2 = H - 16;
const aria = `Instrumenta, the tools of the trade. Machine learning: ${rows[0].tools.join(', ')}. Web and mobile: ${rows[1].tools.join(', ')}. Systems and infrastructure: ${rows[2].tools.join(', ')}.`;

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
    <filter id="lift" x="-8%" y="-8%" width="116%" height="124%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)"><rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/></g>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#glow)"/>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="#000" filter="url(#grain)" opacity="0.5" clip-path="inset(0 round 15px)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 36}" rx="9" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.55"/>
  ${diamond(26, 26, 2.6, C.gold, 0.7)}${diamond(W - 26, 26, 2.6, C.gold, 0.7)}${diamond(26, fy2 - 2, 2.6, C.gold, 0.7)}${diamond(W - 26, fy2 - 2, 2.6, C.gold, 0.7)}

  <g fill="${C.goldInk}" opacity="0.92"><path transform="translate(${PAD} 58)" d="${title.d}"/></g>
  <g fill="${C.brownSoft}" opacity="0.7"><path transform="translate(${round(W - PAD - gloss.width)} 58)" d="${gloss.d}"/></g>

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
  writeFileSync(join(dir, 'instrumenta.svg'), svg, 'utf8');
}
