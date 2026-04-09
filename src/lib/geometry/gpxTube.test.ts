import { describe, expect, it } from 'vitest';
import type { Feature, LineString, Polygon } from 'geojson';
import {
  buildGpxTube,
  DEFAULT_GPX_HEIGHT_MM,
  DEFAULT_GPX_THICKNESS_MM,
  DEFAULT_GPX_WIDTH_METERS,
} from './gpxTube';

const origin: [number, number] = [0, 0];

const line: Feature<LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [-0.001, -0.001],
      [0, 0],
      [0.001, 0.001],
      [0.002, 0.0015],
    ],
  },
};

function clipSquare(halfDeg: number): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-halfDeg, -halfDeg],
          [halfDeg, -halfDeg],
          [halfDeg, halfDeg],
          [-halfDeg, halfDeg],
          [-halfDeg, -halfDeg],
        ],
      ],
    },
  };
}

describe('buildGpxTube', () => {
  it('returns null for short lines', () => {
    const shortLine: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[0, 0]] },
    };
    expect(buildGpxTube(shortLine, { origin })).toBeNull();
  });

  it('produces a watertight-per-run ribbon slab with non-zero verts', () => {
    const g = buildGpxTube(line, { origin, widthMeters: 10 });
    expect(g).not.toBeNull();
    expect(g!.attributes.position.count).toBeGreaterThan(0);
  });

  it('uses printable DEFAULT_GPX_HEIGHT_MM and DEFAULT_GPX_THICKNESS_MM when omitted', () => {
    const g = buildGpxTube(line, { origin });
    expect(g).not.toBeNull();
    g!.computeBoundingBox();
    const bb = g!.boundingBox!;
    // Ribbon bottom sits at heightOffsetMm and top at heightOffsetMm + thicknessMm.
    expect(bb.min.z).toBeCloseTo(DEFAULT_GPX_HEIGHT_MM, 3);
    expect(bb.max.z).toBeCloseTo(
      DEFAULT_GPX_HEIGHT_MM + DEFAULT_GPX_THICKNESS_MM,
      3,
    );
  });

  it('exposes a real-world meters default width (printed half-width ≥ 1 mm)', () => {
    // The raw constant is in real meters; at the default 1:10000 scale
    // the printed half-width is DEFAULT_GPX_WIDTH_METERS × 0.1 mm/m.
    expect(DEFAULT_GPX_WIDTH_METERS * 0.1).toBeGreaterThanOrEqual(1);
  });

  it('clipShape that excludes most points shrinks the result to null', () => {
    // The clip square's half-edge in degrees (~5.5 m at the equator) keeps
    // only the (0,0) point. With < 2 points per run the ribbon is dropped.
    const g = buildGpxTube(line, {
      origin,
      clipShape: clipSquare(0.00005),
    });
    expect(g).toBeNull();
  });

  it('clipShape that contains every point still produces a ribbon', () => {
    const g = buildGpxTube(line, {
      origin,
      clipShape: clipSquare(1),
    });
    expect(g).not.toBeNull();
    expect(g!.attributes.position.count).toBeGreaterThan(0);
  });

  it('clipShape with multiple in/out crossings that produce only singletons is dropped', () => {
    // Wider line with 5 points, alternating in/out of a tight clip box.
    const zigzag: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0.01, 0],
          [0, 0.0001],
          [0.01, 0.0001],
          [0, 0.0002],
        ],
      },
    };
    const g = buildGpxTube(zigzag, {
      origin,
      clipShape: clipSquare(0.0005),
    });
    // 3 of the 5 points are inside the clip box but they are separated by
    // outside points, so each run has length 1 and is skipped.
    expect(g).toBeNull();
  });
});
