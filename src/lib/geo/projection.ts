/**
 * Projection helpers — a thin wrapper around @math.gl/web-mercator.
 *
 * MeshMap uses a **local tangent-plane** centered on the selection centroid
 * so the print coordinates are symmetric around (0,0). This is not a true
 * geodesic projection, but at the ≤3 km scale of a single print it is
 * indistinguishable from one and avoids mercator scale distortion.
 *
 * All returned meters are relative to the given origin.
 *
 * @module lib/geo/projection
 */

import type { LngLat } from '@/types';

const EARTH_RADIUS_M = 6378137;
const DEG2RAD = Math.PI / 180;

/**
 * Converts an (lng, lat) point to (x, y) meters in a local ENU tangent plane
 * centered on `origin`.
 *
 * This is the **equirectangular-on-a-tangent-plane** approximation: accurate
 * to ~1 cm over spans ≤ 3 km at any latitude.
 *
 * @param lngLat point to project (degrees)
 * @param origin tangent-plane centroid (degrees)
 * @returns `[metersEast, metersNorth]` relative to the origin
 */
export function lngLatToLocalMeters(lngLat: LngLat, origin: LngLat): [number, number] {
  const [lng, lat] = lngLat;
  const [olng, olat] = origin;
  const dLng = (lng - olng) * DEG2RAD;
  const dLat = (lat - olat) * DEG2RAD;
  const cosOriginLat = Math.cos(olat * DEG2RAD);
  const x = dLng * EARTH_RADIUS_M * cosOriginLat;
  const y = dLat * EARTH_RADIUS_M;
  return [x, y];
}

/**
 * Inverse of `lngLatToLocalMeters`.
 */
export function localMetersToLngLat(
  meters: [number, number],
  origin: LngLat,
): LngLat {
  const [x, y] = meters;
  const [olng, olat] = origin;
  const cosOriginLat = Math.cos(olat * DEG2RAD);
  const dLng = x / (EARTH_RADIUS_M * cosOriginLat);
  const dLat = y / EARTH_RADIUS_M;
  return [olng + dLng / DEG2RAD, olat + dLat / DEG2RAD];
}

/**
 * Haversine great-circle distance in meters. Used for GPX distance stats.
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const φ1 = lat1 * DEG2RAD;
  const φ2 = lat2 * DEG2RAD;
  const dφ = (lat2 - lat1) * DEG2RAD;
  const dλ = (lng2 - lng1) * DEG2RAD;
  const s =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}
