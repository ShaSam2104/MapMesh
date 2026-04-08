/**
 * Building footprint extrusion.
 *
 * For each building feature (polygon or multipolygon), extrudes the footprint
 * upward by a height derived from OSM tags:
 *
 *   1. `height`                 (meters)
 *   2. `building:height`        (meters)
 *   3. `building:levels` × 3 m
 *   4. default fallback (10 m)
 *
 * **Units:** this module follows the project-wide convention of
 * `1 world unit = 1 real meter`. The selection is `sizeKm * 1000` wide,
 * terrain elevations are set directly from meters, so a 10 m tall building
 * extrudes to 10 world units. Print-mm scaling is applied downstream at
 * export time, not here.
 *
 * @module lib/geometry/buildings
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { LngLat } from '@/types';
import { polygonToShapes } from './polygonToShape';
import { tagged } from '@/lib/log/logger';

const log = tagged('buildings');

const DEFAULT_HEIGHT_M = 10;

/**
 * Real-world building heights are tiny relative to the printed plinth
 * footprint — a 10 m building on a 2 km selection is 0.5% of the width
 * and reads as nothing from a normal preview camera, plus it falls below
 * the 0.8 mm minimum FDM wall after the export-time scale-down. We boost
 * every building's height by this multiplier so the city skyline is
 * visible in the preview *and* prints cleanly on a 0.4 mm nozzle. The
 * `exaggeration` slider applies on top of this constant.
 */
const BUILDING_HEIGHT_BOOST = 6;

export interface BuildBuildingsOptions {
  origin: LngLat;
  /** Vertical exaggeration (applied on top of the extracted height). */
  exaggeration?: number;
  /** Fallback height in meters when tags are missing. */
  fallbackHeightM?: number;
}

/**
 * Returns the per-feature extruded meshes merged into a single BufferGeometry.
 */
export function buildBuildings(
  features: Feature[],
  options: BuildBuildingsOptions,
): THREE.BufferGeometry | null {
  if (features.length === 0) return null;

  const fallback = options.fallbackHeightM ?? DEFAULT_HEIGHT_M;
  const exaggeration = options.exaggeration ?? 1;
  const geoms: THREE.BufferGeometry[] = [];
  let fallbackCount = 0;

  for (const f of features) {
    if (!f.geometry) continue;
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;

    const heightM = extractHeightMeters(f) ?? (++fallbackCount, fallback);
    // 1 world unit = 1 real meter; the boost is a constant artistic
    // multiplier so the skyline reads visibly (see BUILDING_HEIGHT_BOOST).
    const depthWorld = heightM * BUILDING_HEIGHT_BOOST * exaggeration;
    if (depthWorld <= 0) continue;

    const shapes = polygonToShapes(
      f as Feature<Polygon | MultiPolygon>,
      options.origin,
    );
    for (const shape of shapes) {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: depthWorld,
        bevelEnabled: false,
      });
      geoms.push(g);
    }
  }

  if (geoms.length === 0) return null;

  log.info('buildings built', {
    features: features.length,
    extruded: geoms.length,
    fallbackCount,
  });

  const merged = mergeBufferGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged ?? null;
}

/**
 * Extracts a numeric height in meters from OSM tags, or `null` if missing.
 */
export function extractHeightMeters(f: Feature): number | null {
  const p = (f.properties ?? {}) as Record<string, string | number | undefined>;
  const direct = parseMeters(p.height);
  if (direct != null) return direct;
  const alt = parseMeters(p['building:height']);
  if (alt != null) return alt;
  const levels = Number(p['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return levels * 3;
  return null;
}

function parseMeters(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
}
