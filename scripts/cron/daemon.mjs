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
//   PROFILE_RUN_AT  "HH:MM" UTC, default 06:17 (the slot sententia.yml used)
//   RUN_ON_BOOT     "0" to skip the run at startup; on by default, and safe,
//                   because the job commits nothing when nothing changed

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const JOB = join(HERE, 'run.mjs');
const AT = process.env.PROFILE_RUN_AT || '06:17';

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

function runJob() {
  return new Promise((resolve) => {
    log('starting the daily job');
    const child = spawn(process.execPath, [JOB], { stdio: 'inherit' });
    child.on('exit', (code, signal) => {
      // Never rethrow: a failed run must not stop tomorrow's.
      log(signal ? `job killed by ${signal}` : `job exited ${code}`);
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      log(`job could not start: ${err.message}`);
      resolve(1);
    });
  });
}

log(`scheduler up, daily at ${AT} UTC`);
if (process.env.RUN_ON_BOOT !== '0') await runJob();

for (;;) {
  const { ms, at } = untilNext();
  log(`next run ${at.toISOString()} (in ${(ms / 3600000).toFixed(2)}h)`);
  await new Promise((r) => setTimeout(r, ms));
  await runJob();
  // Guard against a run that finishes inside the same minute it started, which
  // would otherwise recompute to a delay of ~0 and fire again immediately.
  await new Promise((r) => setTimeout(r, 61_000));
}
