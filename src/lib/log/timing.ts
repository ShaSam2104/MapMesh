/**
 * Timing helpers for pipeline observability.
 *
 * Usage:
 *   const done = time(log, 'fetch terrarium');
 *   // ...work...
 *   done();  // logs "fetch terrarium — 347ms"
 */

import type { ConsolaInstance } from 'consola';

/**
 * Returns `performance.now()` in environments that support it,
 * falling back to `Date.now()` (ms precision) elsewhere.
 */
function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Starts a timer and returns a function that logs the elapsed milliseconds
 * at `debug` level on the supplied logger.
 */
export function time(log: ConsolaInstance, label: string): () => number {
  const start = now();
  return () => {
    const ms = Math.round((now() - start) * 100) / 100;
    log.debug(`${label} — ${ms}ms`);
    return ms;
  };
}

/**
 * Convenience wrapper: runs the async task and logs its duration.
 */
export async function timed<T>(
  log: ConsolaInstance,
  label: string,
  task: () => Promise<T>,
): Promise<T> {
  const done = time(log, label);
  try {
    return await task();
  } finally {
    done();
  }
}
