/**
 * Line strip builder — shared by Roads / Piers / GPX path.
 *
 * Takes LineString features, buffers them into polygons using `turf.buffer`
 * (in **real-world meters**, which is what turf expects), optionally clips
 * the buffered polygons against the selection shape, then extrudes the
 * result via `areaSlab` in **print millimeters**.
 *
 * `widthMeters` stays in real-world meters because turf.buffer operates in
 * meters on the ground; everything downstream of `polygonToShapes` is in
 * print mm via the `PRINT_SCALE_MM_PER_M` constant.
 *
 * @module lib/geometry/lineStrip
 */

import { buffer as turfBuffer, intersect as turfIntersect, featureCollection } from '@turf/turf';
import type { Feature, LineString, MultiLineString, Polygon, MultiPolygon } from 'geojson';
import type { BufferGeometry } from 'three';
import type { LngLat } from '@/types';
import { buildAreaSlab } from './areaSlab';

/**
 * Default line-strip thickness in **print millimeters**. Slightly thinner
 * than slabs so roads/piers sit cleanly inside grass/sand slabs without
 * z-fighting on the top face when the user puts them at the same height
 * offset. 1.0 mm is still above the 0.8 mm minimum FDM wall.
 */
export const DEFAULT_LINESTRIP_THICKNESS_MM = 1.0;

export interface LineStripOptions {
  origin: LngLat;
  /** Line half-width in real-world meters (turf.buffer "radius"). */
  widthMeters: number;
  /** Slab thickness in **print millimeters**. */
  thicknessMm?: number;
  /** Z-offset in **print millimeters** above plinth top (z=0). */
  heightOffsetMm: number;
  /**
   * Optional selection polygon. When provided, buffered line geometries are
   * intersected with this shape so road/pier strips do not extend beyond
   * the plinth footprint. Same shape used by `clipPolygonsToShape` for
   * polygon layers.
   */
  clipShape?: Feature<Polygon>;
}

/**
 * Buffers each line feature and extrudes the buffered polygons into a slab.
 */
export function buildLineStrip(
  features: Feature[],
  options: LineStripOptions,
): BufferGeometry | null {
  if (features.length === 0) return null;

  const buffered: Feature[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    let polyFeature: Feature<Polygon | MultiPolygon> | null = null;
    if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') {
      try {
        const b = turfBuffer(
          f as Feature<LineString | MultiLineString>,
          options.widthMeters,
          { units: 'meters' },
        );
        if (b) polyFeature = b as Feature<Polygon | MultiPolygon>;
      } catch {
        /* ignore malformed lines */
      }
    } else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      // Some roads/piers come as polygons already — pass through
      polyFeature = f as Feature<Polygon | MultiPolygon>;
    }
    if (!polyFeature) continue;

    // Optional shape clipping. We intersect *after* buffering so clipping
    // happens against the buffered polygon (which is the geometry that
    // would actually extrude). turf.intersect throws on degenerate inputs;
    // we drop those silently.
    if (options.clipShape) {
      try {
        const clipped = turfIntersect(
          featureCollection([polyFeature, options.clipShape]),
        );
        if (!clipped) continue;
        polyFeature = clipped as Feature<Polygon | MultiPolygon>;
      } catch {
        continue;
      }
    }

    buffered.push(polyFeature);
  }

  return buildAreaSlab(buffered, {
    origin: options.origin,
    thicknessMm: options.thicknessMm ?? DEFAULT_LINESTRIP_THICKNESS_MM,
    heightOffsetMm: options.heightOffsetMm,
  });
}
