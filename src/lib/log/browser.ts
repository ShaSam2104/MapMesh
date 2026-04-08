/**
 * Browser-only glue for logging.
 *
 * Exposes `window.__meshmap_logs__` as a read helper for DevTools so you can
 * paste `copy(window.__meshmap_logs__())` into the console.
 *
 * This file is the only place in `src/lib/log/` that touches `window`.
 */

import { logBuffer } from './ringBuffer';

export function installBrowserLogBridge(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__meshmap_logs__ = () =>
    logBuffer.toArray();
}

/**
 * Serializes the ring buffer as a plain text log dump suitable for copying
 * into a bug report.
 */
export function dumpLogsAsText(): string {
  return logBuffer
    .toArray()
    .map((e) => `${e.ts} [${e.levelName.toUpperCase()}] [${e.tag}] ${e.message}`)
    .join('\n');
}
