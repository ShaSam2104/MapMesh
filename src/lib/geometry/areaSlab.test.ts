import { describe, expect, it } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import { buildAreaSlab } from './areaSlab';

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
    expect(buildAreaSlab([], { origin: [0, 0], heightOffset: 0 })).toBeNull();
  });

  it('builds a merged slab for one polygon with correct thickness', () => {
    const g = buildAreaSlab([square()], {
      origin: [0, 0],
      heightOffset: 0,
      thickness: 0.5,
    });
    expect(g).not.toBeNull();
    g!.computeBoundingBox();
    const zSpan = g!.boundingBox!.max.z - g!.boundingBox!.min.z;
    expect(zSpan).toBeCloseTo(0.5, 3);
  });

  it('honors negative heightOffset (recessed water)', () => {
    const g = buildAreaSlab([square()], {
      origin: [0, 0],
      heightOffset: -0.6,
      thickness: 0.4,
    });
    g!.computeBoundingBox();
    expect(g!.boundingBox!.max.z).toBeCloseTo(-0.6, 3);
  });
});
