/**
 * Shared domain types for MeshMap.
 *
 * These types are the contract between the store, the pipeline, and the UI.
 * Keep this file small and free of implementation imports (no three.js, etc.).
 */

import type { BufferGeometry } from 'three';
import type { Feature, LineString } from 'geojson';

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
  /** +raised / −recessed relative to the terrain surface, in millimeters. */
  heightOffsetMm: number;
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

export interface MeshState {
  status: MeshStatus;
  error?: string;
  /** Watertight plinth render geometry (displayed in R3F). */
  plinthGeometry?: BufferGeometry;
  /** Opaque manifold handle kept around so exports can union with buildings/GPX. */
  plinthManifold?: unknown;
  /** Per-layer (non-plinth) geometries, used by FeatureLayer components. */
  layerGeometries: Partial<Record<LayerKey, BufferGeometry>>;
  /**
   * Z-coordinate of the plinth's top surface in world units (meters).
   * Used by the scene + exporter to lift layer geometries onto the plinth.
   */
  plinthTopZ?: number;
  dimsMm?: { x: number; y: number; z: number };
  triCount?: number;
}

export type Layers = Record<LayerKey, LayerConfig>;
