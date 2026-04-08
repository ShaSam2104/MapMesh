/**
 * MeshMap's root logger.
 *
 * Thin wrapper around consola that:
 *   - routes every log line through the shared ring buffer
 *   - honors `localStorage.meshmap_log_level` as a runtime override
 *   - exposes `logger.withTag('name')` for per-module children
 *
 * Every module in `src/lib/` and `src/hooks/` imports this file.
 */

import { createConsola, type ConsolaInstance, type ConsolaOptions } from 'consola';
import { logBuffer, type LogEntry } from './ringBuffer';

/**
 * Resolve the effective log level at startup:
 *   1. `localStorage.meshmap_log_level` if present and valid
 *   2. `3` (debug) in development
 *   3. `2` (info) in production
 */
function resolveLevel(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const override = localStorage.getItem('meshmap_log_level');
      if (override != null) {
        const n = Number(override);
        if (Number.isFinite(n)) return n;
      }
    }
  } catch {
    /* SSR / sandbox / no-storage — fall through */
  }
  const mode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
  return mode === 'production' ? 2 : 3;
}

const levelNames = ['error', 'warn', 'info', 'debug', 'trace'];

/**
 * Custom reporter that taps every log line into the ring buffer while still
 * pretty-printing to the console via consola's default reporter.
 */
const ringBufferReporter = {
  log(entry: {
    level: number;
    type: string;
    tag?: string;
    args: unknown[];
    date: Date;
  }): void {
    const [first, ...rest] = entry.args;
    const message = typeof first === 'string' ? first : JSON.stringify(first);
    const record: LogEntry = {
      ts: entry.date.toISOString(),
      level: entry.level,
      levelName: levelNames[entry.level] ?? entry.type ?? 'info',
      tag: entry.tag ?? 'meshmap',
      message,
      args: rest,
    };
    logBuffer.push(record);
  },
};

const options: Partial<ConsolaOptions> = {
  level: resolveLevel(),
  reporters: [ringBufferReporter as unknown as ConsolaOptions['reporters'][number]],
  defaults: {
    tag: 'meshmap',
  },
};

/** The singleton root logger. Prefer `logger.withTag('mod')` in modules. */
export const logger: ConsolaInstance = createConsola(options);

/**
 * Sets a new level at runtime. Persists to localStorage so it survives reload.
 */
export function setLogLevel(level: number): void {
  logger.level = level;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('meshmap_log_level', String(level));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Re-exports a bound child logger. Equivalent to `logger.withTag(tag)` but
 * clearer at call sites where the tag should feel like a constant.
 */
export function tagged(tag: string): ConsolaInstance {
  return logger.withTag(tag);
}
