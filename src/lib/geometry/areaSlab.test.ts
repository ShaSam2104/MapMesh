import { describe, expect, it } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import { buildAreaSlab, DEFAULT_SLAB_THICKNESS_MM } from './areaSlab';

function square(): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.001, 0],
          [0.001, 0.001],
          [0, 0.001],
          [0, 0],
        ],
      ],
    },
  };
}

describe('buildAreaSlab', () => {
  it('returns null for empty features', () => {
    expect(buildAreaSlab([], { origin: [0, 0], heightOffsetMm: 0 })).toBeNull();
  });

  it('builds a merged slab whose z-span matches the requested thicknessMm', () => {
    const g = buildAreaSlab([square()], {
      origin: [0, 0],
      heightOffsetMm: 0,
      thicknessMm: 1.5,
    });
    expect(g).not.toBeNull();
    g!.computeBoundingBox();
    const zSpan = g!.boundingBox!.max.z - g!.boundingBox!.min.z;
    expect(zSpan).toBeCloseTo(1.5, 3);
  });

  it('uses the printable DEFAULT_SLAB_THICKNESS_MM when thicknessMm is omitted', () => {
    const g = buildAreaSlab([square()], { origin: [0, 0], heightOffsetMm: 0 });
    g!.computeBoundingBox();
    const zSpan = g!.boundingBox!.max.z - g!.boundingBox!.min.z;
    expect(zSpan).toBeCloseTo(DEFAULT_SLAB_THICKNESS_MM, 3);
  });

  it('positions the slab BOTTOM at heightOffsetMm (top at heightOffsetMm+thicknessMm)', () => {
    const g = buildAreaSlab([square()], {
      origin: [0, 0],
      heightOffsetMm: 0.5,
      thicknessMm: 1.0,
    });
    g!.computeBoundingBox();
    expect(g!.boundingBox!.min.z).toBeCloseTo(0.5, 3);
    expect(g!.boundingBox!.max.z).toBeCloseTo(1.5, 3);
  });

  it('honors negative heightOffsetMm by sinking the slab partially below z=0', () => {
    const g = buildAreaSlab([square()], {
      origin: [0, 0],
      heightOffsetMm: -0.5,
      thicknessMm: 1.2,
    });
    g!.computeBoundingBox();
    expect(g!.boundingBox!.min.z).toBeCloseTo(-0.5, 3);
    expect(g!.boundingBox!.max.z).toBeCloseTo(0.7, 3);
  });
});
