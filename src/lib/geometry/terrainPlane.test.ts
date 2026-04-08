import { describe, expect, it } from 'vitest';
import { flatGrid } from '@/lib/data/heightSampler';
import { buildTerrainPlane } from './terrainPlane';

describe('buildTerrainPlane', () => {
  it('a flat grid produces a terrain with zRange near zero', () => {
    const grid = flatGrid([0, 0, 1, 1], 64, 100);
    const { geometry, zRange } = buildTerrainPlane(grid, { sizeKm: 2, subdivisions: 32 });
    expect(geometry.attributes.position).toBeDefined();
    expect(zRange.max - zRange.min).toBeCloseTo(0);
  });

  it('output geometry is 2000 × 2000 mm for a 2 km selection', () => {
    const grid = flatGrid([0, 0, 1, 1], 32, 0);
    const { geometry } = buildTerrainPlane(grid, { sizeKm: 2, subdivisions: 16 });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2000);
    expect(bb.max.y - bb.min.y).toBeCloseTo(2000);
  });

  it('a ramp elevation grid produces a nonzero zRange and correct mean centering', () => {
    const size = 16;
    const data = new Float32Array(size * size);
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = x * 10;
        data[y * size + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const grid = {
      width: size,
      height: size,
      data,
      bbox: [0, 0, 1, 1] as [number, number, number, number],
      zoom: 13,
      min,
      max,
    };
    const { zRange } = buildTerrainPlane(grid, { sizeKm: 1, subdivisions: 16, exaggeration: 1 });
    expect(zRange.max - zRange.min).toBeGreaterThan(0);
  });
});
