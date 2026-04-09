/**
 * Assembles the **watertight** print-ready geometry from the plinth and every
 * layer the user has flagged `includeInExport`.
 *
 * This file used to do a naive `mergeBufferGeometries` buffer concat. That
 * produced a render-correct preview but a catastrophically non-manifold
 * STL that Bambu Studio / PrusaSlicer rejected with thousands of
 * non-manifold edges (building bottom faces overlapping the plinth top,
 * coincident walls between adjacent buildings, …). The only correct
 * assembly path is a boolean union through `manifold-3d` — which is the
 * entire reliability mandate (see `CLAUDE.md` Golden Rule 2).
 *
 * This function is now an async thin wrapper:
 *
 *   unionExportManifold(mesh, layers)       → Manifold (watertight)
 *   ↓ toBufferGeometry                       → BufferGeometry for STLExporter
 *
 * The returned geometry is safe to pass to `STLExporter`; every edge is
 * shared by exactly two triangles, every face normal points outward, and
 * the solid has zero self-intersections.
 *
 * @module lib/exporters/buildExportGeometry
 */

import type * as THREE from 'three';
import type { Layers, MeshState } from '@/types';
import { unionExportManifold } from '@/lib/manifold/unionExportManifold';
import { toBufferGeometry } from '@/lib/manifold/toBufferGeometry';
import { tagged } from '@/lib/log/logger';
import { tick } from '@/lib/schedule';

const log = tagged('export-geometry');

export interface BuildExportGeometryInput {
  mesh: MeshState;
  layers: Layers;
}

/**
 * Returns a single **watertight** BufferGeometry containing the plinth and
 * every `includeInExport` layer, boolean-unioned via `manifold-3d`.
 *
 * Returns `null` if there is no plinth to start from.
 */
export async function buildExportGeometry(
  input: BuildExportGeometryInput,
): Promise<THREE.BufferGeometry | null> {
  const unioned = await unionExportManifold(input);
  if (!unioned) {
    log.warn('no export manifold — nothing to export');
    return null;
  }
  // Let the browser repaint after the boolean union completes, before
  // `toBufferGeometry` copies the (potentially huge) result mesh into
  // fresh typed arrays for the STLExporter.
  await tick();
  return toBufferGeometry(unioned);
}
