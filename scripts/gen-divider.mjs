// Renders assets/divider-gold.svg: the section divider used between README
// blocks. A gold rule fading at both ends, two interpunct dots, and a crimson
// hedera distinguens at the centre, drawn by the shared svglib helper so the
// leaf stays in lockstep with every other hedera on the profile.
//
// The gradient MUST stay gradientUnits="userSpaceOnUse": a bounding-box
// gradient is degenerate on a horizontal line (zero-height bbox) and the rule
// disappears in librsvg and browsers alike.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, hedera } from './svglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="24" viewBox="0 0 900 24" role="presentation" aria-hidden="true">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="70" y1="12" x2="830" y2="12">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0"/>
      <stop offset="0.4" stop-color="${C.gold}" stop-opacity="0.75"/>
      <stop offset="0.6" stop-color="${C.gold}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <line x1="70" y1="12" x2="420" y2="12" stroke="url(#g)" stroke-width="1.1"/>
  <line x1="480" y1="12" x2="830" y2="12" stroke="url(#g)" stroke-width="1.1"/>
  <circle cx="432" cy="12" r="1.6" fill="${C.gold}" opacity="0.75"/>
  <circle cx="468" cy="12" r="1.6" fill="${C.gold}" opacity="0.75"/>
  ${hedera(451, 12, 17, C.crimson)}
</svg>
`;

writeFileSync(join(ROOT, 'assets', 'divider-gold.svg'), svg, 'utf8');
console.log(`divider-gold.svg written (${svg.length} bytes).`);
