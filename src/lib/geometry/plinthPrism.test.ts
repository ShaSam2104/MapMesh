import { describe, expect, it } from 'vitest';
import { buildPlinthPrism } from './plinthPrism';

describe('buildPlinthPrism', () => {
  it('builds a 100 × 100 × 6 mm square prism for a 1 km selection at 1:10000 scale', () => {
    const g = buildPlinthPrism({
      shape: 'square',
      sizeKm: 1,
      rotationDeg: 0,
      baseThicknessMm: 6,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // 1 km ground × 0.1 mm/m → 100 mm print edge.
    expect(bb.max.x - bb.min.x).toBeCloseTo(100, 3);
    expect(bb.max.y - bb.min.y).toBeCloseTo(100, 3);
    expect(bb.max.z - bb.min.z).toBeCloseTo(6, 1);
    expect(bb.max.z).toBeCloseTo(0, 3);
  });

  it('builds a circular prism for a circle selection (2 km → 200 mm print)', () => {
    const g = buildPlinthPrism({
      shape: 'circle',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(200, 3);
    expect(bb.max.y - bb.min.y).toBeCloseTo(200, 3);
  });
});
