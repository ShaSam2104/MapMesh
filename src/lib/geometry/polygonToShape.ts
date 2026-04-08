/**
 * Converts a GeoJSON Polygon (with optional holes) projected into local
 * meters into a `THREE.Shape` suitable for extrusion.
 *
 * @module lib/geometry/polygonToShape
 */

import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import type { LngLat } from '@/types';
import { lngLatToLocalMeters } from '@/lib/geo/projection';

/**
 * Returns an array of `THREE.Shape` instances (one per outer ring) from a
 * GeoJSON Polygon or MultiPolygon, in local meters about `origin`.
 */
export function polygonToShapes(
  feature: Feature<Polygon | MultiPolygon>,
  origin: LngLat,
): THREE.Shape[] {
  const out: THREE.Shape[] = [];
  const polys: Position[][][] =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  for (const rings of polys) {
    if (rings.length === 0) continue;
    const [outerRing, ...holes] = rings;
    const shape = new THREE.Shape(
      outerRing.map((c) => {
        const [x, y] = lngLatToLocalMeters([c[0], c[1]], origin);
        return new THREE.Vector2(x, y);
      }),
    );
    for (const hole of holes) {
      const h = new THREE.Path(
        hole.map((c) => {
          const [x, y] = lngLatToLocalMeters([c[0], c[1]], origin);
          return new THREE.Vector2(x, y);
        }),
      );
      shape.holes.push(h);
    }
    out.push(shape);
  }
  return out;
}
