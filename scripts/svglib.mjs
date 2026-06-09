// Shared SVG helpers for the antonsoo profile widgets.
// Everything renders text as vector <path> via opentype.js so glyphs (incl.
// polytonic Greek) are identical in every renderer and survive GitHub's Camo
// image proxy with no font dependency.

import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FONT_PATH = join(__dirname, 'fonts', 'NotoSerifDisplay.ttf');

// PRAVIEL "Imperial Roman" palette (from praviel-website app/globals.css).
export const C = {
  parchment: '#FDFBF7',
  card: '#F3EFE7',
  cardEdge: '#EAE3D6',
  ink: '#1A1919',
  brown: '#5D4E42',
  brownSoft: '#776B61',
  crimson: '#8B1E1E',
  crimsonDeep: '#6E1818',
  terracotta: '#C45B36',
  gold: '#C5A059',
  goldInk: '#816A3A',
  goldSoft: '#D8C390',
};

let _font = null;
export function font() {
  if (!_font) _font = opentype.loadSync(FONT_PATH);
  return _font;
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lay out one line as a single path `d`, baseline at y=0, starting at x=0.
// Applies kerning + optional uniform letter-spacing. Returns { d, width }.
export function layoutLine(text, fontSize, { letterSpacing = 0 } = {}) {
  const f = font();
  const scale = fontSize / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(text);
  let x = 0;
  let d = '';
  const missing = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.index === 0 && text[i] && text[i].trim()) missing.push(text[i]);
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

export function measure(text, fontSize, letterSpacing = 0) {
  return layoutLine(text, fontSize, { letterSpacing }).width;
}

// Greedy word-wrap to a max width at a given font size. Returns array of lines.
export function wrap(text, fontSize, maxWidth, letterSpacing = 0) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (measure(trial, fontSize, letterSpacing) <= maxWidth || !cur) {
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
export function fitText(text, { maxWidth, maxLines = 2, startSize = 48, minSize = 16, letterSpacing = 0 }) {
  let size = startSize;
  while (size > minSize) {
    const lines = wrap(text, size, maxWidth, letterSpacing);
    const widest = Math.max(...lines.map((l) => measure(l, size, letterSpacing)));
    if (lines.length <= maxLines && widest <= maxWidth) {
      return { size, lines };
    }
    size -= 1;
  }
  return { size: minSize, lines: wrap(text, minSize, maxWidth, letterSpacing) };
}

// Build a positioned, multi-line text block as one <path>. Anchor: start|middle|end.
// Returns { svg, missing } where svg is a <path .../> string.
export function textBlock(
  lines,
  { x, y, fontSize, lineHeight, anchor = 'start', fill = C.ink, letterSpacing = 0, opacity = 1, extra = '' } = {},
) {
  let body = '';
  const missing = [];
  lines.forEach((line, i) => {
    const laid = layoutLine(line, fontSize, { letterSpacing });
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
