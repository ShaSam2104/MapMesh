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
 * **Units:** footprints are projected into **print millimeters** by
 * `polygonToShapes` (via `PRINT_SCALE_MM_PER_M`), and the extrusion depth is
 * also in print mm — `clamp(heightM, MAX_BUILDING_HEIGHT_M) × exaggeration × PRINT_SCALE_MM_PER_M`.
 *
 * There is **no** constant boost: at the 1:10000 print scale a 100 m
 * skyscraper already reads at 10 mm print mm (× user exaggeration), which is
 * the right proportion against the 200 mm plinth edge of a 2 km selection.
 * Earlier versions of this builder applied a 6× boost that produced 240 mm
 * needles for Mumbai towers, overflowing the Bambu X1 256 mm bed; see
 * `CLAUDE.md` Golden Rule 6 + 7. The user-facing `exaggeration` slider (1×–3×)
 * is the only lever for tuning vertical presence.
 *
 * Heights above `MAX_BUILDING_HEIGHT_M` are clamped to guard against
 * erroneous OSM tags (e.g. `height=9999` for a stray mast).
 *
 * @module lib/geometry/buildings
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { LngLat } from '@/types';
import { polygonToShapes } from './polygonToShape';
import { PRINT_SCALE_MM_PER_M } from '@/lib/geo/printScale';
import { tagged } from '@/lib/log/logger';

const log = tagged('buildings');

const DEFAULT_HEIGHT_M = 10;

/**
 * Hard ceiling for building height in real-world meters. OSM occasionally
 * has nonsense height tags (`9999`, stray radio masts tagged as buildings,
 * etc.) which, without clamping, would extrude into meters-tall print
 * obelisks. 500 m covers the tallest real building on earth and rejects
 * garbage upstream of the print scale.
 */
export const MAX_BUILDING_HEIGHT_M = 500;

export interface BuildBuildingsOptions {
  origin: LngLat;
  /** Vertical exaggeration (applied on top of the extracted height). */
  exaggeration?: number;
  /** Fallback height in meters when tags are missing. */
  fallbackHeightM?: number;
  /**
   * Per-feature building height multiplier — the user-controlled "make
   * buildings taller or shorter" knob. Applied on top of `exaggeration`.
   * Default 1 (no change). Clamping to a sane 0.3–3 range is the caller's
   * responsibility; values are trusted here.
   */
  heightScale?: number;
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
  const heightScale = options.heightScale ?? 1;
  const geoms: THREE.BufferGeometry[] = [];
  let fallbackCount = 0;
  let clampedCount = 0;

  for (const f of features) {
    if (!f.geometry) continue;
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;

    let heightM = extractHeightMeters(f) ?? (++fallbackCount, fallback);
    if (heightM > MAX_BUILDING_HEIGHT_M) {
      clampedCount++;
      heightM = MAX_BUILDING_HEIGHT_M;
    }
    if (heightM <= 0) continue;
    // Real meters → print mm. A 100 m building → 100 × 1 × 1 × 0.1 = 10 mm
    // at exag=1, heightScale=1. `exaggeration` is the global vertical
    // multiplier; `heightScale` is the per-layer user knob in the Style tab.
    const depthMm = heightM * exaggeration * heightScale * PRINT_SCALE_MM_PER_M;
    if (depthMm <= 0) continue;

    const shapes = polygonToShapes(
      f as Feature<Polygon | MultiPolygon>,
      options.origin,
    );
    for (const shape of shapes) {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: depthMm,
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
    clampedCount,
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
