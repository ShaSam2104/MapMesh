import { describe, expect, it } from 'vitest';
import type { Feature, LineString, Polygon } from 'geojson';
import { buildLineStrip, DEFAULT_LINESTRIP_THICKNESS_MM } from './lineStrip';

function line(): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
      ],
    },
  };
}

/** A long horizontal line spanning roughly 220 m at the equator. */
function longLine(): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [-0.001, 0],
        [0.001, 0],
      ],
    },
  };
}

/** Square clip polygon centered on origin with `halfDeg` half-edge. */
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

describe('buildLineStrip', () => {
  it('returns null for empty features', () => {
    expect(
      buildLineStrip([], { origin: [0, 0], widthMeters: 12, heightOffsetMm: 0 }),
    ).toBeNull();
  });

  it('buffers a LineString and extrudes it into a slab using the requested thicknessMm', () => {
    const g = buildLineStrip([line()], {
      origin: [0, 0],
      widthMeters: 5,
      thicknessMm: 0.8,
      heightOffsetMm: 0.2,
    });
    expect(g).not.toBeNull();
    g!.computeBoundingBox();
    expect(g!.boundingBox!.max.z - g!.boundingBox!.min.z).toBeCloseTo(0.8, 3);
    // New convention: heightOffsetMm is the BOTTOM of the strip.
    expect(g!.boundingBox!.min.z).toBeCloseTo(0.2, 3);
    expect(g!.boundingBox!.max.z).toBeCloseTo(1.0, 3);
  });

  it('falls back to DEFAULT_LINESTRIP_THICKNESS_MM when thicknessMm is omitted', () => {
    const g = buildLineStrip([line()], {
      origin: [0, 0],
      widthMeters: 5,
      heightOffsetMm: 0,
    });
    g!.computeBoundingBox();
    expect(g!.boundingBox!.max.z - g!.boundingBox!.min.z).toBeCloseTo(
      DEFAULT_LINESTRIP_THICKNESS_MM,
      3,
    );
  });

  it('clips buffered geometry to the selection shape via clipShape', () => {
    // Long line spans ~ -111 m .. +111 m on X (real world). Clip box keeps
    // only a narrow central region. The clipped X extent must be smaller
    // than the unclipped one. At the 1:10000 print scale both are in mm.
    const unclipped = buildLineStrip([longLine()], {
      origin: [0, 0],
      widthMeters: 5,
      thicknessMm: 1.0,
      heightOffsetMm: 0,
    });
    const clipped = buildLineStrip([longLine()], {
      origin: [0, 0],
      widthMeters: 5,
      thicknessMm: 1.0,
      heightOffsetMm: 0,
      clipShape: clipSquare(0.0001),
    });
    expect(unclipped).not.toBeNull();
    expect(clipped).not.toBeNull();
    unclipped!.computeBoundingBox();
    clipped!.computeBoundingBox();
    const unclippedX = unclipped!.boundingBox!.max.x - unclipped!.boundingBox!.min.x;
    const clippedX = clipped!.boundingBox!.max.x - clipped!.boundingBox!.min.x;
    expect(clippedX).toBeLessThan(unclippedX);
    // Clipped extent must not exceed clip square + buffer, scaled to mm.
    // Clip box is ~22 m wide; buffer adds ~10 m; scaled 0.1 → ~3 mm.
    expect(clippedX).toBeLessThan(4);
  });
});
