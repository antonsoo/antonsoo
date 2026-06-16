// Regenerates scripts/thoth.b64, the banner's embedded fresco panel: Thoth, the
// ibis-headed reckoner of the scribes, papyrus and stylus in hand. Run on demand
// only (sharp is borrowed from the sibling praviel-website install, same as the
// raster-QA pattern in CLAUDE.md):
//
//   node scripts/make-thoth.mjs
//
// Recipe: take the 1254px master, resize to 768px, mozjpeg q90. The panel
// displays at 192px inside the 1000px banner, so 768px stays crisp well past 3x
// device pixel ratios (5K and up); q90 keeps the feather/hieroglyph detail from
// going mushy. The source already carries its own temple ground (no transparency),
// so there is nothing to flatten. After running this, run `npm run gen:banner`.
//
// The master under assets/more_images/ is gitignored (local-only, like the old
// external angel master); the committed artifact is scripts/thoth.b64, which
// gen-banner reads. A fresh clone can render the banner but cannot re-bake it
// without the local master.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(resolve(__dirname, '../../praviel-website/node_modules/sharp'));

const MASTER = join(__dirname, '..', 'assets', 'more_images', 'thoth-1.png');

const buf = await sharp(MASTER)
  .resize(768, 768)
  .jpeg({ quality: 90, mozjpeg: true })
  .toBuffer();

const out = join(__dirname, 'thoth.b64');
writeFileSync(out, 'data:image/jpeg;base64,' + buf.toString('base64') + '\n');
console.log(`thoth.b64 written (${buf.length} JPEG bytes). Now run: npm run gen:banner`);
