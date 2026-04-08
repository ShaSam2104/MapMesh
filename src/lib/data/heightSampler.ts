/**
 * Bilinear elevation sampler over a stitched terrarium grid.
 *
 * The grid is indexed by lng/lat within its bbox — sampling returns meters.
 *
 * @module lib/data/heightSampler
 */

import type { ElevationGrid } from './terrarium';

/**
 * Bilinearly samples the elevation grid at the given lng/lat.
 * Clamps to the nearest edge pixel when outside the grid.
 */
export function sampleElevation(
  grid: ElevationGrid,
  lng: number,
  lat: number,
): number {
  const [minLng, minLat, maxLng, maxLat] = grid.bbox;
  const u = (lng - minLng) / (maxLng - minLng);
  const v = 1 - (lat - minLat) / (maxLat - minLat);
  const x = Math.max(0, Math.min(grid.width - 1.00001, u * (grid.width - 1)));
  const y = Math.max(0, Math.min(grid.height - 1.00001, v * (grid.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const i00 = y0 * grid.width + x0;
  const i10 = y0 * grid.width + x1;
  const i01 = y1 * grid.width + x0;
  const i11 = y1 * grid.width + x1;

  const v00 = grid.data[i00];
  const v10 = grid.data[i10];
  const v01 = grid.data[i01];
  const v11 = grid.data[i11];

  const a = v00 * (1 - fx) + v10 * fx;
  const b = v01 * (1 - fx) + v11 * fx;
  return a * (1 - fy) + b * fy;
}

/**
 * Creates a fake flat elevation grid — useful for tests and fallback rendering.
 */
export function flatGrid(
  bbox: ElevationGrid['bbox'],
  size = 256,
  elevation = 0,
): ElevationGrid {
  const data = new Float32Array(size * size);
  data.fill(elevation);
  return {
    width: size,
    height: size,
    data,
    bbox,
    zoom: 13,
    min: elevation,
    max: elevation,
  };
}
