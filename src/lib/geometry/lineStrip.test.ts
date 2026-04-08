import { describe, expect, it } from 'vitest';
import type { Feature, LineString, Polygon } from 'geojson';
import { buildLineStrip } from './lineStrip';

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
      buildLineStrip([], { origin: [0, 0], widthMeters: 4, heightOffset: 0.3 }),
    ).toBeNull();
  });

  it('buffers a LineString and extrudes it into a slab', () => {
    const g = buildLineStrip([line()], {
      origin: [0, 0],
      widthMeters: 5,
      thickness: 0.3,
      heightOffset: 0.3,
    });
    expect(g).not.toBeNull();
    g!.computeBoundingBox();
    expect(g!.boundingBox!.max.z - g!.boundingBox!.min.z).toBeCloseTo(0.3, 2);
  });

  it('clips buffered geometry to the selection shape via clipShape', () => {
    // Long line spans ~ -111 m .. +111 m on X. Clip box keeps only the
    // central ~22 m region. The buffered+clipped X span must be smaller
    // than the unclipped span.
    const unclipped = buildLineStrip([longLine()], {
      origin: [0, 0],
      widthMeters: 5,
      thickness: 0.3,
      heightOffset: 0.3,
    });
    const clipped = buildLineStrip([longLine()], {
      origin: [0, 0],
      widthMeters: 5,
      thickness: 0.3,
      heightOffset: 0.3,
      clipShape: clipSquare(0.0001),
    });
    expect(unclipped).not.toBeNull();
    expect(clipped).not.toBeNull();
    unclipped!.computeBoundingBox();
    clipped!.computeBoundingBox();
    const unclippedX = unclipped!.boundingBox!.max.x - unclipped!.boundingBox!.min.x;
    const clippedX = clipped!.boundingBox!.max.x - clipped!.boundingBox!.min.x;
    expect(clippedX).toBeLessThan(unclippedX);
    // The clipped extent must not exceed the clip square (~22 m + buffer).
    expect(clippedX).toBeLessThan(40);
  });
});
