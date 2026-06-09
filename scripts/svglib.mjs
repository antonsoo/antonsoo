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
  brownSoft: '#6A5D52',
  crimson: '#8B1E1E',
  crimsonDeep: '#6E1818',
  terracotta: '#C45B36',
  gold: '#C5A059',
  goldInk: '#6B5128',
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
