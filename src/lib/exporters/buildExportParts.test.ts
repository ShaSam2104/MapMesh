import { describe, expect, it } from 'vitest';
import { buildExportParts } from './buildExportParts';
import { defaultLayers } from '@/lib/palette';

describe('buildExportParts', () => {
  // Deeper assertions against the generated Manifold parts require
  // manifold-3d's WASM, which does not load reliably under jsdom. Those
  // run in the Playwright happy-path suite against the real dev server.
  // Here we only cover the smoke branches reachable without WASM.
  it('exports an async function', () => {
    expect(typeof buildExportParts).toBe('function');
  });

  it('returns an empty array when there is no plinth manifold', async () => {
    const layers = defaultLayers('dark');
    const parts = await buildExportParts({
      mesh: { status: 'idle', layerGeometries: {} },
      layers,
    });
    expect(parts).toEqual([]);
  });
});
