import { describe, expect, it } from 'vitest';
import { flatGrid, sampleElevation } from './heightSampler';

describe('heightSampler', () => {
  const bbox: [number, number, number, number] = [0, 0, 1, 1];

  it('flat grid returns the constant elevation at every point', () => {
    const g = flatGrid(bbox, 64, 42);
    expect(sampleElevation(g, 0.25, 0.25)).toBeCloseTo(42);
    expect(sampleElevation(g, 0.9, 0.1)).toBeCloseTo(42);
  });

  it('clamps to edge when out of bounds', () => {
    const g = flatGrid(bbox, 64, 7);
    expect(sampleElevation(g, -5, 5)).toBeCloseTo(7);
  });

  it('interpolates linearly across a ramp in x', () => {
    const size = 16;
    const data = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data[y * size + x] = x; // 0..15
      }
    }
    const g = {
      width: size,
      height: size,
      data,
      bbox,
      zoom: 13,
      min: 0,
      max: 15,
    };
    // Center of grid in x → x=7.5 → value ≈ 7.5
    const mid = sampleElevation(g, 0.5, 0.5);
    expect(mid).toBeGreaterThan(6);
    expect(mid).toBeLessThan(9);
  });
});
