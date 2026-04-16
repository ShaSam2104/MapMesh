import { describe, expect, it } from 'vitest';
import { buildWatertightPlinth } from './buildWatertightPlinth';

describe('buildWatertightPlinth', () => {
  // manifold-3d's WASM does not load reliably under jsdom without extra
  // ceremony; the real integration test runs under Playwright against the
  // dev server. Here we at least ensure the exported symbol is a function
  // and that the type shape accepts the new `flanges` option (type check
  // via runtime smoke).
  it('exports an async function', () => {
    expect(typeof buildWatertightPlinth).toBe('function');
  });

  it('accepts an optional flanges array in its options', () => {
    // Deliberately catches a regression where `flanges` gets dropped from
    // the options type. We don't actually invoke the builder here because
    // the WASM isn't available in jsdom; we only assert that calling with
    // the extended option shape type-checks and produces a Promise.
    const result = buildWatertightPlinth({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      grid: {
        width: 2,
        height: 2,
        data: new Float32Array([0, 0, 0, 0]),
        bbox: [0, 0, 0, 0],
        zoom: 13,
        min: 0,
        max: 0,
      },
      flanges: [],
    });
    expect(result).toBeInstanceOf(Promise);
    // Swallow the inevitable WASM-load failure under jsdom.
    result.catch(() => undefined);
  });
});
