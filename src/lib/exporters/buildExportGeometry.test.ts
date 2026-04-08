import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { LayerKey, Layers, MeshState } from '@/types';
import { defaultLayers } from '@/lib/palette';
import { buildExportGeometry } from './buildExportGeometry';

function box(
  width: number,
  height: number,
  depth: number,
  origin: readonly [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(width, height, depth);
  g.translate(origin[0], origin[1], origin[2]);
  return g;
}

function meshState(overrides: Partial<MeshState> = {}): MeshState {
  return {
    status: 'ready',
    layerGeometries: {},
    plinthGeometry: box(2000, 2000, 6, [0, 0, -2]),
    plinthTopZ: 1,
    ...overrides,
  };
}

describe('buildExportGeometry', () => {
  it('returns null when there is no plinth geometry', () => {
    const layers = defaultLayers('dark');
    const merged = buildExportGeometry({
      mesh: { status: 'idle', layerGeometries: {} },
      layers,
    });
    expect(merged).toBeNull();
  });

  it('returns the plinth alone when no layers have geometry', () => {
    const layers = defaultLayers('dark');
    const merged = buildExportGeometry({
      mesh: meshState(),
      layers,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    // Plinth bbox is 2000x2000x6 — merged bbox should match.
    const bb = merged!.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2000, 3);
    expect(bb.max.z - bb.min.z).toBeCloseTo(6, 3);
  });

  it('merges plinth + included layer geometries with topZ offset', () => {
    const layers = defaultLayers('dark');
    // Building geometry: 100x100x50, sitting at local z=0..50 (plinth-top
    // local frame). After lifting by topZ=1 it sits at z=1..51.
    const buildingsGeo = box(100, 100, 50, [0, 0, 25]);
    const merged = buildExportGeometry({
      mesh: meshState({
        layerGeometries: { buildings: buildingsGeo },
      }),
      layers,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    // The merged bbox max.z should be plinth-top (1) + 50 = 51.
    expect(merged!.boundingBox!.max.z).toBeCloseTo(51, 3);
  });

  it('skips layers with includeInExport = false', () => {
    const baseLayers = defaultLayers('dark');
    const layers: Layers = {
      ...baseLayers,
      buildings: { ...baseLayers.buildings, includeInExport: false },
    };
    const buildingsGeo = box(100, 100, 50, [0, 0, 25]);
    const merged = buildExportGeometry({
      mesh: meshState({
        layerGeometries: { buildings: buildingsGeo },
      }),
      layers,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    // Plinth-only bbox; building max.z (51) should NOT be present.
    expect(merged!.boundingBox!.max.z).toBeLessThan(2);
  });

  it('ignores the base key in the layer loop (plinth is the base)', () => {
    const layers = defaultLayers('dark');
    // Attach a fake base geometry that, if it leaked into the merge,
    // would dramatically expand the bbox in y.
    const stray = box(10000, 10000, 10000, [0, 0, 5000]);
    const merged = buildExportGeometry({
      mesh: meshState({
        layerGeometries: { base: stray } as Partial<Record<LayerKey, THREE.BufferGeometry>>,
      }),
      layers,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    // Should still match the plinth size, not the stray box.
    const bb = merged!.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2000, 3);
    expect(bb.max.z).toBeLessThan(10);
  });
});
