/**
 * Bounding-box helpers. Uses @turf/turf's `bbox` + `bboxPolygon` to keep the
 * library-first rule.
 *
 * @module lib/geo/bbox
 */

import { bbox as turfBbox, bboxPolygon } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { LngLat } from '@/types';
import { lngLatToLocalMeters, localMetersToLngLat } from './projection';

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

/**
 * Returns the bounding box of a GeoJSON geometry.
 */
export function bboxOf(geo: Feature | Polygon): Bbox {
  return turfBbox(geo as Parameters<typeof turfBbox>[0]) as Bbox;
}

/**
 * Returns a GeoJSON Polygon representing a lng/lat-aligned square of
 * `sizeKm` × `sizeKm` around `center`.
 *
 * The square's **sides** are in local meters (not lng/lat), so it stays
 * visually square at any latitude.
 */
export function squareBbox(center: LngLat, sizeKm: number): Feature<Polygon> {
  const halfM = (sizeKm * 1000) / 2;
  const sw = localMetersToLngLat([-halfM, -halfM], center);
  const ne = localMetersToLngLat([halfM, halfM], center);
  return bboxPolygon([sw[0], sw[1], ne[0], ne[1]]);
}

/**
 * Returns the axis-aligned lng/lat bbox of a `sizeKm × sizeKm` square about
 * `center`, as `[minLng, minLat, maxLng, maxLat]` — handy for Overpass queries.
 */
export function squareLngLatBbox(center: LngLat, sizeKm: number): Bbox {
  const halfM = (sizeKm * 1000) / 2;
  const [west, south] = localMetersToLngLat([-halfM, -halfM], center);
  const [east, north] = localMetersToLngLat([halfM, halfM], center);
  return [west, south, east, north];
}

/**
 * Converts a lng/lat bbox to local meters relative to an origin (useful for
 * passing to three.js geometry builders).
 */
export function bboxToLocalMeters(
  bbox: Bbox,
  origin: LngLat,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const [minX, minY] = lngLatToLocalMeters([minLng, minLat], origin);
  const [maxX, maxY] = lngLatToLocalMeters([maxLng, maxLat], origin);
  return { minX, minY, maxX, maxY };
}
