import { describe, expect, it, beforeEach } from 'vitest';
import { logger, setLogLevel, tagged } from './logger';
import { logBuffer } from './ringBuffer';

describe('logger', () => {
  beforeEach(() => {
    logBuffer.clear();
    setLogLevel(3);
  });

  it('is a singleton consola instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.withTag).toBe('function');
  });

  it('multiple withTag calls reuse the root reporter', () => {
    const a = logger.withTag('modA');
    const b = logger.withTag('modB');
    a.info('hello from A');
    b.info('hello from B');
    const entries = logBuffer.toArray();
    const tagsPresent = new Set(entries.map((e) => e.tag));
    expect(tagsPresent.has('meshmap:modA')).toBe(true);
    expect(tagsPresent.has('meshmap:modB')).toBe(true);
  });

  it('tagged() is an alias for withTag()', () => {
    const t = tagged('aliased');
    t.info('via tagged');
    const tags = logBuffer.toArray().map((e) => e.tag);
    expect(tags.some((t) => t.endsWith('aliased'))).toBe(true);
  });

  it('level threshold silences lower priorities', () => {
    setLogLevel(1); // warn+
    // eslint-disable-next-line testing-library/no-debugging-utils -- this is consola, not RTL
    logger.debug('hidden');
    logger.info('hidden-too');
    logger.warn('visible');
    logger.error('visible');
    const msgs = logBuffer.toArray().map((e) => e.message);
    expect(msgs).not.toContain('hidden');
    expect(msgs).not.toContain('hidden-too');
    expect(msgs).toContain('visible');
  });

  it('setLogLevel updates the logger and persists', () => {
    setLogLevel(0);
    expect(logger.level).toBe(0);
    expect(localStorage.getItem('meshmap_log_level')).toBe('0');
  });
});
