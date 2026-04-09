/**
 * Terrain surface builder.
 *
 * Constructs a `THREE.PlaneGeometry` and displaces its vertices by sampling
 * a terrarium elevation grid.
 *
 * **Units:** the output geometry is in **print millimeters**. The selection
 * edge length in km is scaled by `PRINT_SCALE_MM_PER_M` so a 2 km
 * selection becomes a 200 mm square, and terrain relief is scaled by the
 * same factor so a 300 m elevation range becomes a 30 mm Z span.
 *
 * @module lib/geometry/terrainPlane
 */

import * as THREE from 'three';
import type { ElevationGrid } from '@/lib/data/terrarium';
import { sampleElevation } from '@/lib/data/heightSampler';
import { PRINT_SCALE_MM_PER_M } from '@/lib/geo/printScale';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';

const log = tagged('terrain');

export interface BuildTerrainOptions {
  /** Physical size of the terrain patch in kilometers. */
  sizeKm: number;
  /** Per-axis vertex count. 180 × 180 is a good quality/perf tradeoff. */
  subdivisions?: number;
  /** Vertical exaggeration multiplier (1..3). */
  exaggeration?: number;
}

export interface TerrainBuildResult {
  geometry: THREE.BufferGeometry;
  /** Min/max Z (post-exaggeration) in **print millimeters**, relative to the mean elevation. */
  zRange: { min: number; max: number };
}

/**
 * Builds a displaced plane geometry for the terrain top surface. The plane
 * is centered on (0, 0) in **print mm** and lies in the XY plane with Z up.
 */
export function buildTerrainPlane(
  grid: ElevationGrid,
  options: BuildTerrainOptions,
): TerrainBuildResult {
  const done = time(log, 'buildTerrainPlane');
  const subdivisions = options.subdivisions ?? 180;
  const exaggeration = options.exaggeration ?? 1;
  // 1 km on the ground → 100 print mm at the default 1:10000 scale.
  const sizeMm = options.sizeKm * 1000 * PRINT_SCALE_MM_PER_M;

  const geometry = new THREE.PlaneGeometry(
    sizeMm,
    sizeMm,
    subdivisions,
    subdivisions,
  );

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const meanElev = (grid.min + grid.max) / 2;
  const [minLng, minLat, maxLng, maxLat] = grid.bbox;

  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    // px,py are in mm centered on (0,0). Map fraction (-0.5..0.5) → bbox.
    const u = 0.5 + px / sizeMm;
    const v = 0.5 + py / sizeMm;
    const sampleLng = minLng + u * (maxLng - minLng);
    const sampleLat = minLat + v * (maxLat - minLat);
    const elevationM = sampleElevation(grid, sampleLng, sampleLat);
    // Exaggerate around the mean, then scale real meters → print mm.
    const relMm =
      (elevationM - meanElev) * exaggeration * PRINT_SCALE_MM_PER_M;
    pos.setZ(i, relMm);
    if (relMm < zMin) zMin = relMm;
    if (relMm > zMax) zMax = relMm;
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  log.info('terrain built', {
    subdivisions,
    zMin: Number(zMin.toFixed(2)),
    zMax: Number(zMax.toFixed(2)),
  });
  done();
  return { geometry, zRange: { min: zMin, max: zMax } };
}
