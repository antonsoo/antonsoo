import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readSchedule, ABANDON_GRACE_MS } from '../scripts/cron/config.mjs';

test('defaults preserve the daily schedule and retry policy', () => {
  assert.deepEqual(readSchedule({}), {
    at: '06:17', hour: 6, minute: 17, jobTimeoutMs: 900_000, retryMs: 600_000,
  });
});

test('accepts both ends of the UTC day', () => {
  for (const at of ['00:00', '23:59']) {
    const schedule = readSchedule({ PROFILE_RUN_AT: at });
    assert.equal(schedule.at, at);
    assert.deepEqual([schedule.hour, schedule.minute], at.split(':').map(Number));
  }
});

test('rejects negative, incomplete, extra-field and noncanonical times', () => {
  for (const at of ['-1:30', '06:-1', '24:00', '12:60', '6:17', '06:', ':17',
    '06:17:42', '06:17 ', ' 06:17', 'NaN:17', '06:1.5']) {
    assert.throws(() => readSchedule({ PROFILE_RUN_AT: at }), /PROFILE_RUN_AT/, at);
  }
});

test('rejects timer values that Node would coerce or overflow', () => {
  for (const name of ['PROFILE_JOB_TIMEOUT_MS', 'PROFILE_RETRY_MS']) {
    for (const value of ['-1', 'NaN', 'Infinity', '1.5', '1e3', ' ', '2147483648']) {
      assert.throws(() => readSchedule({ [name]: value }), new RegExp(name), `${name}=${value}`);
    }
  }
  assert.throws(() => readSchedule({ PROFILE_JOB_TIMEOUT_MS: '0' }), /PROFILE_JOB_TIMEOUT_MS/);
  assert.throws(() => readSchedule({ PROFILE_JOB_TIMEOUT_MS: '2147483647' }), /PROFILE_JOB_TIMEOUT_MS/);
});

test('accounts for watchdog grace and permits an immediate local retry', () => {
  const max = 2 ** 31 - 1 - ABANDON_GRACE_MS;
  const schedule = readSchedule({ PROFILE_JOB_TIMEOUT_MS: String(max), PROFILE_RETRY_MS: '0' });
  assert.equal(schedule.jobTimeoutMs, max);
  assert.equal(schedule.retryMs, 0);
  assert.equal(readSchedule({ PROFILE_RETRY_MS: '2147483647' }).retryMs, 2147483647);
});

test('daemon rejects invalid configuration before starting any job', () => {
  const daemon = fileURLToPath(new URL('../scripts/cron/daemon.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [daemon], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PROFILE_RUN_AT: '-1:30', RUN_ON_BOOT: '1', GH_TOKEN: '', GITHUB_TOKEN: '' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PROFILE_RUN_AT/);
  assert.doesNotMatch(result.stdout, /starting the daily job/);
});
