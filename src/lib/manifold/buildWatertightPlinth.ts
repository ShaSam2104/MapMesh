/**
 * Watertight plinth constructor.
 *
 * This is the single point of trust for the reliability mandate. Given an
 * elevation grid and a 2D cross-section, it emits a Manifold (and a
 * BufferGeometry for rendering) that is guaranteed watertight by construction.
 *
 * The plinth is built as a flat-topped prism in **print millimeters**:
 *   1. Take the selection shape in print mm (`shapeVerticesMm` scales real
 *      world meters → mm via `PRINT_SCALE_MM_PER_M`).
 *   2. Extrude by `baseThicknessMm + topOffsetMm` to form a closed solid
 *      via manifold-3d.
 *   3. Translate so the plinth bottom sits at `z = -baseThicknessMm` and
 *      the top sits at `z = topOffsetMm` (i.e. the plinth-top surface
 *      layer features sit on top of).
 *
 * Watertightness + manifold-ness are enforced by manifold-3d by
 * construction; we validate `numTri > 0` and log the bbox for sanity.
 *
 * @module lib/manifold/buildWatertightPlinth
 */

import type { BufferGeometry } from 'three';
import type { Manifold } from 'manifold-3d';
import type { SelectionShape } from '@/types';
import type { ElevationGrid } from '@/lib/data/terrarium';
import { shapeVerticesMm } from '@/lib/geo/shapes';
import { PRINT_SCALE_MM_PER_M } from '@/lib/geo/printScale';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import { getManifold } from './loader';
import { toBufferGeometry } from './toBufferGeometry';

const log = tagged('plinth');

export interface BuildPlinthOptions {
  shape: SelectionShape;
  sizeKm: number;
  rotationDeg: number;
  baseThicknessMm: number;
  /** Vertical exaggeration (matches terrainPlane builder). */
  exaggeration?: number;
  /** Subdivisions per axis for the terrain cap. */
  subdivisions?: number;
  /** The elevation grid covering the selection bbox. */
  grid: ElevationGrid;
}

export interface PlinthResult {
  renderGeometry: BufferGeometry;
  manifold: Manifold;
  dimsMm: { x: number; y: number; z: number };
  triCount: number;
  /**
   * Z-coordinate of the plinth top surface in **print millimeters**.
   * Layer geometries (buildings / roads / water / …) sit on top of the
   * plinth at `topZ + layerHeightOffsetMm`.
   */
  topZ: number;
}

/**
 * Builds the watertight plinth.
 */
export async function buildWatertightPlinth(
  options: BuildPlinthOptions,
): Promise<PlinthResult> {
  const done = time(log, 'buildWatertightPlinth');
  const ns = await getManifold();
  const { Manifold: ManifoldCtor, CrossSection } = ns;

  // Cross-section verts directly in print millimeters.
  const verts = shapeVerticesMm(
    options.shape,
    options.sizeKm,
    options.rotationDeg,
  );
  const cs = new CrossSection([verts.map(([x, y]) => [x, y] as [number, number])]);

  const exaggeration = options.exaggeration ?? 1;
  const meanElev = (options.grid.min + options.grid.max) / 2;
  // Convert the post-exaggeration elevation range from real meters to
  // print mm. A 300 m elevation range with 1.5× exag → 45 mm of Z headroom.
  const topOffsetMm =
    Math.max(0, (options.grid.max - meanElev) * exaggeration) *
    PRINT_SCALE_MM_PER_M;

  // The plinth is a flat-topped prism. Bottom at `z = -baseThicknessMm`,
  // top at `z = topZ`. We give the plinth at least 1 mm of elevation
  // headroom above z=0 so it always reads as a solid base even when
  // the elevation range is zero.
  const topZ = Math.max(1, topOffsetMm);
  const totalHeightMm = options.baseThicknessMm + topZ;
  const solid = ManifoldCtor.extrude(cs, totalHeightMm);
  // Translate so the plinth bottom sits at z = -baseThicknessMm and the
  // top sits at z = topZ. Layers are positioned at `topZ + heightOffsetMm`
  // by the scene / export pipeline (lib/exporters/buildExportGeometry.ts).
  const placed = solid.translate([0, 0, -options.baseThicknessMm]);

  // Validation
  const numTri = placed.numTri();
  if (numTri === 0) {
    log.error('plinth has zero triangles');
    throw new Error('watertight plinth invalid (zero triangles)');
  }
  const bbox = placed.boundingBox();
  const dimsMm = {
    x: bbox.max[0] - bbox.min[0],
    y: bbox.max[1] - bbox.min[1],
    z: bbox.max[2] - bbox.min[2],
  };

  log.info('plinth ready', {
    numTri,
    dims: dimsMm,
    topZ,
  });

  const renderGeometry = toBufferGeometry(placed);
  done();
  return { renderGeometry, manifold: placed, dimsMm, triCount: numTri, topZ };
}
