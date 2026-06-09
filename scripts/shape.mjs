// HarfBuzz-backed text shaping for scripts opentype.js cannot lay out on its own:
// Arabic (contextual joining) and Devanagari/Sanskrit (conjuncts + reordering).
// We shape with HarfBuzz, then bake each glyph outline to a vector <path>, so the
// committed SVG carries no font dependency at view time, like the rest of the repo.

import { readFileSync } from 'node:fs';
import * as hb from 'harfbuzzjs';

function round(n) {
  return Math.round(n * 100) / 100;
}

const _cache = new Map();
function getFont(path) {
  if (!_cache.has(path)) {
    const data = readFileSync(path);
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const blob = new hb.Blob(ab);
    const face = new hb.Face(blob, 0);
    const font = new hb.Font(face);
    _cache.set(path, { font, upem: face.upem });
  }
  return _cache.get(path);
}

// Shape `text` with the font at `path` and size `fontSize` (px). Returns
// { svg, width, missing } where `svg` is a set of <path> elements positioned
// with the baseline at y=0 and the left edge at x=0 (HarfBuzz handles direction,
// so RTL runs come out visually ordered). Glyph outlines are in font units with
// Y up, so each is flipped (scale y by -1) into SVG's Y-down space.
export function shapeLine(path, text, fontSize) {
  const { font, upem } = getFont(path);
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);
  const items = buf.getGlyphInfosAndPositions();
  const scale = fontSize / upem;
  const s = scale.toFixed(6);
  let cursor = 0;
  let svg = '';
  const missing = [];
  for (const g of items) {
    if (g.codepoint === 0) missing.push(g.cluster);
    const d = font.glyphToPath(g.codepoint);
    if (d && d.length > 4) {
      const tx = round((cursor + (g.xOffset || 0)) * scale);
      const ty = round(-(g.yOffset || 0) * scale);
      svg += `<path transform="translate(${tx} ${ty}) scale(${s} -${s})" d="${d}"/>`;
    }
    cursor += g.xAdvance;
  }
  return { svg, width: cursor * scale, missing };
}
