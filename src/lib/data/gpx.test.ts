import { describe, expect, it } from 'vitest';
import { parseGpx } from './gpx';

const MINIMAL_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="19.0760" lon="72.8777"><ele>10</ele></trkpt>
      <trkpt lat="19.0770" lon="72.8787"><ele>12</ele></trkpt>
      <trkpt lat="19.0780" lon="72.8797"><ele>14</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('parseGpx', () => {
  it('extracts a LineString with all points concatenated', () => {
    const out = parseGpx(MINIMAL_GPX);
    expect(out.geojson.geometry.type).toBe('LineString');
    expect(out.pointCount).toBe(3);
    expect(out.distanceKm).toBeGreaterThan(0);
    expect(out.distanceKm).toBeLessThan(1);
  });

  it('throws on empty GPX', () => {
    const empty = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"/>`;
    expect(() => parseGpx(empty)).toThrow();
  });
});
