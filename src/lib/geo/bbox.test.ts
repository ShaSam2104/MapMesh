import { describe, expect, it } from 'vitest';
import { bboxToLocalMeters, squareBbox, squareLngLatBbox } from './bbox';

const MUMBAI: [number, number] = [72.8777, 19.076];

describe('bbox', () => {
  it('squareLngLatBbox around Mumbai has a 2 km diagonal span in local meters', () => {
    const b = squareLngLatBbox(MUMBAI, 2);
    const { minX, minY, maxX, maxY } = bboxToLocalMeters(b, MUMBAI);
    expect(maxX - minX).toBeCloseTo(2000, 0);
    expect(maxY - minY).toBeCloseTo(2000, 0);
  });

  it('squareBbox returns a Feature<Polygon> with a closed ring', () => {
    const f = squareBbox(MUMBAI, 1);
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Polygon');
    const ring = f.geometry.coordinates[0];
    expect(ring.length).toBeGreaterThanOrEqual(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('bboxToLocalMeters is symmetric around origin for a symmetric bbox', () => {
    const b = squareLngLatBbox(MUMBAI, 1);
    const { minX, minY, maxX, maxY } = bboxToLocalMeters(b, MUMBAI);
    expect(minX).toBeCloseTo(-maxX, 1);
    expect(minY).toBeCloseTo(-maxY, 1);
  });
});
