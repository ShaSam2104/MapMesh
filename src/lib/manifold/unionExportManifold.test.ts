import { describe, expect, it } from 'vitest';
import { unionExportManifold } from './unionExportManifold';
import { defaultLayers } from '@/lib/palette';

describe('unionExportManifold', () => {
  // manifold-3d's WASM does not load reliably under jsdom; deeper assertions
  // against the unioned mesh run in the Playwright happy-path suite against
  // the real dev server. Here we only cover the branches that can be
  // exercised without the WASM module.
  it('exports an async function', () => {
    expect(typeof unionExportManifold).toBe('function');
  });

  it('returns null when no plinth manifold is present', async () => {
    const layers = defaultLayers('dark');
    const result = await unionExportManifold({
      mesh: { status: 'idle', layerGeometries: {} },
      layers,
    });
    expect(result).toBeNull();
  });
});
