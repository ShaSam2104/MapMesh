import { describe, expect, it } from 'vitest';
import { buildWatertightPlinth } from './buildWatertightPlinth';

describe('buildWatertightPlinth', () => {
  // manifold-3d's WASM does not load reliably under jsdom without extra
  // ceremony; the real integration test runs under Playwright against the
  // dev server. Here we at least ensure the exported symbol is a function.
  it('exports an async function', () => {
    expect(typeof buildWatertightPlinth).toBe('function');
  });
});
