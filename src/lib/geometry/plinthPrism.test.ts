import { describe, expect, it } from 'vitest';
import { buildPlinthPrism } from './plinthPrism';

describe('buildPlinthPrism', () => {
  it('builds a 1000 × 1000 × 6 mm square prism for a 1 km selection', () => {
    const g = buildPlinthPrism({
      shape: 'square',
      sizeKm: 1,
      rotationDeg: 0,
      baseThicknessMm: 6,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1000, 0);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1000, 0);
    expect(bb.max.z - bb.min.z).toBeCloseTo(6, 1);
    expect(bb.max.z).toBeCloseTo(0, 3);
  });

  it('builds a circular prism for a circle selection', () => {
    const g = buildPlinthPrism({
      shape: 'circle',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2000, 0);
    expect(bb.max.y - bb.min.y).toBeCloseTo(2000, 0);
  });
});
