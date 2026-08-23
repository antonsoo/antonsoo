// One place that knows where the local-only image tooling lives, so the next
// directory move breaks one file instead of several.
//
// History: this repo used to sit beside praviel-website and borrowed sharp and
// puppeteer from its node_modules by relative path. The 2026 career
// reorganization moved it to career/antonsoo-profile and every one of those
// paths died at once. Both lookups below take an environment override first, so
// a move needs no code change at all.
//
//   PROFILE_SHARP=/abs/path/to/node_modules/sharp
//   PROFILE_CHROME=/abs/path/to/chrome
//
// Nothing here is needed to render the SVGs: `npm run gen:all` is pure
// opentype.js and harfbuzzjs. These are for rebaking embedded rasters
// (make-arms) and for raster QA, both of which run on demand.

import { existsSync, readdirSync, statSync, accessSync, constants } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

const isExecutable = (p) => {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Directories matching `parent/<glob-prefix>*`, newest-looking first. */
function globVersioned(parent, prefix) {
  try {
    return readdirSync(parent)
      .filter((n) => n.startsWith(prefix))
      .sort()
      .reverse()
      .map((n) => join(parent, n));
  } catch {
    return [];
  }
}

/**
 * sharp, which this repo deliberately does not depend on: it is a heavy native
 * package needed only for on-demand rebakes, and `npm ci` in the Railway cron
 * would pay for it every day. Install it locally (`npm i -D sharp`) and the
 * first candidate below finds it.
 */
export function requireSharp() {
  const candidates = [
    process.env.PROFILE_SHARP,
    join(ROOT, 'node_modules', 'sharp'),
    // The old sibling, three levels up since the career reorganization.
    resolve(__dirname, '../../../praviel_files/praviel-website/node_modules/sharp'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (!existsSync(c)) continue;
    try {
      return require(c);
    } catch (err) {
      console.warn(`sharp at ${c} would not load: ${err.message}`);
    }
  }
  throw new Error(
    'No usable sharp. Fix it with one of:\n' +
      '  npm i -D sharp                       (installs it into this repo)\n' +
      '  PROFILE_SHARP=/abs/path/node_modules/sharp\n' +
      `Tried:\n  ${candidates.join('\n  ')}`,
  );
}

/**
 * The first Chrome that exists and is executable. ~/bin/google-chrome is
 * excluded on purpose: it is a wrapper around a path the reorganization
 * deleted, so it sits on PATH and always fails. Same exclusion, same reason, as
 * career-dossier/scripts/render.py's find_chrome().
 *
 * Pass { shell: true } for screenshots. Chrome 132 and later run "new
 * headless", a real browser with real window furniture, and --window-size then
 * describes the WINDOW: measured on Chrome for Testing 142, the captured
 * viewport comes out 88px shorter than asked, so the bottom of a banner is
 * silently cropped and nothing warns you. chrome-headless-shell is the old
 * headless renderer, has no furniture, and gets the full height right.
 */
export function findChrome({ shell = false } = {}) {
  if (process.env.PROFILE_CHROME) {
    if (isExecutable(process.env.PROFILE_CHROME)) return process.env.PROFILE_CHROME;
    console.warn(`PROFILE_CHROME is set but unusable: ${process.env.PROFILE_CHROME}`);
  }

  const home = homedir();
  const shells = globVersioned(join(home, '.cache', 'ms-playwright'), 'chromium_headless_shell-').map(
    (d) => join(d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
  );
  const full = [
    ...globVersioned(join(home, 'chrome'), 'linux-').map((d) => join(d, 'chrome')),
    '/opt/google/chrome-unstable/chrome',
    ...globVersioned(join(home, '.cache', 'ms-playwright'), 'chromium-').map((d) =>
      join(d, 'chrome-linux', 'chrome'),
    ),
  ];
  const candidates = shell ? [...shells, ...full] : [...full, ...shells];

  // Never `google-chrome`: that is the dead wrapper.
  for (const name of ['chromium', 'chromium-browser', 'google-chrome-stable']) {
    try {
      candidates.push(execFileSync('which', [name], { encoding: 'utf8' }).trim());
    } catch {
      /* not on PATH */
    }
  }

  return candidates.find(isExecutable) ?? null;
}

/** Like findChrome, but throws the message you actually want to read. */
export function requireChrome(opts) {
  const chrome = findChrome(opts);
  if (!chrome) {
    throw new Error(
      'No usable Chrome found. Set PROFILE_CHROME to one, or install Chrome for Testing.\n' +
        'Note that ~/bin/google-chrome is a dead wrapper and is skipped deliberately.',
    );
  }
  return chrome;
}
