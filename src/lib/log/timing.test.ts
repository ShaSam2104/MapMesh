import { describe, expect, it, beforeEach } from 'vitest';
import { time, timed } from './timing';
import { logger, setLogLevel } from './logger';
import { logBuffer } from './ringBuffer';

describe('timing', () => {
  beforeEach(() => {
    logBuffer.clear();
    setLogLevel(4);
  });

  it('time() returns a function that logs elapsed ms with the label', () => {
    const done = time(logger.withTag('t'), 'work');
    done();
    const entries = logBuffer.toArray();
    const msg = entries[entries.length - 1]?.message ?? '';
    expect(msg).toMatch(/work — \d+(\.\d+)?ms$/);
  });

  it('timed() awaits and logs around async work', async () => {
    const value = await timed(logger.withTag('t'), 'async', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 42;
    });
    expect(value).toBe(42);
    const entries = logBuffer.toArray();
    expect(entries.some((e) => /async — \d/.test(e.message))).toBe(true);
  });

  it('timed() logs duration even if task throws', async () => {
    await expect(
      timed(logger.withTag('t'), 'boom', async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    const entries = logBuffer.toArray();
    expect(entries.some((e) => /boom — /.test(e.message))).toBe(true);
  });
});
