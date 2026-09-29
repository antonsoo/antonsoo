import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { dashes, missingReferences, unexpectedDrift } from '../scripts/verify.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'profile-verify-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets', 'sententia'), { recursive: true });
  writeFileSync(join(root, 'README.md'), 'A clean profile.');
  return root;
}

test('checks the README and nested assets for either forbidden dash', (t) => {
  const root = fixture(t);
  assert.deepEqual(dashes(root), []);
  writeFileSync(join(root, 'README.md'), 'Text \u2014 more text.');
  writeFileSync(join(root, 'assets', 'sententia', '00.svg'), '<svg aria-label="A\u2013B"/>');
  assert.deepEqual(dashes(root), ['README.md', 'assets/sententia/00.svg']);
});

test('ignores binary assets and local image masters', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'assets', 'more_images'));
  writeFileSync(join(root, 'assets', 'more_images', 'notes.txt'), 'Private \u2014 master');
  writeFileSync(join(root, 'assets', 'image.png'), Buffer.from('\0\u2014'));
  assert.deepEqual(dashes(root), []);
});

test('missing inputs are failures, never a clean dash scan', (t) => {
  const root = fixture(t);
  rmSync(join(root, 'README.md'));
  assert.throws(() => dashes(root), /ENOENT/);
  writeFileSync(join(root, 'README.md'), 'Clean');
  rmSync(join(root, 'assets'), { recursive: true });
  assert.throws(() => dashes(root), /ENOENT/);
});

test('CLI runs its checks from paths containing spaces and URL characters', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'profile verify #% '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  const script = join(root, 'scripts', 'verify.mjs');
  copyFileSync(fileURLToPath(new URL('../scripts/verify.mjs', import.meta.url)), script);
  // Deliberately no assets/: actually running verification must fail before
  // reaching a generator. A skipped entry point incorrectly exits zero.
  const result = spawnSync(process.execPath, [script], {
    cwd: root, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAILED:.*ENOENT/);
});

test('only the daily card and stats may drift; additions and deletions count', () => {
  const before = {
    'assets/banner.svg': 'a', 'assets/sententia.svg': 'b',
    'assets/stats.svg': 'c', 'assets/deleted.svg': 'd',
  };
  const after = {
    'assets/banner.svg': 'changed', 'assets/sententia.svg': 'today',
    'assets/stats.svg': 'new year', 'assets/new.svg': 'e',
  };
  assert.deepEqual(unexpectedDrift(before, after), [
    'assets/banner.svg', 'assets/deleted.svg', 'assets/new.svg',
  ]);
  assert.deepEqual(unexpectedDrift(before, before), []);
});

test('every local file the README points at must exist', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'assets', 'banner.svg'), '<svg/>');
  writeFileSync(join(root, 'README.md'), [
    '<img src="assets/banner.svg" alt="" />',
    '<img src="assets/opera-minora/renamed.jpg" alt="" />',
    '<source srcset="assets/dark.svg 2x, https://example.com/x.svg" />',
    '![card](assets/sententia/missing%20card.svg "title")',
    '[scripts](scripts/) [site](https://praviel.com) [mail](mailto:a@b.c) [top](#about)',
    '<a href="https://github.com/antonsoo"><img src="https://img.shields.io/x" /></a>',
  ].join('\n'));
  mkdirSync(join(root, 'scripts'));
  assert.deepEqual(missingReferences(root), [
    'assets/dark.svg', 'assets/opera-minora/renamed.jpg', 'assets/sententia/missing card.svg',
  ]);
});

test('the real README references only files that exist', () => {
  assert.deepEqual(missingReferences(), []);
});
