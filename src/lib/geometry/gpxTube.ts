/**
 * GPX path → 3D tube.
 *
 * Projects the GPX LineString into local meters, samples the terrain for
 * z-elevation, lifts the path by `heightAboveTerrainMm`, then builds a
 * smooth Catmull-Rom + TubeGeometry.
 *
 * **Units:** the terrain builder maps 1 meter of world → 1 print unit
 * (so a 2 km selection becomes 2000 print units). We follow that identity
 * here: local meters are used directly as coordinates in the tube.
 *
 * @module lib/geometry/gpxTube
 */

import * as THREE from 'three';
import type { Feature, LineString } from 'geojson';
import type { LngLat } from '@/types';
import type { ElevationGrid } from '@/lib/data/terrarium';
import { sampleElevation } from '@/lib/data/heightSampler';
import { lngLatToLocalMeters } from '@/lib/geo/projection';

export interface GpxTubeOptions {
  origin: LngLat;
  grid: ElevationGrid;
  /** Height above the terrain surface in world units (= meters). */
  heightAboveTerrain?: number;
  /** Radius of the tube in world units (= meters). */
  radius?: number;
  /** Tube radial segments. */
  radialSegments?: number;
  /** Number of segments along the curve. Defaults to `points × 4`. */
  tubeSegments?: number;
  /** Exaggeration — must match the terrain exaggeration to stay flush. */
  exaggeration?: number;
}

/**
 * Returns a `TubeGeometry` ready to render as an emissive cyan path.
 */
export function buildGpxTube(
  feature: Feature<LineString>,
  options: GpxTubeOptions,
): THREE.BufferGeometry | null {
  const coords = feature.geometry.coordinates;
  if (coords.length < 2) return null;

  const exaggeration = options.exaggeration ?? 1;
  // Defaults chosen for real-world meters: 3 m above the terrain, 5 m tube
  // radius — thick enough to read clearly at 1–2 km selection sizes.
  const heightAbove = options.heightAboveTerrain ?? 3;
  const radius = options.radius ?? 5;
  const radial = options.radialSegments ?? 8;
  const meanElev = (options.grid.min + options.grid.max) / 2;

  const points = coords.map((c) => {
    const [lng, lat] = c as [number, number];
    const [mx, my] = lngLatToLocalMeters([lng, lat], options.origin);
    const elevationM = sampleElevation(options.grid, lng, lat);
    const z = (elevationM - meanElev) * exaggeration + heightAbove;
    return new THREE.Vector3(mx, my, z);
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const segments = options.tubeSegments ?? points.length * 4;
  return new THREE.TubeGeometry(curve, segments, radius, radial, false);
}
