import { describe, expect, it } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import {
  buildBuildings,
  extractHeightMeters,
  MAX_BUILDING_HEIGHT_M,
} from './buildings';

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

  it('uses the fallback height when tags are missing (print mm)', () => {
    const features = [square(0, 0, 0.00005, { building: 'yes' })];
    const merged = buildBuildings(features, { origin: ORIGIN, fallbackHeightM: 8 });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // 8 m × 1 (exag) × 0.1 mm/m (print scale) = 0.8 mm print.
    expect(zSpan).toBeCloseTo(0.8, 3);
  });

  it('applies vertical exaggeration to building height (print mm)', () => {
    const features = [square(0, 0, 0.00005, { building: 'yes', height: '10' })];
    const merged = buildBuildings(features, {
      origin: ORIGIN,
      exaggeration: 3,
    });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // 10 m × 3 (exag) × 0.1 mm/m (print scale) = 3.0 mm print.
    expect(zSpan).toBeCloseTo(3.0, 3);
  });

  it('scales a 100 m skyscraper proportionally (print mm)', () => {
    const features = [square(0, 0, 0.00005, { building: 'yes', height: '100' })];
    const merged = buildBuildings(features, { origin: ORIGIN });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // 100 m × 1 (exag) × 0.1 mm/m = 10.0 mm — proportional to the 200 mm
    // plinth edge of a 2 km selection at 1:10000.
    expect(zSpan).toBeCloseTo(10.0, 3);
  });

  it('clamps absurd OSM height tags to MAX_BUILDING_HEIGHT_M', () => {
    // A broadcast tower mistagged as `building=yes` with height=9999 used
    // to produce 5999 mm tall obelisks in the preview. Clamp to the
    // real-world maximum so it prints at a sane height.
    const features = [square(0, 0, 0.00005, { building: 'yes', height: '9999' })];
    const merged = buildBuildings(features, { origin: ORIGIN });
    expect(merged).not.toBeNull();
    merged!.computeBoundingBox();
    const zSpan = merged!.boundingBox!.max.z - merged!.boundingBox!.min.z;
    // MAX_BUILDING_HEIGHT_M × 1 × 0.1 = 50 mm, not 999.9 mm.
    expect(zSpan).toBeCloseTo(MAX_BUILDING_HEIGHT_M * 0.1, 3);
  });

  it('returns null for empty input', () => {
    expect(buildBuildings([], { origin: ORIGIN })).toBeNull();
  });
});
