/**
 * Computes plinth-edge flange specifications from a list of text labels.
 *
 * A **flange** is a rectangular tab extruded alongside the plinth polygon
 * before the watertight extrusion step. Its purpose is to give text labels
 * a vertical canvas to sit on — the plinth's own sides are flush with the
 * footprint, so without a flange there is no room for a raised letter to
 * live without overhanging the ground.
 *
 * This module is **pure**: it takes the selection geometry + the current
 * labels and returns the specs (rectangle polygon + outer-face transform)
 * that `buildWatertightPlinth` then unions into the plinth cross-section.
 *
 * Units are consistently **print millimeters** (`1 world unit = 1 print mm`).
 *
 * @module lib/geometry/flangeSpecs
 */

import type { FlangeSide, SelectionShape, TextLabel } from '@/types';
import { shapeVerticesMeters } from '@/lib/geo/shapes';
import { PRINT_SCALE_MM_PER_M } from '@/lib/geo/printScale';

/** Minimum flange depth (outward reach) in print mm. */
export const MIN_FLANGE_DEPTH_MM = 6;
/** Padding added to the deepest label extrusion to size the flange. */
export const FLANGE_DEPTH_PADDING_MM = 4;

export interface FlangeSpec {
  side: FlangeSide;
  /** Flange length along the edge in **print mm**. */
  widthMm: number;
  /** Flange reach outward from the plinth edge in **print mm**. */
  depthMm: number;
  /**
   * The flange tab polygon in **absolute mm world coordinates** (post
   * rotation). CCW-ordered. This is what `buildWatertightPlinth` unions
   * into the plinth cross-section.
   */
  rectVerts: Array<[number, number]>;
  /** Outer-face center in mm world coordinates (post rotation). */
  outerFaceCenter: [number, number, number];
  /** Unit outward normal (post rotation). */
  outwardNormal: [number, number, number];
  /**
   * Unit tangent along the edge in the text reading direction
   * (post rotation). Derived as `worldUp × normal` so that
   * `(tangent, worldUp, normal)` is a right-handed basis, which is what
   * the reader expects when standing outside the plinth looking at the
   * flange face.
   */
  edgeTangent: [number, number, number];
}

export interface ComputeFlangeSpecsOptions {
  shape: SelectionShape;
  sizeKm: number;
  rotationDeg: number;
  baseThicknessMm: number;
  /** Plinth top Z in print mm (from `buildWatertightPlinth` output). */
  topZ: number;
  labels: TextLabel[];
}

/**
 * Returns one `FlangeSpec` per side that has at least one label.
 *
 * The rectangle polygon and outer-face transform are produced in the
 * unrotated plinth frame and then rotated by `rotationDeg` so the spec
 * plugs directly into the rotated plinth cross-section.
 *
 * Returns an empty array when there are no labels.
 */
export function computeFlangeSpecs(
  opts: ComputeFlangeSpecsOptions,
): FlangeSpec[] {
  if (opts.labels.length === 0) return [];

  // Group labels by side; record the deepest extrusion per side.
  const maxExtrusionBySide: Partial<Record<FlangeSide, number>> = {};
  for (const label of opts.labels) {
    const cur = maxExtrusionBySide[label.side] ?? 0;
    if (label.extrusionMm > cur) maxExtrusionBySide[label.side] = label.extrusionMm;
  }

  // Axis-aligned bbox of the unrotated shape in print mm.
  const unrotated = shapeVerticesMeters(opts.shape, opts.sizeKm, 0).map(
    ([x, y]) => [x * PRINT_SCALE_MM_PER_M, y * PRINT_SCALE_MM_PER_M] as [number, number],
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of unrotated) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const midZ = (-opts.baseThicknessMm + opts.topZ) / 2;

  const rot = (opts.rotationDeg * Math.PI) / 180;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const rotateXY = (x: number, y: number): [number, number] => [
    x * cr - y * sr,
    x * sr + y * cr,
  ];

  const out: FlangeSpec[] = [];

  for (const side of ['north', 'south', 'east', 'west'] as const) {
    const maxExtrusion = maxExtrusionBySide[side];
    if (maxExtrusion === undefined) continue;
    const depthMm = Math.max(MIN_FLANGE_DEPTH_MM, maxExtrusion + FLANGE_DEPTH_PADDING_MM);

    let rectUnrotated: Array<[number, number]>;
    let widthMm: number;
    let faceCenterUnrotated: [number, number, number];
    let normalUnrotated: [number, number, number];

    if (side === 'north') {
      widthMm = maxX - minX;
      rectUnrotated = [
        [minX, maxY],
        [maxX, maxY],
        [maxX, maxY + depthMm],
        [minX, maxY + depthMm],
      ];
      faceCenterUnrotated = [(minX + maxX) / 2, maxY + depthMm, midZ];
      normalUnrotated = [0, 1, 0];
    } else if (side === 'south') {
      widthMm = maxX - minX;
      rectUnrotated = [
        [minX, minY - depthMm],
        [maxX, minY - depthMm],
        [maxX, minY],
        [minX, minY],
      ];
      faceCenterUnrotated = [(minX + maxX) / 2, minY - depthMm, midZ];
      normalUnrotated = [0, -1, 0];
    } else if (side === 'east') {
      widthMm = maxY - minY;
      rectUnrotated = [
        [maxX, minY],
        [maxX + depthMm, minY],
        [maxX + depthMm, maxY],
        [maxX, maxY],
      ];
      faceCenterUnrotated = [maxX + depthMm, (minY + maxY) / 2, midZ];
      normalUnrotated = [1, 0, 0];
    } else {
      // west
      widthMm = maxY - minY;
      rectUnrotated = [
        [minX - depthMm, minY],
        [minX, minY],
        [minX, maxY],
        [minX - depthMm, maxY],
      ];
      faceCenterUnrotated = [minX - depthMm, (minY + maxY) / 2, midZ];
      normalUnrotated = [-1, 0, 0];
    }

    const rectVerts = rectUnrotated.map(([x, y]) => rotateXY(x, y));

    // Rotate the in-plane vectors around Z (z component unaffected).
    const [fcx, fcy, fcz] = faceCenterUnrotated;
    const [fcxR, fcyR] = rotateXY(fcx, fcy);
    const outerFaceCenter: [number, number, number] = [fcxR, fcyR, fcz];

    const [nx, ny, nz] = normalUnrotated;
    const [nxR, nyR] = rotateXY(nx, ny);
    const outwardNormal: [number, number, number] = [nxR, nyR, nz];

    // tangent = worldUp × normal → right-handed face basis
    // (tangent, worldUp, normal). worldUp = (0,0,1) in mm world space.
    const edgeTangent: [number, number, number] = [
      0 * outwardNormal[2] - 1 * outwardNormal[1],
      1 * outwardNormal[0] - 0 * outwardNormal[2],
      0 * outwardNormal[1] - 0 * outwardNormal[0],
    ];

    out.push({
      side,
      widthMm,
      depthMm,
      rectVerts,
      outerFaceCenter,
      outwardNormal,
      edgeTangent,
    });
  }

  return out;
}
