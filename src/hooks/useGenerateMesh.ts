/**
 * `useGenerateMesh` — orchestrates the full pipeline.
 *
 *   Selection →
 *     (Terrarium fetch ∥ Overpass fetch) →
 *       per-layer geometry builds →
 *         manifold-3d watertight plinth →
 *           commit to store
 *
 * Side-effectful work lives in `src/lib/`; this hook only wires them to the
 * store and transitions `mesh.status`.
 */

import { useCallback } from 'react';
import { useStore } from '@/state/store';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import { squareLngLatBbox } from '@/lib/geo/bbox';
import { shapeAsGeoJson } from '@/lib/geo/shapes';
import { fetchElevationGrid } from '@/lib/data/terrarium';
import { fetchOverpass } from '@/lib/data/overpass';
import { classifyFeatures, clipPolygonsToShape } from '@/lib/data/osmFeatures';
import { buildBuildings } from '@/lib/geometry/buildings';
import { buildAreaSlab } from '@/lib/geometry/areaSlab';
import { buildLineStrip } from '@/lib/geometry/lineStrip';
import { buildGpxTube } from '@/lib/geometry/gpxTube';
import { buildWatertightPlinth } from '@/lib/manifold/buildWatertightPlinth';
import type * as THREE from 'three';
import type { LayerKey } from '@/types';

const log = tagged('pipeline');

export function useGenerateMesh(): () => Promise<void> {
  return useCallback(async () => {
    const state = useStore.getState();
    const { selection, gpx, layers } = state;
    const { setMeshStatus, setMeshResult } = state;

    const done = time(log, 'generate');
    log.info('generate start', {
      center: selection.center,
      shape: selection.shape,
      sizeKm: selection.sizeKm,
    });

    try {
      setMeshStatus('fetching');

      const bbox = squareLngLatBbox(selection.center, selection.sizeKm);
      const shapePoly = shapeAsGeoJson(
        selection.shape,
        selection.center,
        selection.sizeKm,
        selection.rotationDeg,
      );

      // Parallel fetch: elevation + OSM
      const [grid, osmFc] = await Promise.all([
        fetchElevationGrid(bbox),
        fetchOverpass(bbox),
      ]);

      setMeshStatus('building');

      const classified = classifyFeatures(osmFc);

      // Per-layer geometry builds
      const origin = selection.center;
      const exaggeration = selection.exaggeration;
      const layerGeometries: Partial<Record<LayerKey, THREE.BufferGeometry | null>> = {};

      // Buildings: clip polygon footprints to shape
      if (classified.buildings) {
        const clipped = clipPolygonsToShape(classified.buildings, shapePoly);
        layerGeometries.buildings = buildBuildings(clipped, {
          origin,
          exaggeration,
        });
      }

      // Roads: line strip + layer offset from store. We pass the selection
      // polygon as a clip shape so road segments are trimmed at the plinth
      // edge instead of dangling out into open space.
      if (classified.roads) {
        layerGeometries.roads = buildLineStrip(classified.roads, {
          origin,
          widthMeters: 4,
          heightOffset: layers.roads.heightOffsetMm,
          clipShape: shapePoly,
        });
      }

      // Water
      if (classified.water) {
        const clipped = clipPolygonsToShape(classified.water, shapePoly);
        layerGeometries.water = buildAreaSlab(clipped, {
          origin,
          heightOffset: layers.water.heightOffsetMm,
        });
      }

      // Grass
      if (classified.grass) {
        const clipped = clipPolygonsToShape(classified.grass, shapePoly);
        layerGeometries.grass = buildAreaSlab(clipped, {
          origin,
          heightOffset: layers.grass.heightOffsetMm,
        });
      }

      // Sand
      if (classified.sand) {
        const clipped = clipPolygonsToShape(classified.sand, shapePoly);
        layerGeometries.sand = buildAreaSlab(clipped, {
          origin,
          heightOffset: layers.sand.heightOffsetMm,
        });
      }

      // Piers
      if (classified.piers) {
        layerGeometries.piers = buildLineStrip(classified.piers, {
          origin,
          widthMeters: 3,
          thickness: 0.8,
          heightOffset: layers.piers.heightOffsetMm,
          clipShape: shapePoly,
        });
      }

      // GPX tube (optional)
      if (gpx) {
        layerGeometries.gpxPath = buildGpxTube(gpx.geojson, {
          origin,
          grid,
          exaggeration,
          heightAboveTerrain: layers.gpxPath.heightOffsetMm,
        });
      }

      // Watertight plinth (reliability backbone)
      const plinth = await buildWatertightPlinth({
        shape: selection.shape,
        sizeKm: selection.sizeKm,
        rotationDeg: selection.rotationDeg,
        baseThicknessMm: selection.baseThicknessMm,
        exaggeration,
        grid,
      });

      const nonNullLayerGeoms: Partial<Record<LayerKey, THREE.BufferGeometry>> =
        Object.fromEntries(
          Object.entries(layerGeometries).filter(([, v]) => v != null),
        ) as Partial<Record<LayerKey, THREE.BufferGeometry>>;

      setMeshResult({
        status: 'ready',
        plinthGeometry: plinth.renderGeometry,
        plinthManifold: plinth.manifold,
        // The plinth IS the base layer — rendered via `plinthGeometry` and
        // colored with `layers.base.color` in TerrainMesh. We don't attach
        // a separate rectangular terrain plane here because it would bleed
        // beyond the selection shape (hex / circle) and look like a rogue
        // slab hanging around the plinth.
        layerGeometries: nonNullLayerGeoms,
        plinthTopZ: plinth.topZ,
        dimsMm: plinth.dimsMm,
        triCount: plinth.triCount,
        error: undefined,
      });
      log.info('generate done', { triCount: plinth.triCount });
    } catch (err) {
      log.error('generate failed', err);
      setMeshStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      done();
    }
  }, []);
}
