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
import type { FlangeSpec } from '@/lib/geometry/flangeSpecs';
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
  /**
   * Optional flange tabs to union into the plinth cross-section before
   * extrusion. Each tab is a CCW polygon in **absolute mm world
   * coordinates** (post rotation) produced by `computeFlangeSpecs`. The
   * union happens in 2D via manifold-3d's `CrossSection.union`, so the
   * final extruded prism remains a single watertight solid regardless of
   * how many flanges are present.
   */
  flanges?: FlangeSpec[];
}

/**
 * Returns the plinth's top Z coordinate in **print mm** given the raw
 * elevation grid and vertical exaggeration. Exposed so the
 * auto-rebuild path can compute flange outer-face Z centers without
 * building the plinth first.
 *
 * Must stay in lock-step with the same calculation in
 * `buildWatertightPlinth` below — there is one test that asserts this.
 */
export function computePlinthTopZ(
  grid: { min: number; max: number },
  exaggeration = 1,
): number {
  const meanElev = (grid.min + grid.max) / 2;
  const topOffsetMm =
    Math.max(0, (grid.max - meanElev) * exaggeration) * PRINT_SCALE_MM_PER_M;
  return Math.max(1, topOffsetMm);
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
  let cs = new CrossSection([verts.map(([x, y]) => [x, y] as [number, number])]);

  // Union any flange tabs into the cross-section BEFORE extrusion so the
  // final prism is a single watertight solid (no multiple disconnected
  // shells). Each flange tab is already in absolute mm world coordinates
  // (post rotation) — `computeFlangeSpecs` handles that transform.
  const flanges = options.flanges ?? [];
  if (flanges.length > 0) {
    const tabSections = flanges.map(
      (f) =>
        new CrossSection([
          f.rectVerts.map(([x, y]) => [x, y] as [number, number]),
        ]),
    );
    cs = CrossSection.union([cs, ...tabSections]);
    log.debug('unioned flange tabs', { count: flanges.length });
  }

  const exaggeration = options.exaggeration ?? 1;
  // The plinth is a flat-topped prism. Bottom at `z = -baseThicknessMm`,
  // top at `z = topZ`. `computePlinthTopZ` handles the elevation→mm
  // conversion and guarantees at least 1 mm of headroom above z=0 so
  // the plinth always reads as a solid base even when the elevation
  // range is zero.
  const topZ = computePlinthTopZ(options.grid, exaggeration);
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
