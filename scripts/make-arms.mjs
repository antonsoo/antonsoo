// Regenerates scripts/arms.b64, the banner's embedded device: the Soloviev
// family arms. An oak tree on a blue field under a silver chief of three bees,
// a crowned helm with an anchor crest in blue plumes, blue and gold mantling.
// Run on demand only; scripts/tools.mjs finds sharp (see requireSharp for where
// it looks and how to override it):
//
//   node scripts/make-arms.mjs && npm run gen:banner
//
// Recipe: trim the master's transparent margins so the device fills its box
// predictably, resize to 684px tall, quantize to a 256-colour palette.
//
// PNG, not JPEG: heraldry has to stand free on the banner ground, which is a
// gradient under two radial washes and a grain filter, so there is nothing flat
// to flatten against and the alpha has to survive. That rules out the mozjpeg
// recipe in make-thoth.mjs. The device displays at 228px inside the 1000px
// banner, so 684px covers 3x device pixel ratios. The 256-colour palette was
// chosen by comparison: it is visually indistinguishable from true colour at
// display size and costs a third of the bytes, while 128 colours dithers
// visibly across the blue plumes.
//
// The master under assets/more_images/ is gitignored (local-only, like
// thoth-1.png); the committed artifact is scripts/arms.b64, which gen-banner
// reads. A fresh clone can render the banner but cannot re-bake it.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { requireSharp } from './tools.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharp = requireSharp();

const MASTER = join(__dirname, '..', 'assets', 'more_images', 'arms.png');
const HEIGHT = 684;

const trimmed = await sharp(MASTER).trim({ threshold: 1 }).toBuffer();
const buf = await sharp(trimmed)
  .resize({ height: HEIGHT, fit: 'inside' })
  .png({ palette: true, colours: 256, effort: 10, compressionLevel: 9 })
  .toBuffer();

const { width, height } = await sharp(buf).metadata();
const out = join(__dirname, 'arms.b64');
writeFileSync(out, 'data:image/png;base64,' + buf.toString('base64') + '\n');
console.log(
  `arms.b64 written (${width}x${height}, ${(buf.length / 1024).toFixed(1)} KB PNG, ` +
    `aspect ${(width / height).toFixed(3)}). Now run: npm run gen:banner`,
);
