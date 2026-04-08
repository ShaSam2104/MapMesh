/**
 * Assembles the print-ready geometry from the plinth + every layer the user
 * has flagged `includeInExport`.
 *
 * Layer geometries are authored in "z = 0 = terrain top" local coordinates;
 * here we translate each one upward by `plinthTopZ` so it actually sits on
 * top of the plinth, then merge everything into a single BufferGeometry
 * with `three-stdlib`'s `mergeBufferGeometries`.
 *
 * The merge is a *visual* merge — it is not a manifold boolean union, so
 * the resulting STL is not guaranteed watertight at the seams between
 * layers. The plinth itself remains watertight by construction. Watertight
 * boolean union of buildings into the plinth is tracked as a follow-up
 * (see `docs/ROADMAP.md`).
 *
 * @module lib/exporters/buildExportGeometry
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { LayerKey, Layers, MeshState } from '@/types';
import { tagged } from '@/lib/log/logger';

const log = tagged('export-merge');

export interface BuildExportGeometryInput {
  mesh: MeshState;
  layers: Layers;
}

/**
 * Returns a single BufferGeometry containing the plinth and every visible
 * "include in export" layer, lifted to sit on top of the plinth.
 *
 * Returns `null` if there is no plinth geometry.
 */
export function buildExportGeometry(
  input: BuildExportGeometryInput,
): THREE.BufferGeometry | null {
  const { mesh, layers } = input;
  if (!mesh.plinthGeometry) {
    log.warn('no plinth geometry — nothing to export');
    return null;
  }
  const topZ = mesh.plinthTopZ ?? 0;

  const parts: THREE.BufferGeometry[] = [];
  // Plinth first — already in absolute world z (top at `topZ`).
  parts.push(normalize(mesh.plinthGeometry));

  let included = 0;
  for (const key of Object.keys(layers) as LayerKey[]) {
    if (key === 'base') continue; // base = plinth, already added
    const cfg = layers[key];
    if (!cfg.includeInExport) continue;
    const geom = mesh.layerGeometries[key];
    if (!geom) continue;
    // Layer geometries are in local "z=0 = plinth top" — lift to absolute.
    const lifted = normalize(geom).clone();
    lifted.translate(0, 0, topZ);
    parts.push(lifted);
    included++;
  }

  log.info('export merge', {
    layers: included,
    total: parts.length,
    topZ,
  });

  // mergeBufferGeometries requires every input to have the same attribute
  // set. Some builders return non-indexed geometries; some indexed. We
  // strip indices uniformly via `toNonIndexed` inside `normalize`.
  const merged = mergeBufferGeometries(parts, false);
  // Don't dispose `mesh.plinthGeometry` or its layer counterparts — they
  // are owned by the store and still rendered in the scene. Only dispose
  // the *translated clones* we created above.
  for (let i = 1; i < parts.length; i++) parts[i].dispose();
  return merged ?? null;
}

/**
 * Returns a non-indexed copy of the geometry with only the `position`
 * attribute. mergeBufferGeometries is picky about attribute homogeneity;
 * different builders ship different attribute sets (some include `normal`,
 * some `uv`), and a single mismatch silently returns `null`.
 */
function normalize(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo.clone();
  // Drop everything except position so heterogeneous inputs merge cleanly.
  const positionAttr = flat.getAttribute('position');
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', positionAttr);
  return out;
}
