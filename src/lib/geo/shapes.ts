/**
 * Selection shape builders.
 *
 * For each shape (square, circle, hex) we emit two representations:
 *   - a GeoJSON Feature<Polygon> (used by turf for clipping + by the map overlay)
 *   - a `THREE.Shape` (used for 3D extrusion)
 *
 * Sizes are in **kilometers** on the physical ground, not in degrees.
 *
 * @module lib/geo/shapes
 */

import * as THREE from 'three';
import type { Feature, Polygon } from 'geojson';
import { polygon as turfPolygon } from '@turf/turf';
import type { LngLat, SelectionShape } from '@/types';
import { localMetersToLngLat } from './projection';

const CIRCLE_SEGMENTS = 64;

/**
 * Returns the metric vertices (local meters) of the selection shape, centered
 * on (0, 0), with an optional rotation in degrees (CCW).
 */
export function shapeVerticesMeters(
  shape: SelectionShape,
  sizeKm: number,
  rotationDeg: number,
): Array<[number, number]> {
  const half = (sizeKm * 1000) / 2;
  const rot = (rotationDeg * Math.PI) / 180;
  const rotate = (x: number, y: number): [number, number] => [
    x * Math.cos(rot) - y * Math.sin(rot),
    x * Math.sin(rot) + y * Math.cos(rot),
  ];

  if (shape === 'square') {
    return [
      rotate(-half, -half),
      rotate(half, -half),
      rotate(half, half),
      rotate(-half, half),
    ];
  }

  if (shape === 'circle') {
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
      verts.push(rotate(Math.cos(a) * half, Math.sin(a) * half));
    }
    return verts;
  }

  // hexagon — flat-topped
  const verts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    verts.push(rotate(Math.cos(a) * half, Math.sin(a) * half));
  }
  return verts;
}

/**
 * Returns the selection shape as a GeoJSON Feature<Polygon>. Used for clipping
 * OSM features via `@turf/turf` and rendered on the map overlay.
 */
export function shapeAsGeoJson(
  shape: SelectionShape,
  center: LngLat,
  sizeKm: number,
  rotationDeg: number,
): Feature<Polygon> {
  const verts = shapeVerticesMeters(shape, sizeKm, rotationDeg);
  const ring = verts.map((v) => localMetersToLngLat(v, center));
  ring.push(ring[0]); // close
  return turfPolygon([ring]) as Feature<Polygon>;
}

/**
 * Returns the selection shape as a `THREE.Shape`. Used as the cross-section
 * for the plinth extrusion and for any per-layer clipping fills.
 */
export function shapeAsThreeShape(
  shape: SelectionShape,
  sizeKm: number,
  rotationDeg: number,
): THREE.Shape {
  const verts = shapeVerticesMeters(shape, sizeKm, rotationDeg);
  const three = new THREE.Shape();
  three.moveTo(verts[0][0], verts[0][1]);
  for (let i = 1; i < verts.length; i++) three.lineTo(verts[i][0], verts[i][1]);
  three.closePath();
  return three;
}
