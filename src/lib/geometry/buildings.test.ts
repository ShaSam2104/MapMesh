import { describe, expect, it } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import { buildBuildings, extractHeightMeters } from './buildings';

const ORIGIN: [number, number] = [0, 0];

function square(cx: number, cy: number, sizeDeg: number, props: Record<string, unknown>): Feature<Polygon> {
  const h = sizeDeg / 2;
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [cx - h, cy - h],
          [cx + h, cy - h],
          [cx + h, cy + h],
          [cx - h, cy + h],
          [cx - h, cy - h],
        ],
      ],
    },
  };
}

describe('extractHeightMeters', () => {
  it('reads direct height', () => {
    expect(extractHeightMeters(square(0, 0, 0.0001, { height: '25' }))).toBe(25);
  });
  it('reads building:height', () => {
    expect(extractHeightMeters(square(0, 0, 0.0001, { 'building:height': '14.5' }))).toBe(14.5);
  });
  it('reads building:levels × 3m', () => {
    expect(extractHeightMeters(square(0, 0, 0.0001, { 'building:levels': '5' }))).toBe(15);
  });
  it('returns null when no height info is present', () => {
    expect(extractHeightMeters(square(0, 0, 0.0001, { building: 'yes' }))).toBe(null);
  });
});

describe('buildBuildings', () => {
  it('builds a merged geometry from multiple features', () => {
    const features = [
      square(0.0001, 0.0001, 0.00005, { building: 'yes', height: '20' }),
      square(0.0003, 0.0001, 0.00005, { building: 'yes', 'building:levels': '3' }),
    ];
    const merged = buildBuildings(features, { origin: ORIGIN });
    expect(merged).not.toBeNull();
    expect(merged!.attributes.position.count).toBeGreaterThan(0);
  });

  it('uses the fallback height when tags are missing', () => {
    const features = [square(0, 0, 0.00005, { building: 'yes' })];
    const merged = buildBuildings(features, { origin: ORIGIN, fallbackHeightM: 8 });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // 1 world unit = 1 real meter, with a constant ×6 visibility boost,
    // so 8 m fallback → 8 × 6 = 48 units tall.
    expect(zSpan).toBeCloseTo(48, 4);
  });

  it('applies vertical exaggeration to building height', () => {
    const features = [square(0, 0, 0.00005, { building: 'yes', height: '10' })];
    const merged = buildBuildings(features, {
      origin: ORIGIN,
      exaggeration: 3,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // 10 m × 6 (constant boost) × 3 (exaggeration) = 180 world units.
    expect(zSpan).toBeCloseTo(180, 4);
  });

  it('returns null for empty input', () => {
    expect(buildBuildings([], { origin: ORIGIN })).toBeNull();
  });
});
