// Long-running wrapper that schedules scripts/cron/run.mjs itself.
//
// WHY NOT RAILWAY'S CRON. The service was configured as a Railway cron job
// first, and its scheduler proved unreliable here on 2026-08-21: with a */5
// schedule and a next-run time that visibly advanced, three consecutive ticks
// produced no container, no log line and no error. Only `railway service
// restart` ever executed it. Setting cronSchedule through the API (railway.json
// alone does not reach the service instance) and re-arming it after the deploy
// both failed to bring the ticks back.
//
// So this process owns the clock instead. It sleeps until the next PROFILE_RUN_AT
// (UTC), spawns the job as a child so a crash cannot take the scheduler down
// with it, and repeats. The trade is an always-on container instead of a
// per-tick one: an idle node process, tens of megabytes, well under a dollar a
// month of Railway credit, in exchange for a schedule that is auditable in the
// logs and does not depend on a black box.
//
//   PROFILE_RUN_AT   "HH:MM" UTC, default 06:17 (the slot sententia.yml used)
//   RUN_ON_BOOT      "0" to skip the run at startup; on by default, and safe,
//                    because the job commits nothing when nothing changed
//   PROFILE_JOB_TIMEOUT_MS  watchdog per attempt, default 15 minutes
//   PROFILE_RETRY_MS        wait before the single retry, default 10 minutes

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const JOB = join(HERE, 'run.mjs');
const AT = process.env.PROFILE_RUN_AT || '06:17';
const JOB_TIMEOUT_MS = Number(process.env.PROFILE_JOB_TIMEOUT_MS || 15 * 60_000);
const RETRY_MS = Number(process.env.PROFILE_RETRY_MS || 10 * 60_000);

const [HH, MM] = AT.split(':').map(Number);
if (!Number.isInteger(HH) || !Number.isInteger(MM) || HH > 23 || MM > 59) {
  console.error(`PROFILE_RUN_AT must be HH:MM in UTC, got ${JSON.stringify(AT)}`);
  process.exit(1);
}

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${stamp()}]`, ...a);

/** Milliseconds until the next HH:MM UTC, always recomputed from the clock. */
function untilNext() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), HH, MM, 0, 0),
  );
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return { ms: next - now, at: next };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run the job once. ALWAYS settles, which is the whole point of the watchdog:
 * this promise is awaited before the next run is scheduled, so anything that
 * can hang it stops the daily job forever, with no crash for Railway to
 * restart and nothing in the logs to notice. run.mjs shells out to git and npm
 * and talks to the GitHub API, so a stalled clone or a hung socket is a real
 * possibility however many timeouts those calls carry.
 */
function runJob() {
  return new Promise((resolve) => {
    log('starting the daily job');
    const child = spawn(process.execPath, [JOB], { stdio: 'inherit' });
    const timers = [];
    let settled = false;

    const finish = (code, note) => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      log(note);
      resolve(code);
    };

    timers.push(
      setTimeout(() => {
        log(`job still running after ${(JOB_TIMEOUT_MS / 60_000).toFixed(0)} minutes, terminating it`);
        child.kill('SIGTERM');
      }, JOB_TIMEOUT_MS),
      setTimeout(() => child.kill('SIGKILL'), JOB_TIMEOUT_MS + 15_000),
      // Last resort. If even SIGKILL leaves us without an exit event, give up
      // on the child rather than on every future run.
      setTimeout(() => finish(1, 'job abandoned: it did not exit after SIGKILL'), JOB_TIMEOUT_MS + 45_000),
    );

    child.on('exit', (code, signal) =>
      finish(signal ? 1 : (code ?? 1), signal ? `job killed by ${signal}` : `job exited ${code}`),
    );
    child.on('error', (err) => finish(1, `job could not start: ${err.message}`));
  });
}

/**
 * One retry, because a network blip at 06:17 should not cost the day its quote
 * card. Two failures in a row is a real problem and waits for tomorrow: a
 * tighter loop would just hammer GitHub.
 */
async function runWithRetry() {
  if ((await runJob()) === 0) return 0;
  log(`retrying once in ${(RETRY_MS / 60_000).toFixed(0)} minutes`);
  await sleep(RETRY_MS);
  const code = await runJob();
  if (code !== 0) log('JOB FAILED TWICE. The profile is stale until the next scheduled run.');
  return code;
}

log(`scheduler up, daily at ${AT} UTC`);
if (process.env.RUN_ON_BOOT !== '0') await runWithRetry();

for (;;) {
  const { ms, at } = untilNext();
  log(`next run ${at.toISOString()} (in ${(ms / 3600000).toFixed(2)}h)`);
  await sleep(ms);
  await runWithRetry();
  // Guard against a run that finishes inside the same minute it started, which
  // would otherwise recompute to a delay of ~0 and fire again immediately.
  await sleep(61_000);
}
