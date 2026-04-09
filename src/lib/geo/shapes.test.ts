import { describe, expect, it } from 'vitest';
import { area as turfArea } from '@turf/turf';
import {
  shapeAsGeoJson,
  shapeAsThreeShape,
  shapeVerticesMeters,
  shapeVerticesMm,
} from './shapes';

const MUMBAI: [number, number] = [72.8777, 19.076];

describe('shapes', () => {
  it('shapeVerticesMeters returns real-world meters for a 1 km square', () => {
    const verts = shapeVerticesMeters('square', 1, 0);
    expect(verts).toHaveLength(4);
    const xs = verts.map(([x]) => x);
    const ys = verts.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1000, 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1000, 0);
  });

  it('shapeVerticesMm collapses a 1 km square to a 100 mm print extent (1:10000 scale)', () => {
    const verts = shapeVerticesMm('square', 1, 0);
    expect(verts).toHaveLength(4);
    const xs = verts.map(([x]) => x);
    const ys = verts.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 4);
  });

  it('circle has 64 verts and area ≈ π r² (real-world meters, for GeoJSON)', () => {
    const verts = shapeVerticesMeters('circle', 2, 0);
    expect(verts).toHaveLength(64);
    const feature = shapeAsGeoJson('circle', MUMBAI, 2, 0);
    const a = turfArea(feature);
    const expected = Math.PI * 1000 * 1000;
    expect(a).toBeGreaterThan(expected * 0.99);
    expect(a).toBeLessThan(expected * 1.01);
  });

  it('hex has 6 verts and is symmetric about origin', () => {
    const verts = shapeVerticesMeters('hex', 1, 0);
    expect(verts).toHaveLength(6);
    const sumX = verts.reduce((s, [x]) => s + x, 0);
    const sumY = verts.reduce((s, [, y]) => s + y, 0);
    expect(Math.abs(sumX)).toBeLessThan(1e-6);
    expect(Math.abs(sumY)).toBeLessThan(1e-6);
  });

  it('shapeAsGeoJson closes the ring', () => {
    const f = shapeAsGeoJson('square', MUMBAI, 1, 0);
    const ring = f.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('shapeAsThreeShape returns a shape in print mm (2 km → 200 mm wide)', () => {
    const three = shapeAsThreeShape('square', 2, 0);
    const pts = three.extractPoints(1).shape;
    const xs = pts.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200, 4);
  });
});
