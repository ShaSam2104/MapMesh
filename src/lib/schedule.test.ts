import { describe, expect, it } from 'vitest';
import { tick } from './schedule';

describe('tick', () => {
  it('returns a Promise that resolves', async () => {
    await expect(tick()).resolves.toBeUndefined();
  });

  it('yields to the event loop after the current microtask queue', async () => {
    const order: string[] = [];
    // Microtasks run before setTimeout(0), so this lands first.
    const microP = Promise.resolve().then(() => order.push('micro'));
    const tickP = tick().then(() => order.push('tick'));
    await Promise.all([microP, tickP]);
    expect(order).toEqual(['micro', 'tick']);
  });
});
