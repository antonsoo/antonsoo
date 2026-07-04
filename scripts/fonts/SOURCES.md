# Vendored fonts

All fonts here are licensed under the SIL Open Font License 1.1 (see `OFL.txt`).
They are committed so the generators in `scripts/` can bake text to vector paths
offline (CI never needs a network font fetch).

| File | Font | Used by | Source |
| :-- | :-- | :-- | :-- |
| `Cinzel.ttf` | Cinzel (variable, wght) | titling: the name, engraved card titles, Roman numerals, all-caps labels | google/fonts `ofl/cinzel` |
| `EBGaramond.ttf` | EB Garamond (variable, wght) | body: prose, quotes, translations, glosses, and the linguae Latin / Greek / Cyrillic native words | google/fonts `ofl/ebgaramond` |
| `NotoSerifHebrew.ttf` | Noto Serif Hebrew | linguae (Hebrew + square-script Aramaic) | google/fonts `ofl/notoserifhebrew` |
| `NotoSansGothic.ttf` | Noto Sans Gothic | linguae (Gothic) | google/fonts `ofl/notosansgothic` |
| `NotoSansImperialAramaic.ttf` | Noto Sans Imperial Aramaic | linguae (Aramaic, in the Imperial script) | google/fonts `ofl/notosansimperialaramaic` |
| `NotoNaskhArabic.ttf` | Noto Naskh Arabic | linguae (Classical Arabic, shaped via HarfBuzz) | google/fonts `ofl/notonaskharabic` |
| `NotoSerifDevanagari.ttf` | Noto Serif Devanagari | linguae (Sanskrit, shaped via HarfBuzz) | google/fonts `ofl/notoserifdevanagari` |
| `NotoSerifSC-subset.ttf` | Noto Serif SC (subset) | linguae (Classical Chinese: 文 言) | built by `scripts/make-cjk-subset.mjs` from google/fonts `ofl/notoserifsc` |

`NotoSerifSC-subset.ttf` is a ~2 KB subset holding only the two Han glyphs the
Linguae card displays, so the repo never carries the full ~25 MB CJK font. To
rebuild it (e.g. after changing the Han string on the card), run
`node scripts/make-cjk-subset.mjs`; it caches the full font under
`scripts/fonts/.cache/` (gitignored) and rewrites the subset.

Arabic and Devanagari need contextual shaping (joining, conjuncts, reordering)
that opentype.js does not perform, so the Linguae generator shapes those two
labels with `harfbuzzjs` (a HarfBuzz WASM build, the shaper browsers use) and
bakes the resulting glyph outlines to vector paths. See `scripts/shape.mjs`.

Copyright for the Noto faces: © The Noto Project Authors
(https://github.com/notofonts). Cinzel: © Natanael Gama (Ndiscovery). EB
Garamond: © Georg Duffner and Octavio Pardo. All under the OFL 1.1 in `OFL.txt`.

Cinzel and EB Garamond ship as variable fonts (a single `wght` axis); the
generators bake the default instance (Regular) to vector paths via opentype.js,
which is deterministic, so CI byte-stability holds.
