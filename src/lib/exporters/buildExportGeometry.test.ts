import { describe, expect, it } from 'vitest';
import { buildExportGeometry } from './buildExportGeometry';
import { defaultLayers } from '@/lib/palette';

describe('buildExportGeometry', () => {
  // Deeper assertions against the unioned Manifold require the manifold-3d
  // WASM, which does not load reliably under jsdom. Those run in the
  // Playwright happy-path suite against the real dev server. Here we only
  // cover the smoke branches reachable without WASM.
  it('exports an async function', () => {
    expect(typeof buildExportGeometry).toBe('function');
  });

  it('returns null when there is no plinth manifold', async () => {
    const layers = defaultLayers('dark');
    const result = await buildExportGeometry({
      mesh: { status: 'idle', layerGeometries: {} },
      layers,
    });
    expect(result).toBeNull();
  });
});
