/**
 * Converts a GeoJSON Polygon (with optional holes) projected into local
 * meters and scaled to **print millimeters**, ready to feed into a
 * `THREE.Shape` for extrusion.
 *
 * Projection is local tangent-plane meters (see `lngLatToLocalMeters`);
 * the result is then multiplied by `PRINT_SCALE_MM_PER_M` so every
 * downstream geometry builder works in a single mm-space.
 *
 * @module lib/geometry/polygonToShape
 */

import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import type { LngLat } from '@/types';
import { lngLatToLocalMeters } from '@/lib/geo/projection';
import { PRINT_SCALE_MM_PER_M } from '@/lib/geo/printScale';

/**
 * Returns an array of `THREE.Shape` instances (one per outer ring) from a
 * GeoJSON Polygon or MultiPolygon, in **print millimeters** about `origin`.
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
        const [mx, my] = lngLatToLocalMeters([c[0], c[1]], origin);
        return new THREE.Vector2(
          mx * PRINT_SCALE_MM_PER_M,
          my * PRINT_SCALE_MM_PER_M,
        );
      }),
    );
    for (const hole of holes) {
      const h = new THREE.Path(
        hole.map((c) => {
          const [mx, my] = lngLatToLocalMeters([c[0], c[1]], origin);
          return new THREE.Vector2(
            mx * PRINT_SCALE_MM_PER_M,
            my * PRINT_SCALE_MM_PER_M,
          );
        }),
      );
      shape.holes.push(h);
    }
    out.push(shape);
  }
  return out;
}
