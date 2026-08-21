// Raster QA: screenshot an SVG the way GitHub shows it, through real headless
// Chrome. librsvg and sharp only ever draw the static base frame, so they
// cannot answer "does the entrance animation land"; Chrome can. GitHub renders
// README images in <img> mode, which still runs SMIL, so the wrapper below
// embeds the file as an <img> rather than inlining it.
//
//   node scripts/shot.mjs assets/banner.svg
//   node scripts/shot.mjs assets/banner.svg --bg=#0d1117 --scale=2 --out=/tmp/dark@2x.png
//
// Shoots through chrome-headless-shell where one is available: see findChrome
// in tools.mjs for why full Chrome's --headless crops the bottom of the frame.
//
// By default the SMIL is stripped with svglib's staticize, so the shot is the
// SETTLED frame. That is deliberate: the entrance animations begin at 0s and
// headless Chrome's shutter is not reliably synchronised to them, so shooting
// the live file mostly catches a half-faded intro. Since every card's base
// state is its final visible state (a repo invariant), the stripped frame is
// exactly what a reader ends up looking at. Pass --animated to shoot the live
// file and --wait to give it time.
//
// Flags: --width (CSS px of the image, default the SVG's own width), --bg,
// --scale (device pixel ratio), --pad, --out, --animated, --wait.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, basename, extname } from 'node:path';
import { requireChrome } from './tools.mjs';
import { staticize } from './svglib.mjs';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('usage: node scripts/shot.mjs <file.svg> [--width=] [--bg=] [--scale=] [--pad=] [--out=] [--animated] [--wait=]');
  process.exit(1);
}
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const svgPath = resolve(src);
const svg = readFileSync(svgPath, 'utf8');

// Intrinsic size, for the aspect ratio and the default width.
const vb = svg.match(/viewBox="([\d.\-\s]+)"/);
const [, , vbW, vbH] = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 0, 0];
const attrW = Number((svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/) || [])[1]);
const attrH = Number((svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/) || [])[1]);
const natW = attrW || vbW || 1000;
const natH = attrH || vbH || 400;

const width = Number(flag('width', natW));
const height = Math.round((width * natH) / natW);
const bg = flag('bg', '#ffffff');
const scale = Number(flag('scale', 1));
const pad = Number(flag('pad', 24));
const animated = args.includes('--animated');
const wait = Number(flag('wait', animated ? 6000 : 500));
const out = resolve(
  flag('out', join(tmpdir(), `${basename(svgPath, extname(svgPath))}-${bg.replace('#', '')}@${scale}x.png`)),
);

const dir = mkdtempSync(join(tmpdir(), 'shot-'));

// Shoot a copy, so --animated is the only thing that reaches Chrome live.
const shotSvg = join(dir, 'shot.svg');
writeFileSync(shotSvg, animated ? svg : staticize(svg), 'utf8');

const html = join(dir, 'page.html');
writeFileSync(
  html,
  `<!doctype html><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${bg};overflow:hidden}
body{padding:${pad}px}
img{width:${width}px;height:${height}px;display:block}</style>
<img src="file://${shotSvg}">`,
  'utf8',
);

const chrome = requireChrome({ shell: true });
execFileSync(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    `--force-device-scale-factor=${scale}`,
    `--virtual-time-budget=${wait}`,
    `--window-size=${width + pad * 2},${height + pad * 2}`,
    `--screenshot=${out}`,
    `file://${html}`,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

console.log(`${out}  (${(width + pad * 2) * scale}x${(height + pad * 2) * scale}, bg ${bg}, ${scale}x)`);
