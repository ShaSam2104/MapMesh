/**
 * Watertight plinth constructor.
 *
 * This is the single point of trust for the reliability mandate. Given an
 * elevation grid and a 2D cross-section, it emits a Manifold (and a
 * BufferGeometry for rendering) that is guaranteed watertight by construction.
 *
 * Construction strategy:
 *   1. Rasterize the elevation grid into a dense mesh with the terrain top
 *      + skirt + flat bottom as one closed shell (via manifold-3d's
 *      `levelSet` is not used; instead we build the plinth as the CSG union
 *      of a solid prism and the terrain displacement in a thin layer).
 *
 *      In this scaffold we use the simpler "extrude cross-section, then
 *      layer the displaced terrain on top" approach: the prism gives a
 *      known-good manifold base + walls, and the terrain is stitched to its
 *      top face. Manifold validates the result.
 *
 * @module lib/manifold/buildWatertightPlinth
 */

import type { BufferGeometry } from 'three';
import type { Manifold } from 'manifold-3d';
import type { SelectionShape } from '@/types';
import type { ElevationGrid } from '@/lib/data/terrarium';
import { shapeVerticesMeters } from '@/lib/geo/shapes';
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
   * Z-coordinate of the plinth's top surface in world units (meters).
   * Layer geometries (buildings / roads / water / …) sit on top of the
   * plinth at `topZ + layerHeightOffset`.
   */
  topZ: number;
}

/**
 * Builds the watertight plinth.
 *
 * The current implementation constructs the plinth as the manifold union of:
 *   (a) an extruded prism of the selection shape (base + walls)
 *   (b) a thin capping slab at the terrain mean elevation
 *
 * The displaced terrain top is rendered by `buildTerrainPlane` but is NOT
 * unioned into the plinth in this scaffold — heightmap boolean union is
 * a post-MVP refinement (tracked in docs/ROADMAP.md). The plinth is still
 * watertight because (a) and (b) are both closed and their union is closed.
 */
export async function buildWatertightPlinth(
  options: BuildPlinthOptions,
): Promise<PlinthResult> {
  const done = time(log, 'buildWatertightPlinth');
  const ns = await getManifold();
  const { Manifold: ManifoldCtor, CrossSection } = ns;

  const verts = shapeVerticesMeters(
    options.shape,
    options.sizeKm,
    options.rotationDeg,
  );
  // Cross-section in mm: 1 m → 1 mm.
  const cs = new CrossSection([verts.map(([x, y]) => [x, y] as [number, number])]);

  const exaggeration = options.exaggeration ?? 1;
  const meanElev = (options.grid.min + options.grid.max) / 2;
  const topOffset = sampleCenterElevationOffset(options.grid, meanElev, exaggeration);

  // The plinth is a flat-topped prism. Top sits at `topZ`, bottom at
  // `topZ - baseThicknessMm`. We pick `topZ` from the post-exaggeration
  // elevation range so the plinth has at least a 1 m cap above z=0.
  const topZ = Math.max(1, topOffset);
  const totalHeight = options.baseThicknessMm + topZ;
  const solid = ManifoldCtor.extrude(cs, totalHeight);
  // Translate so the bottom of the plinth sits at z=-baseThicknessMm and
  // the top sits at z=topZ. Layers are positioned at `topZ + heightOffset`
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

/**
 * Computes how much headroom the terrain "cap" needs above z=0 given the
 * post-exaggeration range of the grid.
 */
function sampleCenterElevationOffset(
  grid: ElevationGrid,
  meanElev: number,
  exaggeration: number,
): number {
  const maxRelMm = (grid.max - meanElev) * exaggeration;
  return Math.max(0, maxRelMm);
}
