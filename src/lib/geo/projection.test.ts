import { describe, expect, it } from 'vitest';
import {
  haversineMeters,
  lngLatToLocalMeters,
  localMetersToLngLat,
} from './projection';

const MUMBAI: [number, number] = [72.8777, 19.076];

describe('projection', () => {
  it('origin projects to (0, 0)', () => {
    const [x, y] = lngLatToLocalMeters(MUMBAI, MUMBAI);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it('1° of longitude at lat 0 ≈ 111320 m', () => {
    const [x] = lngLatToLocalMeters([1, 0], [0, 0]);
    expect(x).toBeGreaterThan(111_000);
    expect(x).toBeLessThan(112_000);
  });

  it('1° of longitude at lat 40 ≈ 85395 m (cos-lat scaling)', () => {
    const [x] = lngLatToLocalMeters([1, 40], [0, 40]);
    expect(x).toBeGreaterThan(84_500);
    expect(x).toBeLessThan(86_000);
  });

  it('1° of latitude ≈ 111194 m anywhere', () => {
    const [, y] = lngLatToLocalMeters([0, 1], [0, 0]);
    expect(y).toBeGreaterThan(110_500);
    expect(y).toBeLessThan(112_000);
  });

  it('round-trip lngLat → meters → lngLat within 1 cm', () => {
    const p: [number, number] = [72.88, 19.08];
    const m = lngLatToLocalMeters(p, MUMBAI);
    const back = localMetersToLngLat(m, MUMBAI);
    expect(back[0]).toBeCloseTo(p[0], 7);
    expect(back[1]).toBeCloseTo(p[1], 7);
  });

  it('haversine distance for a known pair', () => {
    // Mumbai → Pune ≈ 120 km
    const d = haversineMeters(MUMBAI, [73.8567, 18.5204]);
    expect(d).toBeGreaterThan(115_000);
    expect(d).toBeLessThan(130_000);
  });
});
