/**
 * AWS Open Data Terrain Tiles (Mapzen Terrarium) fetcher.
 *
 * Each tile pixel encodes elevation in meters via:
 *   elevation = (R * 256 + G + B / 256) - 32768
 *
 * @module lib/data/terrarium
 */

import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import type { Bbox } from '@/lib/geo/bbox';

const log = tagged('terrarium');

const BASE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const TILE_SIZE = 256;

/**
 * Hard timeout per tile request. AWS occasionally stalls individual
 * Terrarium tiles for tens of seconds; without this bound the rebuild
 * pipeline can hang indefinitely with no visible progress. 15 s is
 * generous enough to absorb any real-world tail latency while still
 * surfacing a clean failure the zoom-step-down fallback can handle.
 */
const TILE_FETCH_TIMEOUT_MS = 15_000;

export interface ElevationGrid {
  /** Width in samples. */
  width: number;
  /** Height in samples. */
  height: number;
  /** Row-major Float32 elevation in meters. */
  data: Float32Array;
  /** The lng/lat bbox this grid covers. */
  bbox: Bbox;
  /** The zoom level used. */
  zoom: number;
  /** Min/max elevation in meters, for quick stats. */
  min: number;
  max: number;
}

/** Converts lng/lat/zoom to a tile (x, y) XYZ coordinate. */
export function lngLatToTile(
  lng: number,
  lat: number,
  z: number,
): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

/** Returns the lng/lat of the NW corner of a tile. */
export function tileToLngLat(
  x: number,
  y: number,
  z: number,
): [number, number] {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return [lng, lat];
}

/**
 * Returns the list of terrain tiles needed to cover a bbox at zoom `z`.
 */
export function tilesForBbox(
  bbox: Bbox,
  z: number,
): { x: number; y: number }[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const nw = lngLatToTile(minLng, maxLat, z);
  const se = lngLatToTile(maxLng, minLat, z);
  const tiles: { x: number; y: number }[] = [];
  for (let y = nw.y; y <= se.y; y++) {
    for (let x = nw.x; x <= se.x; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Decodes a single RGBA tile buffer into Float32 elevations (row-major).
 *
 * Exported for tests; the higher-level `fetchElevationGrid` is what normal
 * code uses.
 */
export function decodeTerrariumPixels(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    out[j] = r * 256 + g + b / 256 - 32768;
  }
  return out;
}

async function fetchTileRgba(
  z: number,
  x: number,
  y: number,
): Promise<Uint8ClampedArray> {
  const url = `${BASE_URL}/${z}/${x}/${y}.png`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('timeout')),
    TILE_FETCH_TIMEOUT_MS,
  );
  let res: Response;
  try {
    res = await fetch(url, { mode: 'cors', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`terrarium tile ${z}/${x}/${y} → ${res.status}`);
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
      : (() => {
          const c = document.createElement('canvas');
          c.width = TILE_SIZE;
          c.height = TILE_SIZE;
          return c;
        })();
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
}

/**
 * Fetches and stitches a Float32 elevation grid covering `bbox` at zoom `z`.
 * Falls back to `z-1` if any tile 404s.
 */
export async function fetchElevationGrid(
  bbox: Bbox,
  z = 13,
): Promise<ElevationGrid> {
  const done = time(log, `fetchElevationGrid z=${z}`);
  const tiles = tilesForBbox(bbox, z);
  log.debug('fetching tiles', { z, count: tiles.length });

  let decoded: { x: number; y: number; grid: Float32Array }[];
  try {
    decoded = await Promise.all(
      tiles.map(async (t) => ({
        ...t,
        grid: decodeTerrariumPixels(await fetchTileRgba(z, t.x, t.y)),
      })),
    );
  } catch (err) {
    log.warn('tile fetch failed; stepping down zoom', { z, err });
    if (z <= 1) throw err;
    return fetchElevationGrid(bbox, z - 1);
  }

  // Determine the stitched grid dims + origin
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const minTileX = Math.min(...xs);
  const maxTileX = Math.max(...xs);
  const minTileY = Math.min(...ys);
  const maxTileY = Math.max(...ys);
  const tilesWide = maxTileX - minTileX + 1;
  const tilesTall = maxTileY - minTileY + 1;
  const width = tilesWide * TILE_SIZE;
  const height = tilesTall * TILE_SIZE;
  const data = new Float32Array(width * height);

  let min = Infinity;
  let max = -Infinity;
  for (const { x, y, grid } of decoded) {
    const offX = (x - minTileX) * TILE_SIZE;
    const offY = (y - minTileY) * TILE_SIZE;
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const v = grid[py * TILE_SIZE + px];
        if (v < min) min = v;
        if (v > max) max = v;
        data[(offY + py) * width + (offX + px)] = v;
      }
    }
  }

  const [nwLng, nwLat] = tileToLngLat(minTileX, minTileY, z);
  const [seLng, seLat] = tileToLngLat(maxTileX + 1, maxTileY + 1, z);
  const stitchedBbox: Bbox = [nwLng, seLat, seLng, nwLat];

  log.info('stitched elevation grid', {
    width,
    height,
    min: Math.round(min),
    max: Math.round(max),
    tileCount: tiles.length,
  });
  done();

  return { width, height, data, bbox: stitchedBbox, zoom: z, min, max };
}
