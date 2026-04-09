/**
 * 3MF exporter — **multi-object, coloured, watertight per object**.
 *
 * This file delegates the entire 3MF payload (model XML, per-object vertex
 * table with deduplication, build transforms, Content_Types, _rels, Bambu
 * project settings) to `three-3mf-exporter`. The MeshMap code only wraps
 * our watertight `ExportPart`s into named `THREE.Mesh` children of a
 * `THREE.Group` and hands the group to the library — **no custom XML,
 * no hand-rolled ZIP, no hand-rolled vertex/triangle math**
 * (Golden Rule 1: every format conversion delegated to a library).
 *
 * Why `three-3mf-exporter` and not `@jscad/3mf-serializer`:
 *
 *   The JSCAD serializer writes each polygon's vertices as fresh
 *   `<vertex>` entries with no deduplication across polygons. Since we
 *   feed it one polygon per triangle (that's the only shape
 *   `geom3.fromPoints` accepts), every triangle ends up with three
 *   unique vertex indices and zero shared edges — Bambu Studio's
 *   manifold validator then flags **every single edge** as non-manifold
 *   (3 × triangleCount = exact error count).
 *
 *   `three-3mf-exporter` builds a `vertexMap` keyed by `${x},${y},${z}`
 *   inside `processMesh`, so coincident vertices collapse to one index
 *   and triangles share edges — the mesh is watertight by construction
 *   on Bambu's side.
 *
 * Multi-colour approach:
 *
 *   Each `ExportPart` becomes a `THREE.Mesh` with a
 *   `MeshStandardMaterial` carrying the layer's hex colour. The
 *   exporter reads `mesh.material.color`, builds a unique filament per
 *   colour in `Metadata/project_settings.config`, and assigns each
 *   object a `<metadata key="extruder" value="N"/>` in
 *   `Metadata/model_settings.config`. Bambu Studio then shows every
 *   layer in its own filament colour in the object tree and the
 *   preview pane.
 *
 * @module lib/exporters/export3MF
 */

import * as THREE from 'three';
import { exportTo3MF } from 'three-3mf-exporter';
import { tagged } from '@/lib/log/logger';
import type { ExportPart } from './buildExportParts';

const log = tagged('export-3mf');

/**
 * Serializes an array of watertight parts to a Bambu-Studio-compatible
 * 3MF blob with per-part colours via the Bambu filament/extruder slot
 * mechanism. Units are millimeters (MeshMap print-scale convention,
 * Golden Rule 6).
 *
 * Throws if `parts` is empty — callers should check upstream.
 */
export async function export3MF(parts: ExportPart[]): Promise<Blob> {
  if (parts.length === 0) {
    throw new Error('export3MF: no parts to export');
  }

  // Wrap each watertight part in a named Mesh with a coloured material.
  // `three-3mf-exporter` reads `mesh.name` for the slicer object tree
  // and `mesh.material.color` for the per-filament colour palette.
  const group = new THREE.Group();
  group.name = 'MeshMap';

  const tempMaterials: THREE.Material[] = [];
  for (const p of parts) {
    const mat = new THREE.MeshStandardMaterial();
    mat.color.set(p.colorHex);
    tempMaterials.push(mat);
    const mesh = new THREE.Mesh(p.geometry, mat);
    mesh.name = p.name;
    group.add(mesh);
  }

  try {
    const blob = await exportTo3MF(group, {
      metadata: {
        Application: 'MeshMap',
        ApplicationTitle: 'MeshMap city mesh',
      },
    });
    log.info('3MF ready', {
      bytes: blob.size,
      parts: parts.length,
    });
    return blob;
  } finally {
    for (const m of tempMaterials) m.dispose();
  }
}
