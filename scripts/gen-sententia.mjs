// Renders every entry in quotes.json to assets/sententia/NN.svg as a fully
// self-contained, animated "Sententia" card (text baked to vector paths).
// The daily GitHub Action swaps assets/sententia.svg to the day's card.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, fitText, textBlock, layoutLine, round, escapeXml } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets', 'sententia');
mkdirSync(OUT, { recursive: true });

const quotes = JSON.parse(readFileSync(join(__dirname, 'quotes.json'), 'utf8'));

const W = 860;
const H = 300;
const PAD = 46;
const CX = W / 2;

function diamond(cx, cy, r, fill, opacity = 1, extra = '') {
  return `<path d="M${round(cx)} ${round(cy - r)}L${round(cx + r)} ${round(cy)}L${round(cx)} ${round(cy + r)}L${round(cx - r)} ${round(cy)}Z" fill="${fill}" opacity="${opacity}"${extra ? ' ' + extra : ''}/>`;
}

function buildCard(q, idx, total) {
  const allMissing = [];

  // Quote (original) and translation, auto-fit.
  const isGreek = q.lang === 'grc';
  const quoteFit = fitText(q.text, {
    maxWidth: W - 2 * (PAD + 24),
    maxLines: 2,
    startSize: isGreek ? 47 : 45,
    minSize: 26,
    letterSpacing: isGreek ? 0.5 : 0.3,
  });
  const transFit = fitText(q.translation, {
    maxWidth: W - 2 * (PAD + 70),
    maxLines: 2,
    startSize: 22,
    minSize: 15,
    letterSpacing: 0.2,
  });

  const qSize = quoteFit.size;
  const qLH = qSize * 1.16;
  const tSize = transFit.size;
  const tLH = tSize * 1.32;
  const qN = quoteFit.lines.length;
  const tN = transFit.lines.length;

  // Vertical layout, then centre the whole stack in the body region.
  const gapQtoRule = 30;
  const ruleToTrans = 30;
  const qBaseline0 = qSize * 0.72;
  const qBottom = qBaseline0 + (qN - 1) * qLH + qSize * 0.06;
  const ruleY = qBottom + gapQtoRule;
  const tBaseline0 = ruleY + ruleToTrans + tSize * 0.72;
  const tBottom = tBaseline0 + (tN - 1) * tLH + tSize * 0.06;
  const totalH = tBottom;
  const regionCenter = (86 + (H - 54)) / 2;
  const offsetY = round(regionCenter - totalH / 2);

  // Quote paths.
  const quoteBlock = textBlock(quoteFit.lines, {
    x: CX,
    y: qBaseline0,
    fontSize: qSize,
    lineHeight: qLH,
    anchor: 'middle',
    fill: C.ink,
    letterSpacing: isGreek ? 0.5 : 0.3,
  });
  allMissing.push(...quoteBlock.missing);

  // Translation paths.
  const transBlock = textBlock(transFit.lines, {
    x: CX,
    y: tBaseline0,
    fontSize: tSize,
    lineHeight: tLH,
    anchor: 'middle',
    fill: C.brown,
    letterSpacing: 0.2,
  });
  allMissing.push(...transBlock.missing);

  // Gold rule with end diamonds and a centred marker, animated draw-in.
  const ruleHalf = 46;
  // Base state is the final (drawn, visible) state, so the rule shows even if
  // SMIL never runs; the <animate> only provides the draw-in intro at t=0.
  const rule = `
      <g opacity="0.9">
        <line x1="${round(CX - ruleHalf)}" y1="${round(ruleY)}" x2="${round(CX + ruleHalf)}" y2="${round(ruleY)}"
          stroke="${C.gold}" stroke-width="1.4" stroke-linecap="round"
          stroke-dasharray="${ruleHalf * 2}" stroke-dashoffset="0">
          <animate attributeName="stroke-dashoffset" from="${ruleHalf * 2}" to="0" dur="1.1s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${ruleHalf * 2};0"/>
        </line>
        ${diamond(CX, ruleY, 3.4, C.crimson, 1)}
      </g>`;

  // Top label + index, bottom-right source.
  const label = layoutLine('SENTENTIA  DIEI', 13.5, { letterSpacing: 3.4 });
  allMissing.push(...label.missing);
  const num = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const numLaid = layoutLine(num, 12.5, { letterSpacing: 2 });

  const source = layoutLine(q.source, 14.5, { letterSpacing: 1.2 });
  allMissing.push(...source.missing);

  // Inner-frame corner ornaments.
  const fx1 = 16, fy1 = 16, fx2 = W - 16, fy2 = H - 16;
  const corners =
    diamond(fx1 + 10, fy1 + 10, 2.6, C.gold, 0.7) +
    diamond(fx2 - 10, fy1 + 10, 2.6, C.gold, 0.7) +
    diamond(fx1 + 10, fy2 - 10, 2.6, C.gold, 0.7) +
    diamond(fx2 - 10, fy2 - 10, 2.6, C.gold, 0.7);

  return {
    missing: allMissing,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(q.text)}. ${escapeXml(q.translation)} (${escapeXml(q.source)})">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.14" r="0.9">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.14"/>
      <stop offset="0.5" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0"/></filter>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="124%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)">
    <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/>
  </g>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="url(#glow)"/>
  <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="15" fill="#000" filter="url(#grain)" opacity="0.5" clip-path="inset(0 round 15px)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 36}" rx="9" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.55"/>
  ${corners}

  <g fill="${C.goldInk}" opacity="0.92"><path transform="translate(${PAD} 60)" d="${label.d}"/></g>
  <g fill="${C.brownSoft}" opacity="0.85"><path transform="translate(${round(W - PAD - numLaid.width)} 60)" d="${numLaid.d}"/></g>

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    <g transform="translate(0 ${offsetY})">
      ${quoteBlock.svg}
      ${rule}
      ${transBlock.svg}
    </g>
  </g>

  <g fill="${C.goldInk}" opacity="0.9"><animate attributeName="opacity" from="0" to="0.9" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${round(W - PAD - source.width)} ${H - 38})" d="${source.d}"/></g>
</svg>`,
  };
}

// For offline visual QA: collapse animations to their final state so a static
// rasterizer (librsvg/sharp, which ignore SMIL) shows the finished card.
function staticize(svg) {
  // Leading space avoids clobbering stop-opacity / fill-opacity etc.
  return svg
    .replaceAll(' opacity="0"', ' opacity="1"')
    .replaceAll('stroke-dashoffset="92"', 'stroke-dashoffset="0"');
}
const STATIC = !!process.env.STATIC;
let staticDir = null;
if (STATIC) {
  staticDir = join(ROOT, '.preview');
  mkdirSync(staticDir, { recursive: true });
}

// Render all cards.
const manifest = [];
let totalMissing = 0;
quotes.forEach((q, i) => {
  const { svg, missing } = buildCard(q, i, quotes.length);
  const name = `${String(i).padStart(2, '0')}.svg`;
  writeFileSync(join(OUT, name), svg, 'utf8');
  if (STATIC) writeFileSync(join(staticDir, name), staticize(svg), 'utf8');
  manifest.push({ i, file: `assets/sententia/${name}`, source: q.source, lang: q.lang, missing });
  if (missing.length) {
    totalMissing += missing.length;
    console.warn(`  ! ${name} (${q.source}) missing glyphs: ${JSON.stringify(missing)}`);
  }
});

// Default displayed card: seed with TODAY's card using the same formula as the
// rotation workflow (idx = (UTC day-of-year - 1) % count), so regenerating and
// committing never knocks the profile back to card 0 mid-cycle.
const now = new Date();
const utcDayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
const seedIdx = (utcDayOfYear - 1) % quotes.length;
writeFileSync(join(ROOT, 'assets', 'sententia.svg'), buildCard(quotes[seedIdx], seedIdx, quotes.length).svg, 'utf8');

console.log(`Rendered ${quotes.length} sententia cards -> assets/sententia/`);
console.log(`Seed card (UTC day ${utcDayOfYear} -> index ${seedIdx}) -> assets/sententia.svg`);
if (totalMissing === 0) console.log('All glyphs resolved (no .notdef).');
else console.log(`WARNING: ${totalMissing} missing glyph(s) above.`);
