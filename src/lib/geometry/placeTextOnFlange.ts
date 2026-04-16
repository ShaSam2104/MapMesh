/**
 * Places a flat text geometry onto the outer face of a plinth flange.
 *
 * Input geometry from `buildTextGeometry` lives in the XY plane with
 * depth along +Z. This module rotates it so:
 *
 *   local +X → edgeTangent      (reading direction across the face)
 *   local +Y → world +Z          (lines stack upward along the plinth)
 *   local +Z → outwardNormal     (relief extrudes outward from the face)
 *
 * Then it translates the result to the correct alignment + offset on
 * the flange edge and centers the letter height vertically on the
 * flange face.
 *
 * All computation is plain `THREE.Matrix4` math — no custom geometry.
 *
 * @module lib/geometry/placeTextOnFlange
 */

import * as THREE from 'three';
import type { BufferGeometry } from 'three';
import type { FlangeSpec } from './flangeSpecs';

export interface PlaceTextLabelInfo {
  alignment: 'left' | 'center' | 'right';
  offsetMm: number;
}

export interface PlaceTextOnFlangeOptions {
  /** Flat text geometry from `buildTextGeometry`. Consumed by this call. */
  geometry: BufferGeometry;
  /** Text width along local X (from `buildTextGeometry` result). */
  textWidthMm: number;
  /** Text height along local Y (from `buildTextGeometry` result). */
  textHeightMm: number;
  flange: FlangeSpec;
  label: PlaceTextLabelInfo;
}

/**
 * Returns a **new** BufferGeometry representing the placed text. The
 * input geometry is cloned + transformed so callers can keep the
 * untransformed cache around.
 */
export function placeTextOnFlange(
  options: PlaceTextOnFlangeOptions,
): BufferGeometry {
  const { geometry, textWidthMm, textHeightMm, flange, label } = options;

  // 1. Align the text so its origin is on the outer face:
  //      local X = 0 at the left edge of the final text block
  //      local Y = 0 at the middle of the text vertically
  //      local Z = 0 at the flange face (geometry extrudes outward)
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const offsetX = bbox ? -bbox.min.x : 0;
  const offsetY = bbox ? -(bbox.min.y + textHeightMm / 2) : 0;
  const offsetZ = 0;
  const pre = new THREE.Matrix4().makeTranslation(offsetX, offsetY, offsetZ);
  const local = geometry.clone();
  local.applyMatrix4(pre);

  // 2. Build the face basis (tangent, worldUp, normal). This is the
  //    matrix that maps local text coordinates into world coordinates.
  const tangent = new THREE.Vector3(...flange.edgeTangent);
  const normal = new THREE.Vector3(...flange.outwardNormal);
  // Use world-up as the vertical axis so text lines stack along +Z.
  const up = new THREE.Vector3(0, 0, 1);
  const basis = new THREE.Matrix4().makeBasis(tangent, up, normal);

  // 3. Alignment along the edge: shift the text along the tangent so
  //    that the chosen alignment point sits at offsetMm past the edge
  //    center.
  const halfWidth = textWidthMm / 2;
  const halfFlange = flange.widthMm / 2;
  let alignShift: number;
  if (label.alignment === 'left') {
    // Start at the left end of the flange.
    alignShift = -halfFlange;
  } else if (label.alignment === 'right') {
    // End at the right end of the flange.
    alignShift = halfFlange - textWidthMm;
  } else {
    // Center: put the text's midpoint at 0.
    alignShift = -halfWidth;
  }
  // Additionally apply the user's free offset (clamped upstream) and
  // push into the face via the basis.
  const alongEdge = alignShift + label.offsetMm;
  const shift = new THREE.Matrix4().makeTranslation(alongEdge, 0, 0);
  basis.multiply(shift);

  // 4. Translate to the flange outer face center in world space.
  const toFace = new THREE.Matrix4().makeTranslation(
    flange.outerFaceCenter[0],
    flange.outerFaceCenter[1],
    flange.outerFaceCenter[2],
  );
  const world = toFace.multiply(basis);

  local.applyMatrix4(world);
  return local;
}
