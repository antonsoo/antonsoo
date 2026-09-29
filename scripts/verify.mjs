// The three checks the old verify.yml workflow used to run (deleted in 2026-08),
// moved into the repo so they survive GitHub Actions being unavailable. Run them locally with
// `npm run verify`; the Railway cron runs the same file every morning against a
// fresh clone, which is now the only automated guard the generators have.
// `npm run verify` also runs the offline regression tests before these checks.
//
//   1. every generator regenerates and exits 0 (missing glyphs, writing-zone
//      overflow and grid-size assertions all exit nonzero from the generators)
//   2. byte-stability: re-running the generators changes nothing
//   3. no em or en dashes anywhere in the README or the assets
//
// The byte check hashes the assets before and after regenerating rather than
// asking git what changed. The workflow it replaced could use `git diff`
// because CI always ran against a clean checkout; run that locally and it
// flags your own in-progress asset edit as drift, which is noise. Hashing
// answers the question actually worth asking: are the generators deterministic,
// and is what is on disk what they produce?
//
// Two files are excluded from the byte check by design. gen-sententia seeds
// assets/sententia.svg with TODAY's card, and gen-stats recomputes years from
// the current UTC year, so both legitimately move.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DRIFTING = ['assets/sententia.svg', 'assets/stats.svg'];

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts });

/** Regenerate everything. Throws with the generator's own output on failure. */
export function generate() {
  try {
    return run('npm', ['run', '--silent', 'gen:all']);
  } catch (err) {
    throw new Error(`gen:all failed\n${err.stdout ?? ''}${err.stderr ?? ''}`);
  }
}

/** Generated/public asset files, excluding the ignored local image masters. */
function assetFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    // more_images/ holds the gitignored local masters; they are inputs.
    if (entry.isDirectory()) {
      if (entry.name !== 'more_images') out.push(...assetFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** sha256 of every public file under assets/, keyed by repo-relative path. */
export function hashAssets(dir = join(ROOT, 'assets')) {
  return Object.fromEntries(assetFiles(dir).map((full) => [
    relative(ROOT, full), createHash('sha256').update(readFileSync(full)).digest('hex'),
  ]));
}

/** Assets that regenerating moved, other than the two date-seeded ones. */
export function unexpectedDrift(before, after) {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((f) => !DRIFTING.includes(f) && before[f] !== after[f]).sort();
}

/** Files containing an em dash or en dash. The house style forbids both. */
export function dashes(root = ROOT) {
  // Scan in Node so a missing grep, unsupported -P, or unreadable input cannot
  // masquerade as "no matches". Binary files have no prose to lint; NUL is
  // the same binary marker used by the old grep -I invocation.
  return [join(root, 'README.md'), ...assetFiles(join(root, 'assets'))]
    .filter((full) => {
      const bytes = readFileSync(full);
      return !bytes.includes(0) && /[\u2013\u2014]/u.test(bytes.toString('utf8'));
    })
    .map((full) => relative(root, full))
    .sort();
}

export function verify({ quiet = false } = {}) {
  const say = (...a) => !quiet && console.log(...a);
  const before = hashAssets();
  const gen = generate();
  const notdef = gen.split('\n').filter((l) => l.includes('MISSING GLYPHS'));
  if (notdef.length) throw new Error(`missing glyphs:\n${notdef.join('\n')}`);
  say('generators   ok (all glyphs resolved)');

  const drift = unexpectedDrift(before, hashAssets());
  if (drift.length) {
    throw new Error(
      `regenerating changed these assets:\n  ${drift.join('\n  ')}\n` +
        `Only ${DRIFTING.join(' and ')} may move (date-seeded). ` +
        `If the change is intended, the new file IS the fix: commit it.`,
    );
  }
  say('byte-stable  ok');

  const bad = dashes();
  if (bad.length) throw new Error(`em or en dash found in:\n  ${bad.join('\n  ')}`);
  say('no dashes    ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verify();
    console.log('\nverified.');
  } catch (err) {
    console.error(`\nFAILED: ${err.message}`);
    process.exit(1);
  }
}
