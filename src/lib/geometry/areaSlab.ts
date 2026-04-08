/**
 * Area slab builder — shared by Water / Grass / Sand / etc.
 *
 * Takes a list of polygon Features, converts each to a `THREE.Shape`, and
 * extrudes all of them by a small depth to form a thin slab sitting at the
 * layer's designated `heightOffset`.
 *
 * **Units:** `1 world unit = 1 real meter` (matches the rest of the pipeline).
 * A slab `thickness` of 0.4 therefore means 40 cm of real-world thickness,
 * which reads as a thin veneer on a multi-km plinth. Print-mm scaling is
 * applied downstream at export time.
 *
 * @module lib/geometry/areaSlab
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { LngLat } from '@/types';
import { polygonToShapes } from './polygonToShape';

export interface AreaSlabOptions {
  origin: LngLat;
  /** Slab thickness in world units (= meters). */
  thickness?: number;
  /** Z-offset for the top of the slab in world units, relative to z=0 (terrain top). */
  heightOffset: number;
}

/**
 * Extrudes each polygon by `thickness` and translates by `heightOffset`.
 */
export function buildAreaSlab(
  features: Feature[],
  options: AreaSlabOptions,
): THREE.BufferGeometry | null {
  if (features.length === 0) return null;
  const thickness = options.thickness ?? 0.4;
  const geoms: THREE.BufferGeometry[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    const shapes = polygonToShapes(
      f as Feature<Polygon | MultiPolygon>,
      options.origin,
    );
    for (const shape of shapes) {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      });
      g.translate(0, 0, options.heightOffset - thickness);
      geoms.push(g);
    }
  }
  if (geoms.length === 0) return null;
  const merged = mergeBufferGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged ?? null;
}
