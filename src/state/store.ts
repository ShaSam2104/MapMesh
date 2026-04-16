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
  RawCache,
  Selection,
  SelectionShape,
  TextLabel,
  Theme,
  View,
} from '@/types';
import {
  defaultLayers,
  DEFAULT_HEIGHT_OFFSET_MM,
  DEFAULT_WIDTH_METERS,
  DEFAULT_BUILDING_HEIGHT_SCALE,
} from '@/lib/palette';
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

/** Builds a stable fingerprint for the data-fetch cache. */
export function rawCacheFingerprint(sel: Selection): string {
  return [
    sel.center[0].toFixed(6),
    sel.center[1].toFixed(6),
    sel.shape,
    sel.sizeKm.toFixed(3),
    sel.rotationDeg.toFixed(2),
  ].join('|');
}

function defaultTextLabel(side: TextLabel['side'] = 'north'): TextLabel {
  return {
    id: cryptoRandomId(),
    content: 'Label',
    fontFamily: 'Roboto',
    fontVariant: 'regular',
    color: '#E8E6DF',
    side,
    letterHeightMm: 8,
    extrusionMm: 1.2,
    alignment: 'center',
    offsetMm: 0,
  };
}

function cryptoRandomId(): string {
  // Use globalThis.crypto when available (browser + node 19+), fall back
  // to a timestamp/random composite for the rare test environment that
  // lacks it.
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface StoreState {
  theme: Theme;
  view: View;
  selection: Selection;
  layers: Layers;
  gpx: GpxData | null;
  mesh: MeshState;
  textLabels: TextLabel[];

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
  setLayerWidthMeters: (key: LayerKey, meters: number) => void;
  setLayerHeightScale: (key: LayerKey, scale: number) => void;
  resetLayerDefaults: (key: LayerKey) => void;

  setGpx: (gpx: GpxData | null) => void;

  setMeshStatus: (status: MeshState['status'], error?: string) => void;
  setMeshResult: (patch: Partial<MeshState>) => void;
  /**
   * Updates the live progress payload shown in the scene overlay +
   * header. Pass `null` to clear it (e.g. on success or error).
   */
  setMeshProgress: (phase: string | null, detail?: string) => void;

  /** Cache the raw fetched data so rebuilds skip Overpass + Terrarium. */
  setRawCache: (cache: RawCache) => void;
  /** Drop the cached raw data — called when the fetch fingerprint changes. */
  clearRawCache: () => void;

  // Text label CRUD
  addTextLabel: (side?: TextLabel['side']) => void;
  updateTextLabel: (id: string, patch: Partial<TextLabel>) => void;
  removeTextLabel: (id: string) => void;
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
    textLabelGeometries: {},
  },
  textLabels: [],

  setTheme: (theme) => {
    log.debug('setTheme', { theme });
    // Reseed layer colors from the palette for the new theme so the 3D
    // scene visually matches the theme (dark palette in dark mode, light
    // palette in light mode). Non-color per-layer fields (visible /
    // includeInExport / heightOffset / widthMeters / heightScale) are
    // preserved so user edits carry over across theme swaps.
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
  setLayerWidthMeters: (key, meters) =>
    set((s) => updateLayer(s, key, { widthMeters: clamp(meters, 0.5, 60) })),
  setLayerHeightScale: (key, scale) =>
    set((s) => updateLayer(s, key, { heightScale: clamp(scale, 0.3, 3) })),
  resetLayerDefaults: (key) =>
    set((s) => {
      const theme = s.theme;
      const seed = defaultLayers(theme)[key];
      return updateLayer(s, key, {
        color: seed.color,
        visible: true,
        includeInExport: true,
        heightOffsetMm: DEFAULT_HEIGHT_OFFSET_MM[key],
        widthMeters: DEFAULT_WIDTH_METERS[key],
        heightScale: key === 'buildings' ? DEFAULT_BUILDING_HEIGHT_SCALE : undefined,
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

  setMeshProgress: (phase, detail) => {
    if (phase === null) {
      set((s) => {
        if (!s.mesh.progress) return {};
        const { progress: _omit, ...rest } = s.mesh;
        void _omit;
        return { mesh: { ...rest } };
      });
      return;
    }
    const next: MeshState['progress'] = {
      phase,
      detail,
      startedAt: Date.now(),
    };
    log.debug('mesh progress', next);
    set((s) => ({ mesh: { ...s.mesh, progress: next } }));
  },

  setRawCache: (cache) => {
    log.debug('setRawCache', { fp: cache.fingerprint });
    set((s) => ({ mesh: { ...s.mesh, rawCache: cache } }));
  },
  clearRawCache: () => {
    log.debug('clearRawCache');
    set((s) => {
      if (!s.mesh.rawCache) return {};
      const { rawCache: _omit, ...rest } = s.mesh;
      void _omit;
      return { mesh: { ...rest } };
    });
  },

  addTextLabel: (side) => {
    const label = defaultTextLabel(side);
    log.info('addTextLabel', { id: label.id, side: label.side });
    set((s) => ({ textLabels: [...s.textLabels, label] }));
  },
  updateTextLabel: (id, patch) => {
    set((s) => ({
      textLabels: s.textLabels.map((l) =>
        l.id === id ? clampTextLabel({ ...l, ...patch }) : l,
      ),
    }));
  },
  removeTextLabel: (id) => {
    log.info('removeTextLabel', { id });
    set((s) => {
      const textLabels = s.textLabels.filter((l) => l.id !== id);
      // Also drop any orphaned geometry so the scene stops rendering it.
      const { [id]: _removed, ...rest } = s.mesh.textLabelGeometries;
      void _removed;
      return {
        textLabels,
        mesh: { ...s.mesh, textLabelGeometries: rest },
      };
    });
  },
}));

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampTextLabel(l: TextLabel): TextLabel {
  return {
    ...l,
    letterHeightMm: clamp(l.letterHeightMm, 3, 30),
    extrusionMm: clamp(l.extrusionMm, 0.6, 5),
  };
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
