/**
 * GPX path → **3D ribbon slab** (watertight).
 *
 * Earlier versions used `THREE.TubeGeometry`, which emits an *open*-ended
 * tube (no endcaps) — a non-watertight mesh that slicers have to auto-
 * repair and that conflicts with the "printer-friendly" goal. We instead
 * reuse the same library-backed pipeline as Roads/Piers:
 *
 *   1. Optionally split the GPX coordinates into contiguous runs that lie
 *      inside the selection polygon (so a long Strava track that wanders
 *      off the plinth gets trimmed cleanly instead of "flying away").
 *   2. For each run, build a fresh GeoJSON LineString and hand it to
 *      `buildLineStrip`, which turf-buffers the line into a polygon and
 *      extrudes it into a closed slab via `areaSlab`.
 *   3. Merge the per-run slabs into a single BufferGeometry.
 *
 * The result is a chunky, visually-obvious highlight that is watertight
 * per-run and prints cleanly on a 0.4 mm FDM nozzle.
 *
 * **Units:** every parameter and the returned geometry are in print mm
 * except `widthMeters` (passed straight to turf.buffer), which is in
 * real-world meters.
 *
 * @module lib/geometry/gpxTube
 */

import { mergeBufferGeometries } from 'three-stdlib';
import { booleanPointInPolygon } from '@turf/turf';
import type { Feature, LineString, Polygon, Position } from 'geojson';
import type { BufferGeometry } from 'three';
import type { LngLat } from '@/types';
import { buildLineStrip } from './lineStrip';

/**
 * Default half-width of the GPX ribbon in **real-world meters**. Passed
 * straight through to turf.buffer. At the default 1:10000 print scale
 * this collapses to ~1.8 mm printed half-width (3.6 mm full ribbon) —
 * well above the 0.8 mm minimum FDM wall and clearly visible.
 */
export const DEFAULT_GPX_WIDTH_METERS = 18;

/**
 * Default height of the GPX ribbon bottom above the plinth top in
 * **print millimeters**. Tuned so the ribbon clears the surrounding
 * area slabs (`DEFAULT_SLAB_THICKNESS_MM = 1.2`) and is plainly
 * visible from above on the printed model.
 */
export const DEFAULT_GPX_HEIGHT_MM = 2.5;

/**
 * Default thickness of the ribbon in **print millimeters**. 1.2 mm
 * matches the area slab thickness so the ribbon reads as a chunky
 * highlight rather than a thin line.
 */
export const DEFAULT_GPX_THICKNESS_MM = 1.2;

export interface GpxTubeOptions {
  origin: LngLat;
  /** Ribbon height above the plinth top in **print millimeters**. */
  heightOffsetMm?: number;
  /** Ribbon thickness in **print millimeters**. */
  thicknessMm?: number;
  /** Half-width in real-world meters (turf.buffer "radius"). */
  widthMeters?: number;
  /**
   * Optional selection polygon (lng/lat). When provided, GPX coordinates
   * outside the polygon are dropped and the remaining coordinates are
   * grouped into contiguous in-shape runs; one ribbon slab per run.
   */
  clipShape?: Feature<Polygon>;
}

/**
 * Returns a merged `BufferGeometry` containing one watertight ribbon slab
 * per contiguous run of in-shape coordinates (or one ribbon for the
 * whole path if `clipShape` is omitted). Returns `null` if no usable
 * run remains.
 */
export function buildGpxTube(
  feature: Feature<LineString>,
  options: GpxTubeOptions,
): BufferGeometry | null {
  const coords = feature.geometry.coordinates;
  if (coords.length < 2) return null;

  const widthMeters = options.widthMeters ?? DEFAULT_GPX_WIDTH_METERS;
  const heightOffsetMm = options.heightOffsetMm ?? DEFAULT_GPX_HEIGHT_MM;
  const thicknessMm = options.thicknessMm ?? DEFAULT_GPX_THICKNESS_MM;

  const runs = options.clipShape
    ? splitIntoInsideRuns(coords, options.clipShape)
    : [coords];

  const slabs: BufferGeometry[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    const runFeature: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: run },
    };
    const slab = buildLineStrip([runFeature], {
      origin: options.origin,
      widthMeters,
      thicknessMm,
      heightOffsetMm,
    });
    if (slab) slabs.push(slab);
  }

  if (slabs.length === 0) return null;
  if (slabs.length === 1) return slabs[0];

  const merged = mergeBufferGeometries(slabs, false);
  for (const g of slabs) g.dispose();
  return merged ?? null;
}

/**
 * Walks the coords once and groups them into contiguous runs of points
 * that lie inside the clip polygon. We test each point with
 * `booleanPointInPolygon` and split a new run whenever an outside point
 * is encountered.
 */
function splitIntoInsideRuns(
  coords: Position[],
  clipShape: Feature<Polygon>,
): Position[][] {
  const runs: Position[][] = [];
  let current: Position[] = [];
  for (const c of coords) {
    const inside = booleanPointInPolygon(
      { type: 'Point', coordinates: c },
      clipShape,
    );
    if (inside) {
      current.push(c);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}
