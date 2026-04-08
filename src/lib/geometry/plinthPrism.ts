/**
 * Plinth prism builder.
 *
 * Wraps `THREE.ExtrudeGeometry` with a uniform depth to produce the vertical
 * side walls + flat bottom of the print plinth. The terrain top is built
 * separately and stitched in via manifold-3d.
 *
 * @module lib/geometry/plinthPrism
 */

import * as THREE from 'three';
import type { SelectionShape } from '@/types';
import { shapeAsThreeShape } from '@/lib/geo/shapes';

export interface PlinthPrismOptions {
  shape: SelectionShape;
  sizeKm: number;
  rotationDeg: number;
  /** Plinth body depth in millimeters (extends downward from z=0). */
  baseThicknessMm: number;
}

/**
 * Returns a `BufferGeometry` that is the downward extrusion of the
 * selection shape by `baseThicknessMm`.
 */
export function buildPlinthPrism(options: PlinthPrismOptions): THREE.BufferGeometry {
  const shape = shapeAsThreeShape(options.shape, options.sizeKm, options.rotationDeg);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: options.baseThicknessMm,
    bevelEnabled: false,
  });
  // ExtrudeGeometry extrudes in +Z; we want the prism sitting below z=0.
  geom.translate(0, 0, -options.baseThicknessMm);
  return geom;
}
