import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/msw/server';
import { fetchOverpass } from './overpass';
import type { Bbox } from '@/lib/geo/bbox';

const BBOX: Bbox = [72.87, 19.07, 72.88, 19.08];

const OK_BODY = {
  version: 0.6,
  generator: 'mock',
  elements: [
    { type: 'node', id: 1, lat: 19.076, lon: 72.8777 },
    { type: 'node', id: 2, lat: 19.077, lon: 72.8787 },
    { type: 'node', id: 3, lat: 19.077, lon: 72.8777 },
    {
      type: 'way',
      id: 10,
      nodes: [1, 2, 3, 1],
      tags: { building: 'yes' },
    },
  ],
};

describe('fetchOverpass', () => {
  it('returns a FeatureCollection on 200', async () => {
    const fc = await fetchOverpass(BBOX);
    expect(fc.type).toBe('FeatureCollection');
    expect(Array.isArray(fc.features)).toBe(true);
  });

  it('falls back to the next mirror on 504 and succeeds', async () => {
    server.use(
      http.post(
        'https://overpass-api.de/api/interpreter',
        () => new HttpResponse('gateway timeout', { status: 504 }),
      ),
      http.post('https://overpass.kumi.systems/api/interpreter', () =>
        HttpResponse.json(OK_BODY),
      ),
    );
    const fc = await fetchOverpass(BBOX);
    // osmtogeojson will emit at least one feature for the tiny closed way
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it('throws a human-readable error when every mirror fails with 504', async () => {
    server.use(
      http.post('https://overpass-api.de/api/interpreter', () =>
        HttpResponse.text('t', { status: 504 }),
      ),
      http.post('https://overpass.kumi.systems/api/interpreter', () =>
        HttpResponse.text('t', { status: 504 }),
      ),
      http.post('https://overpass.openstreetmap.fr/api/interpreter', () =>
        HttpResponse.text('t', { status: 504 }),
      ),
    );
    await expect(fetchOverpass(BBOX)).rejects.toThrow(/timed out on every mirror/);
  });

  it('does not retry on a 400 query error', async () => {
    let calls = 0;
    server.use(
      http.post('https://overpass-api.de/api/interpreter', () => {
        calls++;
        return HttpResponse.text('bad query', { status: 400 });
      }),
      http.post('https://overpass.kumi.systems/api/interpreter', () => {
        calls++;
        return HttpResponse.text('should not reach', { status: 200 });
      }),
    );
    await expect(fetchOverpass(BBOX)).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it('disables mirror fallback when a single endpoint is provided', async () => {
    const endpoint = 'https://overpass.example.test/api';
    server.use(
      http.post(endpoint, () => HttpResponse.json(OK_BODY)),
    );
    const fc = await fetchOverpass(BBOX, { endpoint });
    expect(fc.features.length).toBeGreaterThan(0);
  });
});
