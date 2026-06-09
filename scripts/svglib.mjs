// Shared SVG helpers for the antonsoo profile widgets.
// Everything renders text as vector <path> via opentype.js so glyphs (incl.
// polytonic Greek) are identical in every renderer and survive GitHub's Camo
// image proxy with no font dependency.

import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, 'fonts');
export const FONT_PATH = join(FONT_DIR, 'NotoSerifDisplay.ttf');

// PRAVIEL "Imperial Roman" palette (from praviel-website app/globals.css).
export const C = {
  parchment: '#FDFBF7',
  card: '#F3EFE7',
  cardEdge: '#EAE3D6',
  ink: '#1A1919',
  brown: '#5D4E42',
  brownSoft: '#5D5147',
  crimson: '#8B1E1E',
  crimsonDeep: '#6E1818',
  terracotta: '#C45B36',
  gold: '#C5A059',
  goldInk: '#5E4722',
  goldSoft: '#D8C390',
};

// Font cache keyed by absolute path, so a generator can mix scripts (the Linguae
// card pairs the Latin/Greek/Cyrillic display serif with vendored Hebrew, Gothic
// and CJK faces). The default font stays NotoSerifDisplay for every existing
// widget; pass `font` to layoutLine/textBlock to use another face.
const _fonts = new Map();
export function loadFont(path) {
  if (!_fonts.has(path)) _fonts.set(path, opentype.loadSync(path));
  return _fonts.get(path);
}
// Resolve a bare filename against scripts/fonts/, or use an absolute path as-is.
export function fontFile(name) {
  return name.includes('/') ? name : join(FONT_DIR, name);
}
export function font() {
  return loadFont(FONT_PATH);
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Reorder a right-to-left run for visual layout. opentype.js does no bidi or
// shaping, so we reverse grapheme clusters (a base char keeps its trailing
// combining marks) before laying glyphs out left to right. Intended for short,
// non-joining RTL labels (Hebrew / square-script Aramaic); we keep those
// unpointed so there are no marks needing GPOS attachment.
export function reverseForRtl(text) {
  const clusters = [];
  for (const cp of Array.from(text)) {
    if (clusters.length && /\p{M}/u.test(cp)) clusters[clusters.length - 1] += cp;
    else clusters.push(cp);
  }
  return clusters.reverse().join('');
}

// Lay out one line as a single path `d`, baseline at y=0, starting at x=0.
// Applies kerning + optional uniform letter-spacing. `font` selects the face
// (default NotoSerifDisplay); `rtl` reverses for right-to-left scripts.
// Returns { d, width, missing }.
export function layoutLine(text, fontSize, { letterSpacing = 0, font: fnt, rtl = false } = {}) {
  const f = fnt || font();
  const scale = fontSize / f.unitsPerEm;
  const src = rtl ? reverseForRtl(text) : text;
  const cps = Array.from(src); // code points, so surrogate-pair scripts align
  const glyphs = f.stringToGlyphs(src);
  let x = 0;
  let d = '';
  const missing = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const ch = cps[i];
    if (g.index === 0 && ch && ch.trim()) missing.push(ch);
    const p = g.getPath(x, 0, fontSize);
    const pd = p.toPathData(2);
    if (pd) d += pd + ' ';
    let adv = (g.advanceWidth || 0) * scale;
    if (i < glyphs.length - 1) {
      adv += f.getKerningValue(g, glyphs[i + 1]) * scale;
    }
    x += adv + letterSpacing;
  }
  return { d: d.trim(), width: Math.max(0, x - letterSpacing), missing };
}

export function measure(text, fontSize, letterSpacing = 0, fnt) {
  return layoutLine(text, fontSize, { letterSpacing, font: fnt }).width;
}

// Greedy word-wrap to a max width at a given font size. Returns array of lines.
export function wrap(text, fontSize, maxWidth, letterSpacing = 0, fnt) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (measure(trial, fontSize, letterSpacing, fnt) <= maxWidth || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Shrink font size until the wrapped text fits within maxWidth x maxLines.
export function fitText(text, { maxWidth, maxLines = 2, startSize = 48, minSize = 16, letterSpacing = 0, font: fnt }) {
  let size = startSize;
  while (size > minSize) {
    const lines = wrap(text, size, maxWidth, letterSpacing, fnt);
    const widest = Math.max(...lines.map((l) => measure(l, size, letterSpacing, fnt)));
    if (lines.length <= maxLines && widest <= maxWidth) {
      return { size, lines };
    }
    size -= 1;
  }
  return { size: minSize, lines: wrap(text, minSize, maxWidth, letterSpacing, fnt) };
}

// Build a positioned, multi-line text block as one <path>. Anchor: start|middle|end.
// Returns { svg, missing } where svg is a <path .../> string.
export function textBlock(
  lines,
  { x, y, fontSize, lineHeight, anchor = 'start', fill = C.ink, letterSpacing = 0, opacity = 1, extra = '', font: fnt, rtl = false } = {},
) {
  let body = '';
  const missing = [];
  lines.forEach((line, i) => {
    const laid = layoutLine(line, fontSize, { letterSpacing, font: fnt, rtl });
    missing.push(...laid.missing);
    let dx = x;
    if (anchor === 'middle') dx = x - laid.width / 2;
    else if (anchor === 'end') dx = x - laid.width;
    const ty = y + i * lineHeight;
    body += `<path transform="translate(${round(dx)} ${round(ty)})" d="${laid.d}"/>`;
  });
  const op = opacity === 1 ? '' : ` opacity="${opacity}"`;
  return {
    svg: `<g fill="${fill}"${op}${extra ? ' ' + extra : ''}>${body}</g>`,
    missing,
  };
}

export function round(n) {
  return Math.round(n * 100) / 100;
}

// Roman numerals, subtractive notation; 0 -> N (nulla).
export function toRoman(n) {
  if (n <= 0) return 'N';
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

// ---------------------------------------------------------------------------
// Ornament vocabulary. Authentic Greco-Roman devices, shared by every widget:
// the hedera distinguens (ivy-leaf divider of Roman inscriptions), the meander
// fret, the tabula ansata (dovetail-handled dedication plaque), scriptorium
// ruling, and a chiseled "incised lettering" treatment. These replaced the old
// corner diamonds / radial glow card template on purpose; do not bring it back.
// ---------------------------------------------------------------------------

// Ivy leaf on a horizontal axis: tip points right, stalk curls away left
// (set flip=true to mirror). `size` is the leaf+stalk width in px.
// Designed on a 17x14 box centred on the leaf body.
export function hedera(cx, cy, size = 16, fill = C.crimson, opacity = 1, flip = false) {
  const k = round(size / 17);
  const sx = flip ? -k : k;
  const leaf = 'M7 0C5 -5.6 -0.6 -7.2 -3.9 -5C-6.6 -3.1 -6.5 -0.9 -3.4 0C-6.5 0.9 -6.6 3.1 -3.9 5C-0.6 7.2 5 5.6 7 0Z';
  const stalk = 'M-3.4 0C-6.2 -0.3 -7.9 -1.4 -9.1 -3.3';
  return `<g transform="translate(${round(cx)} ${round(cy)}) scale(${sx} ${k})" opacity="${opacity}">` +
    `<path d="${leaf}" fill="${fill}"/>` +
    `<path d="${stalk}" fill="none" stroke="${fill}" stroke-width="1.2" stroke-linecap="round"/>` +
    `</g>`;
}

// Greek-key fret strip: repeated squared-spiral hooks, stroke-drawn. `s` is the
// step; each hook is 3s wide and 3s tall on a pitch of 4s. Returns one <path>
// with M-separated subpaths, so a stroke-dashoffset draw-in still works.
export function meanderStrip(x, y, w, s = 3, stroke = C.gold, strokeWidth = 1, opacity = 0.45) {
  const pitch = 4 * s;
  const n = Math.max(1, Math.floor((w - 3 * s) / pitch) + 1);
  const used = (n - 1) * pitch + 3 * s;
  let d = '';
  const x0 = round(x + (w - used) / 2);
  for (let i = 0; i < n; i++) {
    const ux = round(x0 + i * pitch);
    d += `M${ux} ${round(y + 3 * s)}v${-3 * s}h${3 * s}v${3 * s}h${-2 * s}v${-2 * s}h${s}`;
  }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

// Tabula ansata: plaque body plus trapezoidal dovetail handles (ansae) on the
// left and right, each pierced by a nail hole. Returns { body, ansae, holes }
// path strings so callers can fill/stroke layers independently.
export function ansaFrame(x, y, w, h, { ansaW = 32, ansaH = 88, taper = 18, holeR = 3.6 } = {}) {
  const cy = y + h / 2;
  const body = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  const left = `M${x} ${round(cy - ansaH / 2)}L${x} ${round(cy + ansaH / 2)}L${x - ansaW} ${round(cy + ansaH / 2 - taper)}L${x - ansaW} ${round(cy - ansaH / 2 + taper)}Z`;
  const right = `M${x + w} ${round(cy - ansaH / 2)}L${x + w} ${round(cy + ansaH / 2)}L${x + w + ansaW} ${round(cy + ansaH / 2 - taper)}L${x + w + ansaW} ${round(cy - ansaH / 2 + taper)}Z`;
  const holes = [
    { cx: round(x - ansaW * 0.52), cy: round(cy), r: holeR },
    { cx: round(x + w + ansaW * 0.52), cy: round(cy), r: holeR },
  ];
  return { body, ansae: left + right, holes };
}

// Scriptorium ruling: faint horizontal guide lines behind a writing zone.
export function ruling(x, y, w, h, step = 24, stroke = C.gold, opacity = 0.14) {
  let out = '';
  for (let ly = y; ly <= y + h; ly += step) {
    out += `<line x1="${round(x)}" y1="${round(ly)}" x2="${round(x + w)}" y2="${round(ly)}" stroke="${stroke}" stroke-width="0.6"/>`;
  }
  return `<g opacity="${opacity}">${out}</g>`;
}

// Chiseled (V-cut) lettering on parchment: a pale catch-light peeking below,
// a dark sliver above, stone-brown face on top. `laid` is a layoutLine result.
export function incised(laid, x, y, { face = C.brown, light = '#FFFFFF', dark = '#2A2018' } = {}) {
  return (
    `<path transform="translate(${round(x)} ${round(y + 1.5)})" d="${laid.d}" fill="${light}" opacity="0.85"/>` +
    `<path transform="translate(${round(x)} ${round(y - 0.9)})" d="${laid.d}" fill="${dark}" opacity="0.35"/>` +
    `<path transform="translate(${round(x)} ${round(y)})" d="${laid.d}" fill="${face}"/>`
  );
}
