import { http, HttpResponse } from 'msw';

// A minimal 1x1 Terrarium PNG encoded as a base64 blob.
// The red channel = 128 → elevation 0 m.
const SINGLE_PIXEL_TERRARIUM = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NgAAEAAAoAAQGeN5QAAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);

const MOCK_OVERPASS = {
  version: 0.6,
  generator: 'Overpass API (mock)',
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 19.076,
      lon: 72.8777,
    },
    {
      type: 'node',
      id: 2,
      lat: 19.077,
      lon: 72.8787,
    },
    {
      type: 'node',
      id: 3,
      lat: 19.077,
      lon: 72.8777,
    },
    {
      type: 'node',
      id: 4,
      lat: 19.076,
      lon: 72.8787,
    },
    {
      type: 'way',
      id: 101,
      nodes: [1, 4, 2, 3, 1],
      tags: { building: 'yes', height: '20' },
    },
  ],
};

export const handlers = [
  http.get(
    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/:z/:x/:y.png',
    () =>
      new HttpResponse(SINGLE_PIXEL_TERRARIUM, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
  ),
  http.post('https://overpass-api.de/api/interpreter', () =>
    HttpResponse.json(MOCK_OVERPASS),
  ),
];
