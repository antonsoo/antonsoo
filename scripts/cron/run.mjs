// The daily job that keeps the profile alive, run by Railway rather than by
// GitHub Actions.
//
// WHY THIS EXISTS. Until 2026-08-13 three workflows did this work:
// sententia.yml rotated the quote card, tabula.yml refreshed the ledger, and
// snake.yml redrew the contribution snake. On 2026-08-14 they all began failing
// before their first step with "The job was not started because your account is
// locked due to a billing issue". That lock is account-wide, so the
// free-for-public-repos rule does not rescue it, and the profile froze. Pushing
// is unaffected, so the work moved to a Railway cron container that does
// exactly what the runners used to do.
//
//   node scripts/cron/run.mjs           # the real thing
//   DRY_RUN=1 node scripts/cron/run.mjs # everything except the two pushes
//
// Environment: GH_TOKEN (required), PROFILE_USER, PROFILE_REPO, and
// PROFILE_REMOTE, which overrides the clone URL. Point that at a local bare
// clone to rehearse the whole thing, pushes included, without touching GitHub.
//
// It clones rather than working in place, so it always runs the generators as
// they are committed, and so a half-finished run leaves nothing behind. The
// rotation itself is free: gen-sententia already seeds assets/sententia.svg
// with today's card from the day of the year, the same formula sententia.yml
// used, so `npm run verify` both rotates the card and proves every other asset
// still matches its generator. That check used to be verify.yml's job and is
// now the only automated guard the generators have.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const USER = process.env.PROFILE_USER || 'antonsoo';
const REPO = process.env.PROFILE_REPO || 'antonsoo/antonsoo';
const DRY_RUN = !!process.env.DRY_RUN;
const AUTHOR_NAME = process.env.PROFILE_AUTHOR_NAME || 'praviel-scriptorium';
const AUTHOR_EMAIL = process.env.PROFILE_AUTHOR_EMAIL || 'antonnsoloviev@gmail.com';

if (!TOKEN) {
  console.error('GH_TOKEN is not set. Nothing can be fetched or pushed without it.');
  process.exit(1);
}

const remote = process.env.PROFILE_REMOTE || `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
/** Never let the token reach a log line, however the failure arrives. */
const redact = (s) => String(s).split(TOKEN).join('***');

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

function git(cwd, args, opts = {}) {
  try {
    return execFileSync('git', ['-c', `user.name=${AUTHOR_NAME}`, '-c', `user.email=${AUTHOR_EMAIL}`, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      ...opts,
    });
  } catch (err) {
    throw new Error(redact(`git ${args[0]} failed\n${err.stdout ?? ''}${err.stderr ?? ''}`));
  }
}

function npm(cwd, args) {
  try {
    return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    throw new Error(`npm ${args.join(' ')} failed\n${err.stdout ?? ''}${err.stderr ?? ''}`);
  }
}

async function api(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': `${USER}-profile-cron`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

/** Follower count, join year and public non-fork repo count, as tabula.yml counted them. */
async function ledger() {
  const me = await api(`users/${USER}`);
  let repos = 0;
  for (let page = 1; ; page++) {
    const batch = await api(`users/${USER}/repos?per_page=100&type=owner&page=${page}`);
    repos += batch.filter((r) => !r.private && !r.fork).length;
    if (batch.length < 100) break;
  }
  return { followers: me.followers, createdYear: Number(me.created_at.slice(0, 4)), publicRepos: repos };
}

/** Commit the named paths if any of them moved. Returns true if it pushed. */
function commitAndPush(dir, paths, message, branch) {
  const dirty = git(dir, ['status', '--porcelain', '--', ...paths]).trim();
  if (!dirty) {
    log(`  nothing changed on ${branch}`);
    return false;
  }
  log(`  changed:\n${dirty.split('\n').map((l) => `    ${l}`).join('\n')}`);
  git(dir, ['add', '--', ...paths]);
  git(dir, ['commit', '-m', message]);
  if (DRY_RUN) {
    log(`  DRY_RUN: not pushing to ${branch}`);
    return false;
  }
  git(dir, ['push', 'origin', `HEAD:${branch}`]);
  log(`  pushed to ${branch}`);
  return true;
}

// ---------------------------------------------------------------- main branch

async function rotateAndRefresh(work) {
  const dir = join(work, 'main');
  log('cloning main');
  git(work, ['clone', '--depth', '1', '--branch', 'main', remote, dir]);

  log('installing dependencies');
  npm(dir, ['ci', '--no-audit', '--no-fund']);

  log('refreshing the ledger from the GitHub API');
  const counts = await ledger();
  log(`  followers=${counts.followers} repos=${counts.publicRepos} since=${counts.createdYear}`);
  const statsPath = join(dir, 'scripts', 'stats-data.json');
  const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
  writeFileSync(statsPath, JSON.stringify({ ...stats, ...counts }, null, 2) + '\n');

  // Rotates today's card AND proves nothing else drifted. Fails loudly if a
  // generator regressed, in which case nothing is committed.
  log('regenerating and verifying');
  console.log(npm(dir, ['run', '--silent', 'verify']).trimEnd());

  const paths = ['assets/sententia.svg', 'assets/stats.svg', 'scripts/stats-data.json'];
  const moved = git(dir, ['status', '--porcelain', '--', ...paths]);
  const card = moved.includes('sententia');
  const ledgerMoved = moved.includes('stats');
  const message =
    card && ledgerMoved
      ? 'chore(profile): rotate daily card and refresh the ledger'
      : card
        ? 'chore(sententia): rotate daily card'
        : 'chore(tabula): refresh public ledger';
  commitAndPush(dir, paths, message, 'main');
  return dir;
}

// -------------------------------------------------------------- output branch

function redrawSnake(work, mainDir) {
  const dir = join(work, 'output');
  log('cloning output');
  git(work, ['clone', '--depth', '1', '--branch', 'output', remote, dir]);

  // Same two option strings snake.yml passed to Platane/snk, %23 encoding and
  // all: a raw # would be read as a URL fragment and the colour would be lost.
  const cli = join(mainDir, 'node_modules', 'generate-snake-animation', 'cli.js');
  log('drawing the snake');
  execFileSync(
    process.execPath,
    [
      cli,
      `--github_user=${USER}`,
      '--output=snake.svg?color_snake=%238B1E1E&color_dots=%23EDE4D3,%23E6CF94,%23C5A059,%23A24E30,%238B1E1E',
      '--output=snake-dark.svg?palette=github-dark&color_snake=%23E6CF94&color_dots=%23262220,%234A3A22,%237A5C2E,%23A8853F,%23C5A059',
    ],
    { cwd: dir, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GITHUB_TOKEN: TOKEN } },
  );

  commitAndPush(dir, ['snake.svg', 'snake-dark.svg'], 'chore(snake): redraw the contribution snake', 'output');
}

// ----------------------------------------------------------------------- main

const work = mkdtempSync(join(tmpdir(), 'profile-cron-'));
const failures = [];

try {
  const mainDir = await rotateAndRefresh(work);
  // Deliberately after the push above: a GitHub API hiccup while drawing the
  // snake must not cost the day its quote card.
  try {
    redrawSnake(work, mainDir);
  } catch (err) {
    failures.push(`snake: ${redact(err.message)}`);
  }
} catch (err) {
  failures.push(`main: ${redact(err.message)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} step(s) failed:\n${failures.join('\n\n')}`);
  process.exit(1);
}
log('done');
