// Validate before spawning the job. Node turns invalid or overflowing timer
// delays into 1ms, which could kill each attempt or hammer the API with retries.
export const KILL_GRACE_MS = 15_000;
export const ABANDON_GRACE_MS = 45_000;
const MAX_TIMER_MS = 2 ** 31 - 1;

function duration(env, name, fallback, min, max = MAX_TIMER_MS) {
  const value = env[name] || String(fallback);
  const ms = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(ms) || ms < min || ms > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max} milliseconds, got ${JSON.stringify(value)}`);
  }
  return ms;
}

export function readSchedule(env = process.env) {
  const at = env.PROFILE_RUN_AT || '06:17';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(at)) {
    throw new Error(`PROFILE_RUN_AT must be HH:MM in UTC, got ${JSON.stringify(at)}`);
  }
  const [hour, minute] = at.split(':').map(Number);
  return {
    at, hour, minute,
    jobTimeoutMs: duration(env, 'PROFILE_JOB_TIMEOUT_MS', 15 * 60_000, 1,
      MAX_TIMER_MS - ABANDON_GRACE_MS),
    retryMs: duration(env, 'PROFILE_RETRY_MS', 10 * 60_000, 0),
  };
}
