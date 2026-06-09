// Regenerates scripts/angel.b64, the banner's embedded fresco panel, from the
// 4096px transparent master app icon. Run on demand only (the master lives
// outside this repo, and sharp is borrowed from the sibling praviel-website
// install, same as the raster-QA pattern in CLAUDE.md):
//
//   node scripts/make-angel.mjs
//
// Recipe: flatten over #EAE0D4 (the original fresco plaster tone), resize to
// 768px, mozjpeg q86. The panel displays at 192px inside the 1000px banner, so
// 768px stays crisp at 2-3x device pixel ratios; anything smaller or more
// compressed goes soft (the pre-2026-06 panel was a ~17KB 512px JPEG and
// looked pixelated). After running this, run `npm run gen:banner`.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(resolve(__dirname, '../../praviel-website/node_modules/sharp'));

const MASTER = join(
  process.env.HOME,
  'work/projects/praviel_files/extras/extra_icons/standard-app-icon_with-a-removed-background.png',
);

const buf = await sharp(MASTER)
  .flatten({ background: '#EAE0D4' })
  .resize(768, 768)
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

const out = join(__dirname, 'angel.b64');
writeFileSync(out, 'data:image/jpeg;base64,' + buf.toString('base64') + '\n');
console.log(`angel.b64 written (${buf.length} JPEG bytes). Now run: npm run gen:banner`);
