// Renders every entry in quotes.json to assets/sententia/NN.svg as a fully
// self-contained, animated "Sententia" card (text baked to vector paths).
// The daily GitHub Action swaps assets/sententia.svg to the day's card.
//
// Design: a scriptorium leaf. A rubricated margin column on the left (red ink,
// as a rubricator would), a ruled writing zone for the quote, a crimson hedera
// distinguens between original and translation, and the source set as a
// colophon in the lower right. Deliberately asymmetric; no corner ornaments.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, fitText, textBlock, layoutLine, round, escapeXml, hedera, ruling, toRoman, staticize } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets', 'sententia');
mkdirSync(OUT, { recursive: true });

const quotes = JSON.parse(readFileSync(join(__dirname, 'quotes.json'), 'utf8'));

const W = 860;
const H = 300;

// Margin column and writing zone.
const MARGIN_X = 36;          // rubric text left edge
const SEP_X = 170;            // vertical column separator
const ZONE_X0 = 196;          // writing zone
const ZONE_X1 = 820;
const ZONE_CX = (ZONE_X0 + ZONE_X1) / 2;

function buildCard(q, idx, total) {
  const allMissing = [];

  // Quote (original) and translation, auto-fit to the writing zone.
  const isGreek = q.lang === 'grc';
  const quoteFit = fitText(q.text, {
    maxWidth: ZONE_X1 - ZONE_X0 - 24,
    maxLines: 2,
    startSize: isGreek ? 46 : 44,
    minSize: 26,
    letterSpacing: isGreek ? 0.5 : 0.3,
  });
  const transFit = fitText(q.translation, {
    maxWidth: ZONE_X1 - ZONE_X0 - 80,
    maxLines: 2,
    startSize: 21,
    minSize: 16,
    letterSpacing: 0.2,
  });

  const qSize = quoteFit.size;
  const qLH = qSize * 1.16;
  const tSize = transFit.size;
  const tLH = tSize * 1.32;
  const qN = quoteFit.lines.length;
  const tN = transFit.lines.length;

  // Vertical layout, then centre the whole stack in the writing region.
  const gapQtoRule = 28;
  const ruleToTrans = 28;
  const qBaseline0 = qSize * 0.72;
  const qBottom = qBaseline0 + (qN - 1) * qLH + qSize * 0.06;
  const ruleY = qBottom + gapQtoRule;
  const tBaseline0 = ruleY + ruleToTrans + tSize * 0.72;
  const tBottom = tBaseline0 + (tN - 1) * tLH + tSize * 0.06;
  const totalH = tBottom;
  const regionCenter = (52 + (H - 56)) / 2;
  const offsetY = round(regionCenter - totalH / 2);

  const quoteBlock = textBlock(quoteFit.lines, {
    x: ZONE_CX,
    y: qBaseline0,
    fontSize: qSize,
    lineHeight: qLH,
    anchor: 'middle',
    fill: C.ink,
    letterSpacing: isGreek ? 0.5 : 0.3,
  });
  allMissing.push(...quoteBlock.missing);

  const transBlock = textBlock(transFit.lines, {
    x: ZONE_CX,
    y: tBaseline0,
    fontSize: tSize,
    lineHeight: tLH,
    anchor: 'middle',
    fill: C.brown,
    letterSpacing: 0.2,
  });
  allMissing.push(...transBlock.missing);

  // Separator: two short gold segments meeting a crimson hedera, draw-in intro.
  // Base state is the final (drawn, visible) state, so the rule shows even if
  // SMIL never runs; the <animate> only provides the draw-in at t=0.
  const segLen = 46;
  const seg = (x1, x2) => `
        <line x1="${round(x1)}" y1="${round(ruleY)}" x2="${round(x2)}" y2="${round(ruleY)}"
          stroke="${C.gold}" stroke-width="1.2" stroke-linecap="round"
          stroke-dasharray="${segLen}" stroke-dashoffset="0">
          <animate attributeName="stroke-dashoffset" from="${segLen}" to="0" dur="1.1s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${segLen};0"/>
        </line>`;
  const rule = `
      <g opacity="0.95">${seg(ZONE_CX - 64, ZONE_CX - 18)}${seg(ZONE_CX + 18, ZONE_CX + 64)}
        ${hedera(ZONE_CX + 1, ruleY, 17, C.crimson)}
      </g>`;

  // Rubric margin: red-ink label, Roman numeral index, a gold leaf at the foot.
  const rub1 = layoutLine('SENTENTIA', 15, { letterSpacing: 2.6 });
  const rub2 = layoutLine('DIEI', 15, { letterSpacing: 2.6 });
  const num = `${toRoman(idx + 1)} · ${toRoman(total)}`;
  const numLaid = layoutLine(num, 13, { letterSpacing: 1.4 });
  allMissing.push(...rub1.missing, ...rub2.missing, ...numLaid.missing);

  // Colophon (source), lower right of the writing zone.
  const source = layoutLine(q.source, 14, { letterSpacing: 1.2 });
  allMissing.push(...source.missing);

  const sepTop = 30;
  const sepLen = H - 14 - sepTop - 16;

  // Latin quotes carry their own final period; only add one where the
  // original (Greek, unpunctuated) ends bare, so aria never reads "..".
  const ariaSep = /[.!?;]$/.test(q.text.trim()) ? '' : '.';

  return {
    missing: allMissing,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(q.text)}${ariaSep} ${escapeXml(q.translation)} (${escapeXml(q.source)})">
  <defs>
    <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FEFCF8"/>
      <stop offset="1" stop-color="#F1ECE2"/>
    </linearGradient>
    <filter id="lift" x="-8%" y="-8%" width="116%" height="124%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#3A2A18" flood-opacity="0.20"/></filter>
  </defs>

  <g filter="url(#lift)">
    <rect x="6" y="5" width="${W - 12}" height="${H - 14}" rx="3" fill="url(#parch)" stroke="${C.cardEdge}" stroke-width="1"/>
  </g>

  ${ruling(ZONE_X0, 76, ZONE_X1 - ZONE_X0, 168, 24)}

  <line x1="${SEP_X}" y1="${sepTop}" x2="${SEP_X}" y2="${sepTop + sepLen}" stroke="${C.gold}" stroke-width="1" opacity="0.5" stroke-dasharray="${sepLen}" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" from="${sepLen}" to="0" dur="0.9s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="${sepLen};0"/>
  </line>

  <g fill="${C.crimson}" stroke="${C.crimson}" stroke-width="0.25">
    <path transform="translate(${MARGIN_X} 64)" d="${rub1.d}"/>
    <path transform="translate(${MARGIN_X} 88)" d="${rub2.d}"/>
  </g>
  <g fill="${C.brownSoft}"><path transform="translate(${MARGIN_X} 118)" d="${numLaid.d}"/></g>
  ${hedera(MARGIN_X + 10, H - 46, 15, C.gold, 0.8)}

  <g opacity="1">
    <animate attributeName="opacity" from="0" to="1" dur="0.85s" begin="0s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.95s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" values="0 10;0 0"/>
    <g transform="translate(0 ${offsetY})">
      ${quoteBlock.svg}
      ${rule}
      ${transBlock.svg}
    </g>
  </g>

  <g fill="${C.goldInk}" stroke="${C.goldInk}" stroke-width="0.2" opacity="1"><animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0s" fill="freeze"/><path transform="translate(${round(ZONE_X1 - source.width)} ${H - 34})" d="${source.d}"/></g>
</svg>`,
  };
}

const STATIC = !!process.env.STATIC;
let staticDir = null;
if (STATIC) {
  staticDir = join(ROOT, '.preview');
  mkdirSync(staticDir, { recursive: true });
}

// Render all cards.
let totalMissing = 0;
quotes.forEach((q, i) => {
  const { svg, missing } = buildCard(q, i, quotes.length);
  const name = `${String(i).padStart(2, '0')}.svg`;
  writeFileSync(join(OUT, name), svg, 'utf8');
  if (STATIC) writeFileSync(join(staticDir, name), staticize(svg), 'utf8');
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
