/**
 * Area slab builder — shared by Water / Grass / Sand / etc.
 *
 * Takes a list of polygon Features, converts each to a `THREE.Shape` (in
 * **print millimeters** via `polygonToShapes`), and extrudes all of them
 * by `thicknessMm` to form a slab whose **bottom** sits at `heightOffsetMm`
 * and whose top sits at `heightOffsetMm + thicknessMm`.
 *
 * **Units:** every parameter and the returned geometry are in print
 * millimeters. The default thickness is `DEFAULT_SLAB_THICKNESS_MM = 1.2`,
 * which is ≥ 0.8 mm (the minimum printable wall on a 0.4 mm FDM nozzle
 * with 2 perimeters) so grass / water / sand patches always materialise
 * on the printed model.
 *
 * **Convention:** `heightOffsetMm` is the slab bottom in the layer-local
 * frame where `z=0` is the plinth top. So `heightOffsetMm=0` means
 * "sitting on the plinth top". The scene + exporter add the absolute
 * `plinthTopZ` on top of this.
 *
 * @module lib/geometry/areaSlab
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { LngLat } from '@/types';
import { polygonToShapes } from './polygonToShape';

/**
 * Default slab thickness in **print millimeters**. 1.2 mm clears the
 * 0.8 mm minimum FDM wall (0.4 mm nozzle × 2 perimeters) with margin,
 * and reads visibly above the plinth top in the on-screen preview.
 */
export const DEFAULT_SLAB_THICKNESS_MM = 1.2;

export interface AreaSlabOptions {
  origin: LngLat;
  /** Slab thickness in **print millimeters**. */
  thicknessMm?: number;
  /**
   * Z position of the slab **bottom** in **print millimeters**, relative
   * to the plinth top (`z=0` in the layer-local frame). Positive = raised
   * above the plinth top.
   */
  heightOffsetMm: number;
}

/**
 * Extrudes each polygon by `thicknessMm` and translates so the slab bottom
 * sits at `heightOffsetMm` (in print mm above the plinth top).
 */
export function buildAreaSlab(
  features: Feature[],
  options: AreaSlabOptions,
): THREE.BufferGeometry | null {
  if (features.length === 0) return null;
  const thicknessMm = options.thicknessMm ?? DEFAULT_SLAB_THICKNESS_MM;
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
        depth: thicknessMm,
        bevelEnabled: false,
      });
      // Slab extrudes from z=0 to z=thicknessMm, then we lift it so its
      // **bottom** sits at heightOffsetMm.
      g.translate(0, 0, options.heightOffsetMm);
      geoms.push(g);
    }
  }
  if (geoms.length === 0) return null;
  const merged = mergeBufferGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged ?? null;
}
