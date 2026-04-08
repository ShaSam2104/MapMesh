import { describe, expect, it } from 'vitest';
import type { Feature, LineString } from 'geojson';
import { flatGrid } from '@/lib/data/heightSampler';
import { buildGpxTube } from './gpxTube';

const grid = flatGrid([-0.01, -0.01, 0.01, 0.01], 32, 0);
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

describe('buildGpxTube', () => {
  it('returns null for short lines', () => {
    const shortLine: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[0, 0]] },
    };
    expect(buildGpxTube(shortLine, { origin, grid })).toBeNull();
  });

  it('builds a TubeGeometry with non-zero verts', () => {
    const g = buildGpxTube(line, { origin, grid, radius: 2 });
    expect(g).not.toBeNull();
    expect(g!.attributes.position.count).toBeGreaterThan(0);
  });

  it('bounding box extends to approximately the tube radius', () => {
    const g = buildGpxTube(line, { origin, grid, radius: 3 });
    g!.computeBoundingBox();
    const bb = g!.boundingBox!;
    expect(bb.max.z - bb.min.z).toBeGreaterThanOrEqual(3);
  });
});
