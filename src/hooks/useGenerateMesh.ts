/**
 * `useGenerateMesh` — orchestrates the full pipeline.
 *
 * The hook is split into two phases so the UI can debounce parameter
 * slider edits without re-fetching the (slow) OSM + Terrarium data:
 *
 *   Phase 1 — `ensureRawData(selection, gpx, force)`:
 *     Returns the cached raw fetched data for the current fetch
 *     fingerprint, fetching Overpass + Terrarium only on cache miss
 *     (or when `force` is true).
 *
 *   Phase 2 — `rebuildFromRaw(raw, selection, layers, gpx, textLabels)`:
 *     Pure-ish. Runs classify → clip → build layers → plinth → text →
 *     commit. Safe to call on every parameter edit.
 *
 * `generate()` (the Generate button) runs both phases in sequence.
 * `rebuild()` (the auto-rebuild hook) runs only phase 2 when a cache
 * is present.
 *
 * ## Performance — caches + concurrency guard
 *
 * The rebuild path is on the hot slider-drag loop, so several layers
 * of module-level caches keep repeated rebuilds near-instant:
 *
 *  - **Text geometry cache** lives inside `buildTextGeometry.ts`
 *    (per-font LRU of built glyph meshes).
 *  - **Per-layer geometry cache** here, keyed on the classified
 *    features identity + per-layer parameter fingerprint. If the
 *    buildings/roads/etc. inputs haven't changed, the cached
 *    `BufferGeometry` is reused verbatim.
 *  - **Plinth cache** keyed on the elevation grid identity + plinth
 *    parameter fingerprint. The manifold-3d WASM call is skipped on
 *    a hit.
 *  - **Rebuild epoch guard**: every rebuild captures an incrementing
 *    epoch number; when it finishes, it only commits to the store if
 *    its epoch is still the latest. Stale rebuilds from rapid slider
 *    drags are dropped so the UI never sees a result from an
 *    overtaken-in-flight rebuild.
 *
 * Side-effectful work lives in `src/lib/`; this hook only wires them
 * to the store and transitions `mesh.status`.
 */

import { useCallback } from 'react';
import type { BufferGeometry } from 'three';
import type { Feature, LineString } from 'geojson';
import { useStore, rawCacheFingerprint } from '@/state/store';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import { squareLngLatBbox } from '@/lib/geo/bbox';
import { shapeAsGeoJson } from '@/lib/geo/shapes';
import { fetchElevationGrid, type ElevationGrid } from '@/lib/data/terrarium';
import { fetchOverpass } from '@/lib/data/overpass';
import {
  classifyFeatures,
  clipPolygonsToShape,
  type ClassifiedFeatures,
} from '@/lib/data/osmFeatures';
import { buildBuildings } from '@/lib/geometry/buildings';
import { buildAreaSlab } from '@/lib/geometry/areaSlab';
import { buildLineStrip } from '@/lib/geometry/lineStrip';
import { buildGpxTube } from '@/lib/geometry/gpxTube';
import {
  buildWatertightPlinth,
  computePlinthTopZ,
  type PlinthResult,
} from '@/lib/manifold/buildWatertightPlinth';
import {
  computeFlangeSpecs,
  type FlangeSpec,
} from '@/lib/geometry/flangeSpecs';
import { buildTextGeometry } from '@/lib/geometry/buildTextGeometry';
import { placeTextOnFlange } from '@/lib/geometry/placeTextOnFlange';
import { fetchFontBuffer } from '@/lib/fonts/googleFonts.browser';
import type {
  GpxData,
  LayerKey,
  Layers,
  RawCache,
  Selection,
  TextLabel,
} from '@/types';

const log = tagged('pipeline');

/**
 * Live raw-cache payload. The store's `RawCache` uses `unknown` for
 * these to keep `src/types.ts` free of data-layer imports; here we
 * re-type them for internal use by the pipeline.
 */
export interface LiveRawCache {
  fingerprint: string;
  grid: ElevationGrid;
  classified: ClassifiedFeatures;
  gpxGeojson: Feature<LineString> | null;
}

function toLiveCache(cache: RawCache): LiveRawCache {
  return {
    fingerprint: cache.fingerprint,
    grid: cache.grid as ElevationGrid,
    classified: cache.classified as ClassifiedFeatures,
    gpxGeojson: cache.gpxGeojson as Feature<LineString> | null,
  };
}

// ---------------------------------------------------------------------
// Concurrency guard
// ---------------------------------------------------------------------

/**
 * Monotonic counter incremented at the start of every `rebuildFromRaw`
 * invocation. Each rebuild captures its value locally and only commits
 * results to the store if the module-level counter has not advanced
 * past it. This drops stale rebuilds from rapid slider drags without
 * needing an AbortController threaded through every async call.
 */
let rebuildEpoch = 0;

// ---------------------------------------------------------------------
// Layer + plinth caches
// ---------------------------------------------------------------------

/**
 * Small fixed-size LRU map. `Map` already preserves insertion order,
 * so we delete + re-insert on `get` to move an entry to the newest
 * position, and on overflow pop the oldest via `keys().next()`.
 */
class LruCache<V> {
  private map = new Map<string, V>();
  constructor(private readonly limit: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

/** Per-layer geometry caches. Keyed by `${classifiedId}|${param-fp}`. */
const layerCaches: Record<LayerKey, LruCache<BufferGeometry | null>> = {
  base: new LruCache(1), // unused; base is the plinth
  buildings: new LruCache(8),
  roads: new LruCache(8),
  water: new LruCache(8),
  grass: new LruCache(8),
  sand: new LruCache(8),
  piers: new LruCache(8),
  gpxPath: new LruCache(8),
};

/** Plinth cache. Keyed by `${gridId}|${plinth-fp}|${flanges-fp}`. */
const plinthCache = new LruCache<PlinthResult>(8);

/**
 * Stable numeric id per object reference. Lets us include a reference
 * in a string cache key without holding a strong reference of our own.
 */
const identityIds = new WeakMap<object, number>();
let nextIdentityId = 1;
function identityId(obj: object): number {
  let id = identityIds.get(obj);
  if (id !== undefined) return id;
  id = nextIdentityId++;
  identityIds.set(obj, id);
  return id;
}

function memoLayer(
  key: LayerKey,
  cacheKey: string,
  build: () => BufferGeometry | null,
): BufferGeometry | null {
  const cache = layerCaches[key];
  const hit = cache.get(cacheKey);
  if (hit !== undefined) {
    log.debug('layer cache hit', { key });
    return hit;
  }
  const geom = build();
  cache.set(cacheKey, geom);
  return geom;
}

/** Fingerprint a flange array for the plinth cache key. */
function flangesFingerprint(flanges: readonly FlangeSpec[]): string {
  if (flanges.length === 0) return 'none';
  return flanges
    .map((f) => `${f.side}:${f.depthMm.toFixed(3)}:${f.widthMm.toFixed(3)}`)
    .join(',');
}

/**
 * Returns the cached raw data for the current fetch fingerprint,
 * fetching Overpass + Terrarium on cache miss.
 */
export async function ensureRawData(
  selection: Selection,
  gpx: GpxData | null,
  force: boolean,
): Promise<LiveRawCache> {
  const fp = rawCacheFingerprint(selection);
  const state = useStore.getState();
  const cached = state.mesh.rawCache;
  if (!force && cached && cached.fingerprint === fp) {
    log.debug('raw cache hit', { fp });
    return toLiveCache(cached);
  }

  const done = time(log, 'data:fetch');
  log.info('data:fetch start', { fp, force });
  try {
    const bbox = squareLngLatBbox(selection.center, selection.sizeKm);
    // Kick off both network fetches in parallel but update the
    // progress phase for whichever phase is actually visible to the
    // user at any given moment. These calls can take 20–30s each over
    // a slow link; without per-phase messages users see "BUILDING"
    // and assume the app has hung.
    state.setMeshProgress('Fetching elevation tiles', 'Terrarium / AWS');
    const gridPromise = fetchElevationGrid(bbox);
    state.setMeshProgress('Fetching map features', 'Overpass / OSM');
    const osmPromise = fetchOverpass(bbox);
    const [grid, osmFc] = await Promise.all([gridPromise, osmPromise]);
    state.setMeshProgress('Classifying features');
    const classified = classifyFeatures(osmFc);
    const live: LiveRawCache = {
      fingerprint: fp,
      grid,
      classified,
      gpxGeojson: gpx?.geojson ?? null,
    };
    state.setRawCache({
      fingerprint: fp,
      grid,
      classified,
      gpxGeojson: gpx?.geojson ?? null,
      osm: osmFc,
    });
    return live;
  } finally {
    done();
  }
}

/**
 * Resolves the OTF buffers for every distinct (family, variant) used
 * by the provided labels. Failures are swallowed — the offending
 * labels simply get no geometry.
 *
 * When `onPhase` is provided, it's invoked before the first fetch and
 * again after each font resolves (or fails) so the UI can show a
 * live "3/5 fonts loaded" style counter instead of one opaque
 * "Fetching fonts" phase that looks like a hang.
 */
async function resolveFontBuffers(
  labels: readonly TextLabel[],
  onPhase?: (phase: string, detail: string) => void,
): Promise<Map<string, ArrayBuffer>> {
  const buffers = new Map<string, ArrayBuffer>();
  const distinct = new Map<string, { family: string; variant: string }>();
  for (const l of labels) {
    distinct.set(`${l.fontFamily}|${l.fontVariant}`, {
      family: l.fontFamily,
      variant: l.fontVariant,
    });
  }
  const total = distinct.size;
  let completed = 0;
  onPhase?.(
    'Fetching fonts',
    `0/${total} — ${[...distinct.values()].map((v) => v.family).join(', ')}`,
  );
  await Promise.all(
    [...distinct.entries()].map(async ([key, { family, variant }]) => {
      try {
        const buf = await fetchFontBuffer(family, variant);
        buffers.set(key, buf);
      } catch (err) {
        log.warn('font fetch failed, skipping labels', {
          family,
          variant,
          err: err instanceof Error ? err.message : String(err),
        });
      } finally {
        completed += 1;
        onPhase?.('Fetching fonts', `${completed}/${total} — ${family}`);
      }
    }),
  );
  return buffers;
}

/**
 * Rebuilds the full geometry scene from a cached raw-data payload.
 * Synchronous from the caller's standpoint except for the WASM plinth
 * build + async font fetches (both cached after first use).
 *
 * **Does not** touch `mesh.status`. Callers that want a loud
 * transition (initial generate) set 'building' explicitly; auto-
 * rebuilds leave the status at 'ready' so the scene does not flicker
 * during fast cached rebuilds. Errors always set 'error' if the
 * caller's rebuild is still the latest (epoch guard).
 */
export async function rebuildFromRaw(
  raw: LiveRawCache,
  selection: Selection,
  layers: Layers,
  gpx: GpxData | null,
  textLabels: readonly TextLabel[],
): Promise<void> {
  const myEpoch = ++rebuildEpoch;
  const state = useStore.getState();
  const done = time(log, 'geom:rebuild');
  log.info('geom:rebuild start', {
    epoch: myEpoch,
    labels: textLabels.length,
    gpx: !!gpx,
  });
  try {
    // Only surface "Building layers" for the initial rebuild or any
    // rebuild that's expected to actually do work. Silent fast paths
    // (pure cache hits) finish in a few ms and don't need to flash a
    // progress message at the user.
    const isLoudRebuild = state.mesh.status !== 'ready';
    if (isLoudRebuild) {
      state.setMeshProgress('Building map layers');
    }

    const shapePoly = shapeAsGeoJson(
      selection.shape,
      selection.center,
      selection.sizeKm,
      selection.rotationDeg,
    );
    const origin = selection.center;
    const exaggeration = selection.exaggeration;
    const classified = raw.classified;
    const classifiedId = identityId(classified as unknown as object);

    // Common param slugs. Anything that participates in cache keys for
    // multiple layers gets computed once up here so every cache key
    // stays short and consistent.
    const originFp = `${origin[0].toFixed(6)},${origin[1].toFixed(6)}`;
    const shapeFp = `${selection.shape}|${selection.sizeKm.toFixed(3)}|${selection.rotationDeg.toFixed(2)}`;

    const layerGeometries: Partial<Record<LayerKey, BufferGeometry | null>> = {};

    if (classified.buildings) {
      const heightScale = layers.buildings.heightScale ?? 1;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${exaggeration}|${heightScale}`;
      layerGeometries.buildings = memoLayer('buildings', key, () => {
        const clipped = clipPolygonsToShape(classified.buildings!, shapePoly);
        return buildBuildings(clipped, {
          origin,
          exaggeration,
          heightScale,
        });
      });
    }
    if (classified.roads) {
      const widthMeters = layers.roads.widthMeters ?? 6;
      const heightOffsetMm = layers.roads.heightOffsetMm;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${widthMeters}|${heightOffsetMm}`;
      layerGeometries.roads = memoLayer('roads', key, () =>
        buildLineStrip(classified.roads!, {
          origin,
          widthMeters,
          heightOffsetMm,
          clipShape: shapePoly,
        }),
      );
    }
    if (classified.water) {
      const heightOffsetMm = layers.water.heightOffsetMm;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${heightOffsetMm}`;
      layerGeometries.water = memoLayer('water', key, () => {
        const clipped = clipPolygonsToShape(classified.water!, shapePoly);
        return buildAreaSlab(clipped, { origin, heightOffsetMm });
      });
    }
    if (classified.grass) {
      const heightOffsetMm = layers.grass.heightOffsetMm;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${heightOffsetMm}`;
      layerGeometries.grass = memoLayer('grass', key, () => {
        const clipped = clipPolygonsToShape(classified.grass!, shapePoly);
        return buildAreaSlab(clipped, { origin, heightOffsetMm });
      });
    }
    if (classified.sand) {
      const heightOffsetMm = layers.sand.heightOffsetMm;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${heightOffsetMm}`;
      layerGeometries.sand = memoLayer('sand', key, () => {
        const clipped = clipPolygonsToShape(classified.sand!, shapePoly);
        return buildAreaSlab(clipped, { origin, heightOffsetMm });
      });
    }
    if (classified.piers) {
      const widthMeters = layers.piers.widthMeters ?? 4;
      const heightOffsetMm = layers.piers.heightOffsetMm;
      const key = `${classifiedId}|${originFp}|${shapeFp}|${widthMeters}|${heightOffsetMm}`;
      layerGeometries.piers = memoLayer('piers', key, () =>
        buildLineStrip(classified.piers!, {
          origin,
          widthMeters,
          heightOffsetMm,
          clipShape: shapePoly,
        }),
      );
    }
    // Live GPX takes precedence over the cached copy: if the user
    // uploads or removes a track after the last fetch, the rebuild
    // should reflect that immediately without re-fetching OSM.
    const gpxGeojson = gpx?.geojson ?? raw.gpxGeojson ?? null;
    if (gpxGeojson) {
      const gpxId = identityId(gpxGeojson as unknown as object);
      const widthMeters = layers.gpxPath.widthMeters ?? 3;
      const heightOffsetMm = layers.gpxPath.heightOffsetMm;
      const key = `${gpxId}|${originFp}|${shapeFp}|${widthMeters}|${heightOffsetMm}`;
      layerGeometries.gpxPath = memoLayer('gpxPath', key, () =>
        buildGpxTube(gpxGeojson, {
          origin,
          widthMeters,
          heightOffsetMm,
          clipShape: shapePoly,
        }),
      );
    }

    // Flanges + text preflight. We need topZ for flange face placement;
    // computePlinthTopZ matches the same formula the plinth builder uses.
    const topZ = computePlinthTopZ(raw.grid, exaggeration);
    const flanges = computeFlangeSpecs({
      shape: selection.shape,
      sizeKm: selection.sizeKm,
      rotationDeg: selection.rotationDeg,
      baseThicknessMm: selection.baseThicknessMm,
      topZ,
      labels: [...textLabels],
    });

    // Watertight plinth (reliability backbone) — with flanges unioned
    // into the cross-section before extrusion. Cached so slider drags
    // on colors/offsets/text position skip the WASM round-trip.
    const gridId = identityId(raw.grid as unknown as object);
    const plinthKey =
      `${gridId}|${shapeFp}|${selection.baseThicknessMm.toFixed(3)}|` +
      `${exaggeration}|${flangesFingerprint(flanges)}`;
    let plinth = plinthCache.get(plinthKey);
    if (!plinth) {
      if (isLoudRebuild) {
        state.setMeshProgress(
          'Building watertight plinth',
          'manifold-3d WASM',
        );
      }
      plinth = await buildWatertightPlinth({
        shape: selection.shape,
        sizeKm: selection.sizeKm,
        rotationDeg: selection.rotationDeg,
        baseThicknessMm: selection.baseThicknessMm,
        exaggeration,
        grid: raw.grid,
        flanges,
      });
      plinthCache.set(plinthKey, plinth);
    } else {
      log.debug('plinth cache hit');
    }

    // Bail if a newer rebuild started while our async work was in
    // flight. This is the biggest perf + correctness win for rapid
    // slider drags — without it, several rebuilds pile up and the
    // last-finishing one may not be the one that matches the latest
    // inputs.
    if (myEpoch !== rebuildEpoch) {
      log.debug('rebuild superseded before text stage', {
        epoch: myEpoch,
        current: rebuildEpoch,
      });
      return;
    }

    // Text geometries — one per label. `buildTextGeometry` is
    // internally cached per (font, content, letterHeightMm,
    // extrusionMm, curveSegments); a rebuild triggered by an offset
    // slider drag will reuse every glyph mesh and only pay the
    // placement transform cost.
    const textLabelGeometries: Record<string, BufferGeometry> = {};
    if (textLabels.length > 0) {
      const fontBuffers = await resolveFontBuffers(
        textLabels,
        isLoudRebuild
          ? (phase, detail) => state.setMeshProgress(phase, detail)
          : undefined,
      );
      if (isLoudRebuild) {
        state.setMeshProgress('Building text labels');
      }
      if (myEpoch !== rebuildEpoch) {
        log.debug('rebuild superseded after font resolve', {
          epoch: myEpoch,
          current: rebuildEpoch,
        });
        return;
      }
      for (const label of textLabels) {
        const flange = flanges.find((f) => f.side === label.side);
        if (!flange) continue;
        const buf = fontBuffers.get(`${label.fontFamily}|${label.fontVariant}`);
        if (!buf) continue;
        const { geometry, widthMm, heightMm } = buildTextGeometry(
          label.content,
          buf,
          {
            letterHeightMm: label.letterHeightMm,
            extrusionMm: label.extrusionMm,
          },
        );
        if (geometry.attributes.position?.count) {
          const placed = placeTextOnFlange({
            geometry,
            textWidthMm: widthMm,
            textHeightMm: heightMm,
            flange,
            label,
          });
          textLabelGeometries[label.id] = placed;
        }
        // NB: do NOT dispose `geometry` — it is owned by the
        // buildTextGeometry cache and will be reused on the next
        // rebuild. `placeTextOnFlange` already cloned before applying
        // the flange transform, so the scene holds its own copy.
      }
    }

    // Final epoch check: if a newer rebuild has started, drop this
    // result entirely rather than overwriting the newer one with
    // stale data.
    if (myEpoch !== rebuildEpoch) {
      log.debug('rebuild superseded before commit', {
        epoch: myEpoch,
        current: rebuildEpoch,
      });
      return;
    }

    const nonNullLayerGeoms: Partial<Record<LayerKey, BufferGeometry>> =
      Object.fromEntries(
        Object.entries(layerGeometries).filter(([, v]) => v != null),
      ) as Partial<Record<LayerKey, BufferGeometry>>;

    state.setMeshResult({
      status: 'ready',
      plinthGeometry: plinth.renderGeometry,
      plinthManifold: plinth.manifold,
      layerGeometries: nonNullLayerGeoms,
      textLabelGeometries,
      plinthTopZ: plinth.topZ,
      dimsMm: plinth.dimsMm,
      triCount: plinth.triCount,
      error: undefined,
    });
    // Clear the live progress payload so the scene overlay + header
    // badge go back to a quiet "READY" state on success.
    state.setMeshProgress(null);
    log.info('geom:rebuild done', {
      epoch: myEpoch,
      triCount: plinth.triCount,
      textLabels: Object.keys(textLabelGeometries).length,
    });
  } catch (err) {
    // Only surface errors that belong to the latest rebuild. An
    // overtaken rebuild's exception should not kick the scene into
    // the error state when a newer rebuild is still in flight.
    if (myEpoch === rebuildEpoch) {
      log.error('rebuild failed', err);
      state.setMeshStatus(
        'error',
        err instanceof Error ? err.message : String(err),
      );
      state.setMeshProgress(null);
    } else {
      log.debug('stale rebuild error suppressed', err);
    }
  } finally {
    done();
  }
}

export interface GenerateHookApi {
  /**
   * Full pipeline. Fetches raw data (or uses the cache when the
   * fetch fingerprint matches the latest selection) and rebuilds
   * geometry.
   */
  generate: () => Promise<void>;
  /**
   * Rebuild-only. A no-op when no raw cache is present (i.e. the user
   * hasn't clicked Generate yet). Safe to call from a debounced
   * auto-rebuild hook.
   */
  rebuild: () => Promise<void>;
}

export function useGenerateMesh(): GenerateHookApi {
  const generate = useCallback(async (): Promise<void> => {
    const state = useStore.getState();
    const { selection, gpx, layers, textLabels } = state;
    const { setMeshStatus } = state;
    log.info('generate start', {
      center: selection.center,
      shape: selection.shape,
      sizeKm: selection.sizeKm,
    });
    try {
      setMeshStatus('fetching');
      const raw = await ensureRawData(selection, gpx, false);
      setMeshStatus('building');
      await rebuildFromRaw(raw, selection, layers, gpx, textLabels);
    } catch (err) {
      log.error('generate failed', err);
      setMeshStatus(
        'error',
        err instanceof Error ? err.message : String(err),
      );
      useStore.getState().setMeshProgress(null);
    }
  }, []);

  const rebuild = useCallback(async (): Promise<void> => {
    const state = useStore.getState();
    const { selection, gpx, layers, textLabels } = state;
    const cached = state.mesh.rawCache;
    if (!cached || cached.fingerprint !== rawCacheFingerprint(selection)) {
      log.debug('rebuild skipped (no cache for fingerprint)');
      return;
    }
    // Auto-rebuilds deliberately do NOT flip `mesh.status` to
    // 'building'. The scene stays in 'ready' so slider drags don't
    // cause the loading overlay to flash. `rebuildFromRaw` will either
    // commit a fresh result (status stays 'ready') or set 'error' on
    // failure.
    await rebuildFromRaw(
      toLiveCache(cached),
      selection,
      layers,
      gpx,
      textLabels,
    );
  }, []);

  return { generate, rebuild };
}
