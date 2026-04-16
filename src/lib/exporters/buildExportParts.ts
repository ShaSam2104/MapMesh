/**
 * Builds the per-layer parts for a colored 3MF export.
 *
 * Unlike STL (monolithic, one merged watertight solid via
 * `buildExportGeometry`), 3MF can carry multiple `<object>` entries
 * each with its own filament/colour. That lets us preserve layer
 * colours all the way to the slicer — the user sees Base / Buildings /
 * Roads / Water / … as separate coloured bodies in Bambu Studio,
 * PrusaSlicer, OrcaSlicer.
 *
 * **Hot path note.** An earlier version of this file routed every layer
 * through `fromBufferGeometry → mesh.merge() → Manifold → translate →
 * toBufferGeometry` "for safety". That cost several seconds per export
 * on a dense OSM selection and was the main reason clicking Export
 * froze the page. The round-trip is not necessary, because:
 *
 *   - Each layer BufferGeometry is already a collection of
 *     `ExtrudeGeometry` prisms, which are individually closed
 *     polyhedra. Each prism contributes a complete shell.
 *   - `three-3mf-exporter` builds its own per-mesh `vertexMap` keyed
 *     by `${x},${y},${z}` and dedupes coincident vertices at write
 *     time, so prism walls collapse to shared indices inside the
 *     emitted 3MF object on its own.
 *   - Writing the 3MF does not need the layer itself to be one
 *     topologically-merged solid — each object is inspected
 *     independently by the slicer, and a collection of closed prisms
 *     is a valid 3MF object.
 *
 * The plinth is still lifted straight from its existing Manifold
 * (built once during Generate) via a single `toBufferGeometry` call —
 * that is a simple `getMesh()` reshape, not a boolean.
 *
 * @module lib/exporters/buildExportParts
 */

import type * as THREE from 'three';
import type { Manifold } from 'manifold-3d';
import {
  LAYER_ORDER,
  type LayerKey,
  type Layers,
  type MeshState,
  type TextLabel,
} from '@/types';
import { LAYER_LABEL } from '@/lib/palette';
import { toBufferGeometry } from '@/lib/manifold/toBufferGeometry';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import { tick } from '@/lib/schedule';

const log = tagged('export-parts');

/**
 * One coloured piece of the printed model. The 3MF exporter emits one
 * `<object>` per part and Bambu Studio picks up the colour via its
 * per-filament project settings.
 */
export interface ExportPart {
  /**
   * Stable key. For layer parts this is the `LayerKey` (or `'base'`
   * for the plinth). Text label parts carry a synthetic key in the
   * form `text:<labelId>` so the 3MF object tree stays stable across
   * rebuilds without colliding with any future layer key.
   */
  key: LayerKey | `text:${string}`;
  /** Human-readable label shown in the slicer's object tree. */
  name: string;
  /** Hex colour `#RRGGBB` — exactly what the Style tab shows. */
  colorHex: string;
  /** BufferGeometry in **print millimeters**, freshly allocated, caller-owned. */
  geometry: THREE.BufferGeometry;
}

export interface BuildExportPartsInput {
  mesh: MeshState;
  layers: Layers;
  /**
   * Full text-label list so we can look up per-label colours + names
   * when building text parts. Parts whose label is missing from this
   * list (deleted mid-export) are silently skipped.
   */
  textLabels?: readonly TextLabel[];
}

/**
 * Returns the list of coloured parts for a 3MF export, or an empty
 * array if there is no plinth to start from.
 *
 * The returned geometries are freshly allocated BufferGeometries owned
 * by the caller — they must be `.dispose()`d after the export Blob has
 * been built. Ownership of `mesh.plinthGeometry` and
 * `mesh.layerGeometries` remains with the zustand store; we never
 * mutate them (every layer is `.clone()`d before translation).
 */
export async function buildExportParts(
  input: BuildExportPartsInput,
): Promise<ExportPart[]> {
  const { mesh, layers } = input;
  const plinth = mesh.plinthManifold as Manifold | undefined;
  if (!plinth) {
    log.warn('no plinth manifold — export parts skipped');
    return [];
  }

  const done = time(log, 'buildExportParts');
  const topZ = mesh.plinthTopZ ?? 0;
  const parts: ExportPart[] = [];

  // 1. Base = the plinth, emitted straight from its existing Manifold
  //    via a single `getMesh()` reshape (no boolean work).
  if (layers.base.includeInExport) {
    parts.push({
      key: 'base',
      name: LAYER_LABEL.base,
      colorHex: layers.base.color,
      geometry: toBufferGeometry(plinth),
    });
    await tick();
  }

  // 2. Every included non-base layer — cheap clone + Z-translate.
  let added = 0;
  for (const key of LAYER_ORDER) {
    if (key === 'base') continue;
    const cfg = layers[key];
    if (!cfg?.includeInExport) continue;
    const source = mesh.layerGeometries[key];
    if (!source) continue;

    const geometry = source.clone();
    if (topZ !== 0) geometry.translate(0, 0, topZ);
    parts.push({
      key,
      name: LAYER_LABEL[key],
      colorHex: cfg.color,
      geometry,
    });
    added++;
    await tick();
  }

  // 3. Text labels — one coloured part per label. Text geometries are
  //    already in absolute mm world coordinates (placed on the flange
  //    outer face) so no translate is needed.
  const textLabels = input.textLabels ?? [];
  let textAdded = 0;
  for (const label of textLabels) {
    const source = mesh.textLabelGeometries?.[label.id];
    if (!source) continue;
    const geometry = source.clone();
    parts.push({
      key: `text:${label.id}`,
      name: `Text: ${label.content}`,
      colorHex: label.color,
      geometry,
    });
    textAdded++;
    await tick();
  }

  log.info('export parts ready', {
    count: parts.length,
    layersAdded: added,
    textAdded,
    topZ,
  });
  done();
  return parts;
}
