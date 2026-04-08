import { describe, expect, it } from 'vitest';
import { buildOverpassQuery, classifyFeature } from './osmQueries';

describe('osmQueries', () => {
  const bbox: [number, number, number, number] = [72.85, 19.05, 72.95, 19.15];

  it('buildOverpassQuery includes every required selector', () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain('[out:json]');
    expect(q).toContain('building');
    expect(q).toContain('highway');
    expect(q).toContain('natural"="water');
    expect(q).toContain('landuse');
    expect(q).toContain('grass');
    expect(q).toContain('sand');
    expect(q).toContain('pier');
    expect(q).toContain('out body geom');
    expect(q).toContain('>;');
  });

  it('buildOverpassQuery embeds the bbox as (minLat,minLng,maxLat,maxLng)', () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain('19.05,72.85,19.15,72.95');
  });

  it('classifies building', () => {
    expect(
      classifyFeature({
        type: 'Feature',
        properties: { building: 'yes' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    ).toBe('buildings');
  });

  it('classifies recognized roads but not tracks', () => {
    expect(
      classifyFeature({
        type: 'Feature',
        properties: { highway: 'residential' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    ).toBe('roads');
    expect(
      classifyFeature({
        type: 'Feature',
        properties: { highway: 'track' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    ).toBe(null);
  });

  it('classifies water / grass / sand / piers', () => {
    const c = (p: Record<string, string>) =>
      classifyFeature({
        type: 'Feature',
        properties: p,
        geometry: { type: 'Point', coordinates: [0, 0] },
      });
    expect(c({ natural: 'water' })).toBe('water');
    expect(c({ landuse: 'reservoir' })).toBe('water');
    expect(c({ landuse: 'grass' })).toBe('grass');
    expect(c({ leisure: 'park' })).toBe('grass');
    expect(c({ natural: 'beach' })).toBe('sand');
    expect(c({ landuse: 'sand' })).toBe('sand');
    expect(c({ man_made: 'pier' })).toBe('piers');
    expect(c({ waterway: 'dam' })).toBe('piers');
  });

  it('ignores building=no and unknown tags', () => {
    expect(
      classifyFeature({
        type: 'Feature',
        properties: { building: 'no' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    ).toBe(null);
    expect(
      classifyFeature({
        type: 'Feature',
        properties: { amenity: 'cafe' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    ).toBe(null);
  });
});
