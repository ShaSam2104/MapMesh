/**
 * Zustand store — flat single store for MeshMap.
 *
 * The `layers` slice is a `Record<LayerKey, LayerConfig>` so the Style tab
 * can `.map()` over 8 layers with zero repeated JSX.
 *
 * Side effects (generate, export, gpx) live in hooks that call into
 * `src/lib/`; the store only holds state and actions that mutate it.
 */

import { create } from 'zustand';
import type {
  GpxData,
  LayerConfig,
  LayerKey,
  Layers,
  MeshState,
  Selection,
  SelectionShape,
  Theme,
  View,
} from '@/types';
import { defaultLayers, DEFAULT_HEIGHT_OFFSET_MM } from '@/lib/palette';
import { tagged } from '@/lib/log/logger';

const log = tagged('store');

const MUMBAI: [number, number] = [72.8777, 19.076];

/**
 * Reads the persisted theme synchronously at store creation so the initial
 * `layers` palette matches the theme on first paint. Silently falls back to
 * `'dark'` if storage is unavailable (tests, SSR, private mode).
 */
function readInitialTheme(): Theme {
  try {
    if (typeof localStorage === 'undefined') return 'dark';
    const stored = localStorage.getItem('meshmap_theme');
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

const INITIAL_THEME: Theme = readInitialTheme();

export interface StoreState {
  theme: Theme;
  view: View;
  selection: Selection;
  layers: Layers;
  gpx: GpxData | null;
  mesh: MeshState;

  // --- actions ---
  setTheme: (t: Theme) => void;
  setView: (v: Partial<View>) => void;

  setSelectionCenter: (center: [number, number]) => void;
  setShape: (s: SelectionShape) => void;
  setSize: (km: number) => void;
  setRotation: (deg: number) => void;
  setBaseThickness: (mm: number) => void;
  setExaggeration: (x: number) => void;

  // Layer mutations — work uniformly for all 8 layers
  setLayerColor: (key: LayerKey, hex: string) => void;
  toggleLayerVisible: (key: LayerKey) => void;
  toggleLayerExport: (key: LayerKey) => void;
  setLayerHeightOffset: (key: LayerKey, mm: number) => void;
  resetLayerDefaults: (key: LayerKey) => void;

  setGpx: (gpx: GpxData | null) => void;

  setMeshStatus: (status: MeshState['status'], error?: string) => void;
  setMeshResult: (patch: Partial<MeshState>) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  theme: INITIAL_THEME,
  view: { center: MUMBAI, zoom: 13 },
  selection: {
    center: MUMBAI,
    shape: 'square',
    sizeKm: 2,
    rotationDeg: 0,
    baseThicknessMm: 6,
    exaggeration: 1.5,
  },
  layers: defaultLayers(INITIAL_THEME),
  gpx: null,
  mesh: {
    status: 'idle',
    layerGeometries: {},
  },

  setTheme: (theme) => {
    log.debug('setTheme', { theme });
    // Reseed layer colors from the palette for the new theme so the 3D
    // scene visually matches the theme (dark palette in dark mode, light
    // palette in light mode). Non-color per-layer fields (visible /
    // includeInExport / heightOffsetMm) are preserved so user toggles
    // carry over across theme swaps.
    set((s) => {
      const seeded = defaultLayers(theme);
      const layers = {} as Layers;
      for (const key of Object.keys(seeded) as LayerKey[]) {
        layers[key] = {
          ...s.layers[key],
          color: seeded[key].color,
        };
      }
      return { theme, layers };
    });
  },

  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),

  setSelectionCenter: (center) =>
    set((s) => ({ selection: { ...s.selection, center }, view: { ...s.view, center } })),
  setShape: (shape) => set((s) => ({ selection: { ...s.selection, shape } })),
  setSize: (sizeKm) =>
    set((s) => ({
      selection: { ...s.selection, sizeKm: clamp(sizeKm, 0.5, 3) },
    })),
  setRotation: (rotationDeg) =>
    set((s) => ({ selection: { ...s.selection, rotationDeg } })),
  setBaseThickness: (mm) =>
    set((s) => ({ selection: { ...s.selection, baseThicknessMm: clamp(mm, 2, 20) } })),
  setExaggeration: (x) =>
    set((s) => ({ selection: { ...s.selection, exaggeration: clamp(x, 1, 3) } })),

  setLayerColor: (key, color) =>
    set((s) => updateLayer(s, key, { color })),
  toggleLayerVisible: (key) =>
    set((s) => updateLayer(s, key, { visible: !s.layers[key].visible })),
  toggleLayerExport: (key) =>
    set((s) => updateLayer(s, key, { includeInExport: !s.layers[key].includeInExport })),
  setLayerHeightOffset: (key, mm) =>
    set((s) => updateLayer(s, key, { heightOffsetMm: mm })),
  resetLayerDefaults: (key) =>
    set((s) => {
      const theme = s.theme;
      const seed = defaultLayers(theme)[key];
      return updateLayer(s, key, {
        color: seed.color,
        visible: true,
        includeInExport: true,
        heightOffsetMm: DEFAULT_HEIGHT_OFFSET_MM[key],
      });
    }),

  setGpx: (gpx) => {
    log.info('setGpx', { file: gpx?.fileName, points: gpx?.geojson.geometry.coordinates.length });
    set({ gpx });
  },

  setMeshStatus: (status, error) => {
    log.debug('mesh status', { status, error });
    set((s) => ({ mesh: { ...s.mesh, status, error } }));
  },

  setMeshResult: (patch) => {
    set((s) => ({ mesh: { ...s.mesh, ...patch } }));
    void get; // keep get in scope for future action composition
  },
}));

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function updateLayer(
  state: StoreState,
  key: LayerKey,
  patch: Partial<LayerConfig>,
): Partial<StoreState> {
  return {
    layers: {
      ...state.layers,
      [key]: { ...state.layers[key], ...patch },
    },
  };
}
