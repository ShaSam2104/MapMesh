import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { classifyFeatures } from './osmFeatures';

describe('classifyFeatures', () => {
  it('buckets features by layer key', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { building: 'yes' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { highway: 'residential' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { natural: 'water' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const out = classifyFeatures(fc);
    expect(out.buildings).toHaveLength(1);
    expect(out.roads).toHaveLength(1);
    expect(out.water).toHaveLength(1);
  });

  it('drops unclassifiable features', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { amenity: 'cafe' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    };
    const out = classifyFeatures(fc);
    expect(Object.keys(out)).toHaveLength(0);
  });
});
