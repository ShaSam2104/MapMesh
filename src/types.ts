/**
 * Shared domain types for MeshMap.
 *
 * These types are the contract between the store, the pipeline, and the UI.
 * Keep this file small and free of implementation imports (no three.js, etc.).
 */

import type { BufferGeometry } from 'three';
import type { Feature, FeatureCollection, LineString } from 'geojson';

/** The 8 layer categories shown in the Style tab. Order is significant — drives the accordion order. */
export type LayerKey =
  | 'base'
  | 'buildings'
  | 'roads'
  | 'water'
  | 'grass'
  | 'sand'
  | 'piers'
  | 'gpxPath';

export const LAYER_ORDER: readonly LayerKey[] = [
  'base',
  'buildings',
  'roads',
  'water',
  'grass',
  'sand',
  'piers',
  'gpxPath',
] as const;

export type Theme = 'dark' | 'light';

export type SelectionShape = 'square' | 'circle' | 'hex';

export type MeshStatus = 'idle' | 'fetching' | 'building' | 'ready' | 'error';

export type LngLat = [number, number];

export interface LayerConfig {
  /** Hex color `#RRGGBB`. */
  color: string;
  /** Show this layer in the R3F preview. */
  visible: boolean;
  /** Merge this layer into the printed STL/3MF. */
  includeInExport: boolean;
  /**
   * Layer position above the plinth top in **print millimeters**
   * (`1 world unit = 1 print mm`). For area / line layers this is the
   * **bottom** of the slab; for `gpxPath` it is the bottom of the
   * ribbon above the plinth.
   */
  heightOffsetMm: number;
  /**
   * Line-strip half-width in **real-world meters** (turf.buffer input).
   * Only meaningful for `roads`, `piers`, `gpxPath`. Optional because
   * polygon layers (buildings / water / grass / sand / base) do not
   * use a buffered line pipeline.
   */
  widthMeters?: number;
  /**
   * Per-building extrusion multiplier. Only meaningful for `buildings`.
   * Range 0.3–3; multiplies the height extracted from OSM tags.
   */
  heightScale?: number;
}

export interface Selection {
  center: LngLat;
  shape: SelectionShape;
  /** Size of the selection from 0.5 to 3.0 km. */
  sizeKm: number;
  rotationDeg: number;
  /** Plinth base thickness in millimeters. */
  baseThicknessMm: number;
  /** Vertical exaggeration multiplier (1..3). */
  exaggeration: number;
}

export interface View {
  center: LngLat;
  zoom: number;
}

export interface GpxData {
  geojson: Feature<LineString>;
  distanceKm: number;
  fileName: string;
}

/** Side of the plinth that a flange/text label is attached to. */
export type FlangeSide = 'north' | 'south' | 'east' | 'west';

/**
 * Raised-letter text label attached to the outer face of a plinth flange.
 * All linear dimensions in **print millimeters**.
 */
export interface TextLabel {
  id: string;
  content: string;
  /** Google Fonts family name, e.g. "Roboto". */
  fontFamily: string;
  /** Variant identifier; v1 always uses "regular". */
  fontVariant: string;
  /** Hex color `#RRGGBB`. */
  color: string;
  side: FlangeSide;
  /** Capital-letter height in print mm. */
  letterHeightMm: number;
  /** Extrusion depth (relief height) above the flange face in print mm. */
  extrusionMm: number;
  alignment: 'left' | 'center' | 'right';
  /** Free offset along the edge (centered at 0) in print mm. */
  offsetMm: number;
}

/**
 * Human-readable progress payload shown in the scene overlay + header
 * while `status` is `'fetching'` or `'building'`. Updated by every
 * long-running pipeline step so users always know what's happening
 * (and can tell if a step is hanging).
 */
export interface MeshProgress {
  /** Short phase label, e.g. `"Fetching map data"`. */
  phase: string;
  /** Optional extra detail, e.g. a mirror URL or a font family name. */
  detail?: string;
  /**
   * Wall-clock timestamp (ms) when this phase started. The UI uses
   * the delta vs `Date.now()` to render a live elapsed counter.
   */
  startedAt: number;
}

export interface MeshState {
  status: MeshStatus;
  error?: string;
  /**
   * Live progress payload for the currently-running pipeline step.
   * `undefined` when the pipeline is idle or finished.
   */
  progress?: MeshProgress;
  /** Watertight plinth render geometry (displayed in R3F). */
  plinthGeometry?: BufferGeometry;
  /** Opaque manifold handle kept around so exports can union with buildings/GPX. */
  plinthManifold?: unknown;
  /** Per-layer (non-plinth) geometries, used by FeatureLayer components. */
  layerGeometries: Partial<Record<LayerKey, BufferGeometry>>;
  /**
   * Per-label raised-text geometries, keyed by `TextLabel.id`. All
   * geometries are pre-placed on their flange outer face in absolute
   * print-mm world coordinates.
   */
  textLabelGeometries: Record<string, BufferGeometry>;
  /**
   * Z-coordinate of the plinth's top surface in **print millimeters**.
   * Used by the scene + exporter to lift layer geometries onto the plinth.
   */
  plinthTopZ?: number;
  dimsMm?: { x: number; y: number; z: number };
  triCount?: number;
  /**
   * Cached raw fetched data — the slow part of the generate pipeline.
   * Reused by `rebuildFromRaw` so param edits (base thickness,
   * exaggeration, layer colours/widths, text labels) don't re-fetch
   * Overpass or Terrarium.
   */
  rawCache?: RawCache;
}

export interface RawCache {
  /**
   * Opaque fingerprint: `${lng}|${lat}|${shape}|${sizeKm}|${rotationDeg}`.
   * Everything that changes the OSM/Terrarium bbox invalidates the cache;
   * nothing else.
   */
  fingerprint: string;
  /**
   * Raw elevation grid and OSM features as fetched. Typed with `unknown`
   * here to keep `src/types.ts` free of `src/lib/data/*` imports; the
   * concrete shape lives in `useGenerateMesh`.
   */
  grid: unknown;
  classified: unknown;
  gpxGeojson: Feature | null;
  /**
   * The raw Overpass feature collection kept around for debugging; not
   * used by the rebuild path.
   */
  osm?: FeatureCollection;
}

export type Layers = Record<LayerKey, LayerConfig>;
