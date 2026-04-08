/**
 * Splits an Overpass-derived GeoJSON FeatureCollection into per-layer buckets
 * using the tag predicates in `osmQueries.ts`, then clips each feature to
 * the selection shape via `turf.intersect`.
 *
 * @module lib/data/osmFeatures
 */

import { intersect as turfIntersect, featureCollection } from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Polygon,
  MultiPolygon,
} from 'geojson';
import { tagged } from '@/lib/log/logger';
import type { LayerKey } from '@/types';
import { classifyFeature } from './osmQueries';

const log = tagged('osm-features');

export type ClassifiedFeatures = Partial<Record<LayerKey, Feature[]>>;

/**
 * Bucketizes features into layer categories. Does NOT clip — that happens
 * later with `clipToShape` so polygons and lines can be treated differently.
 */
export function classifyFeatures(fc: FeatureCollection): ClassifiedFeatures {
  const out: ClassifiedFeatures = {};
  for (const f of fc.features) {
    const key = classifyFeature(f);
    if (!key) continue;
    (out[key] ??= []).push(f);
  }
  log.debug('classified', {
    counts: Object.fromEntries(
      (Object.keys(out) as LayerKey[]).map((k) => [k, out[k]?.length ?? 0]),
    ),
  });
  return out;
}

/**
 * Clips each polygon feature against the selection polygon. Line features
 * are kept as-is (road/pier buffering happens later in the geometry lib,
 * where it is simpler to clip the buffered polygon).
 */
export function clipPolygonsToShape(
  features: Feature[],
  shape: Feature<Polygon>,
): Feature[] {
  const out: Feature[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      try {
        const clipped = turfIntersect(
          featureCollection([
            f as Feature<Polygon | MultiPolygon>,
            shape as unknown as Feature<Polygon>,
          ]),
        );
        if (clipped) {
          clipped.properties = { ...(f.properties ?? {}) };
          out.push(clipped as Feature<Geometry>);
        }
      } catch {
        // turf throws on self-intersecting rings occasionally — drop it
      }
    } else {
      out.push(f);
    }
  }
  return out;
}
