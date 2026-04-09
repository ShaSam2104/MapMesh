import { describe, expect, it } from 'vitest';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { polygonToShapes } from './polygonToShape';

const ORIGIN: [number, number] = [0, 0];

describe('polygonToShapes', () => {
  it('converts a simple polygon to one THREE.Shape', () => {
    const f: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0.001, 0],
            [0.001, 0.001],
            [0, 0.001],
            [0, 0],
          ],
        ],
      },
    };
    const shapes = polygonToShapes(f, ORIGIN);
    expect(shapes).toHaveLength(1);
    const pts = shapes[0].getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });

  it('preserves holes from an inner ring', () => {
    const f: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0.002, 0],
            [0.002, 0.002],
            [0, 0.002],
            [0, 0],
          ],
          [
            [0.0005, 0.0005],
            [0.0015, 0.0005],
            [0.0015, 0.0015],
            [0.0005, 0.0015],
            [0.0005, 0.0005],
          ],
        ],
      },
    };
    const shapes = polygonToShapes(f, ORIGIN);
    expect(shapes[0].holes).toHaveLength(1);
  });

  it('scales projected coords to print millimeters (1:10000)', () => {
    // A 0.001° lng span is ~111 m at the equator → 11.1 mm print at 1:10000.
    const f: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0.001, 0],
            [0.001, 0.001],
            [0, 0.001],
            [0, 0],
          ],
        ],
      },
    };
    const [shape] = polygonToShapes(f, ORIGIN);
    const pts = shape.getPoints();
    const xs = pts.map((p) => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    // ~111 m × 0.1 mm/m ≈ 11.1 mm.
    expect(span).toBeGreaterThan(10);
    expect(span).toBeLessThan(12);
  });

  it('converts a multipolygon into multiple shapes', () => {
    const f: Feature<MultiPolygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [0.001, 0],
              [0.001, 0.001],
              [0, 0.001],
              [0, 0],
            ],
          ],
          [
            [
              [0.002, 0.002],
              [0.003, 0.002],
              [0.003, 0.003],
              [0.002, 0.003],
              [0.002, 0.002],
            ],
          ],
        ],
      },
    };
    const shapes = polygonToShapes(f, ORIGIN);
    expect(shapes).toHaveLength(2);
  });
});
