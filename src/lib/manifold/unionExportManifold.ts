/**
 * Boolean-union the plinth with every `includeInExport` layer into one
 * watertight Manifold.
 *
 * This is the reliability backbone of the export path. The naive
 * alternative — `mergeBufferGeometries` — produces a buffer that LOOKS
 * right in R3F but is catastrophically non-manifold when opened in a
 * slicer: building bottom faces overlap the plinth top face, adjacent
 * building walls end up with duplicate coincident triangles, and every
 * edge in the merged mesh ends up shared by 3+ triangles. Bambu Studio
 * rejects this with "N non-manifold edges" errors.
 *
 * Instead, we delegate to `manifold-3d`'s boolean union (Golden Rule 2).
 * Each layer is converted to its own `Manifold`, translated up so it
 * sits on the plinth top, and unioned into the accumulator. The final
 * result is one watertight solid — no internal faces, no duplicate walls,
 * guaranteed manifold by construction.
 *
 * @module lib/manifold/unionExportManifold
 */

import type { Manifold } from 'manifold-3d';
import type { LayerKey, Layers, MeshState } from '@/types';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import { tick } from '@/lib/schedule';
import { fromBufferGeometry } from './fromBufferGeometry';
import { getManifold } from './loader';

const log = tagged('export-manifold');

export interface UnionExportInput {
  mesh: MeshState;
  layers: Layers;
}

/**
 * Returns the boolean union of the plinth + every included layer as a
 * single Manifold, or `null` if there is no plinth to start from.
 *
 * The plinth manifold is mutated-by-union in accumulator style: each
 * layer is `union`-ed into it. Failing layers are logged and skipped so
 * one broken OSM footprint can't take down the whole export.
 */
export async function unionExportManifold(
  input: UnionExportInput,
): Promise<Manifold | null> {
  const { mesh, layers } = input;
  const plinth = mesh.plinthManifold as Manifold | undefined;
  if (!plinth) {
    log.warn('no plinth manifold — export aborted');
    return null;
  }

  const done = time(log, 'unionExportManifold');
  const ns = await getManifold();
  const topZ = mesh.plinthTopZ ?? 0;

  // Order matters only for log clarity; the union is commutative.
  const layerOrder: LayerKey[] = [
    'buildings',
    'roads',
    'water',
    'grass',
    'sand',
    'piers',
    'gpxPath',
  ];

  // Collect one Manifold per included, convertible layer.
  const layerManifolds: Manifold[] = [];
  let added = 0;
  let skipped = 0;

  for (const key of layerOrder) {
    const cfg = layers[key];
    if (!cfg?.includeInExport) continue;
    const geom = mesh.layerGeometries[key];
    if (!geom) continue;

    try {
      const m = await fromBufferGeometry(geom);
      // Layer geometry is authored in "z=0 = plinth top" local coordinates;
      // lift it by topZ so it sits on the absolute plinth surface.
      const lifted = topZ !== 0 ? m.translate([0, 0, topZ]) : m;
      if (lifted.numTri() === 0) {
        log.warn('layer manifold has zero triangles, skipping', { key });
        skipped++;
        continue;
      }
      layerManifolds.push(lifted);
      added++;
      // Let the browser breathe between layer conversions — each
      // `fromBufferGeometry` call is a WASM `mesh.merge()` + Manifold
      // construction that blocks the main thread for tens of ms on a
      // dense OSM selection.
      await tick();
    } catch (err) {
      log.error('layer → manifold conversion failed, skipping layer', {
        key,
        err: err instanceof Error ? err.message : String(err),
      });
      skipped++;
    }
  }

  // Fast path: no layers to union in.
  if (layerManifolds.length === 0) {
    log.info('export manifold ready (plinth only)', {
      numTri: plinth.numTri(),
    });
    done();
    return plinth;
  }

  // Yield once more right before the batch union. The union itself is
  // a single synchronous WASM call that can block for a few seconds on
  // a 2 km Mumbai-sized selection; this yield gives React a chance to
  // paint the "Exporting…" state before the main thread disappears
  // into the native boolean.
  await tick();
  // Batch union is faster than chained `a.add(b)` because manifold-3d
  // can build the kd-tree once across all inputs.
  const result = ns.Manifold.union([plinth, ...layerManifolds]);
  const numTri = result.numTri();
  if (numTri === 0) {
    log.error('unioned export manifold has zero triangles');
    done();
    return null;
  }
  log.info('export manifold ready', {
    added,
    skipped,
    numTri,
  });
  done();
  return result;
}
