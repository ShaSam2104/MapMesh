import { describe, expect, it } from 'vitest';
import { RingBuffer, logBuffer } from './ringBuffer';

describe('RingBuffer', () => {
  it('stores items up to capacity', () => {
    const b = new RingBuffer<number>(3);
    b.push(1);
    b.push(2);
    b.push(3);
    expect(b.toArray()).toEqual([1, 2, 3]);
    expect(b.size).toBe(3);
  });

  it('evicts the oldest when capacity is exceeded', () => {
    const b = new RingBuffer<number>(3);
    b.push(1);
    b.push(2);
    b.push(3);
    b.push(4);
    b.push(5);
    expect(b.toArray()).toEqual([3, 4, 5]);
    expect(b.size).toBe(3);
  });

  it('clears all items', () => {
    const b = new RingBuffer<number>(3);
    b.push(1);
    b.clear();
    expect(b.size).toBe(0);
    expect(b.toArray()).toEqual([]);
  });

  it('rejects non-positive capacity', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });

  it('shared logBuffer singleton has capacity 500', () => {
    logBuffer.clear();
    for (let i = 0; i < 700; i++) {
      logBuffer.push({
        ts: '',
        level: 2,
        levelName: 'info',
        tag: 'test',
        message: String(i),
        args: [],
      });
    }
    expect(logBuffer.size).toBe(500);
  });
});
