import { describe, expect, it } from 'vitest';
import { PRINT_SCALE_MM_PER_M, metersToMm, metersXyToMm } from './printScale';

describe('printScale', () => {
  it('PRINT_SCALE_MM_PER_M is 0.1 (1:10000 physical)', () => {
    expect(PRINT_SCALE_MM_PER_M).toBe(0.1);
  });

  it('metersToMm scales a scalar', () => {
    expect(metersToMm(0)).toBe(0);
    expect(metersToMm(10)).toBeCloseTo(1, 6);
    // 2 km → 200 mm print
    expect(metersToMm(2000)).toBeCloseTo(200, 6);
  });

  it('metersXyToMm scales both axes independently', () => {
    expect(metersXyToMm([100, 200])).toEqual([10, 20]);
  });
});
