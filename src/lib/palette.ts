/**
 * Default mesh colors per layer, per theme. User spec is authoritative.
 *
 * Buildings, Roads, GPX Path, Base are user-locked; the others are designed
 * to sit coherently in the Midnight Studio / Architect's Paper palettes.
 */

import type { LayerKey, Layers, Theme } from '@/types';

type ColorMap = Record<LayerKey, string>;

const DARK_COLORS: ColorMap = {
  base: '#1A1B1E',
  buildings: '#3D4043',
  roads: '#121212',
  water: '#1A3D52',
  grass: '#2C3E2F',
  sand: '#5C4F3A',
  piers: '#4A4238',
  gpxPath: '#00E5FF',
};

const LIGHT_COLORS: ColorMap = {
  base: '#EFEBE3',
  buildings: '#C9CDD3',
  roads: '#2A2A2A',
  water: '#AACFDB',
  grass: '#C5D4B3',
  sand: '#E8D5A8',
  piers: '#B8A788',
  gpxPath: '#0097A7',
};

/**
 * Default height offset per layer in **print millimeters above the plinth
 * top**.
 *
 * Convention: this is the **bottom** of the slab/strip. `0` means the layer
 * sits flush on the plinth top and extrudes upward by its (chunky, ~1.0–1.2
 * mm) thickness so it remains printable on a 0.4 mm FDM nozzle (≥ 0.8 mm
 * minimum wall).
 *
 * `gpxPath` is sized to clear the surrounding area slabs so the route
 * ribbon is always visible from above.
 */
export const DEFAULT_HEIGHT_OFFSET_MM: Record<LayerKey, number> = {
  base: 0,
  buildings: 0,
  roads: 0,
  water: 0,
  grass: 0,
  sand: 0,
  piers: 0,
  gpxPath: 2.5,
};

/** Lucide icon name per layer, used by LayerRow. */
export const LAYER_ICON: Record<LayerKey, string> = {
  base: 'Box',
  buildings: 'Building2',
  roads: 'Milestone',
  water: 'Waves',
  grass: 'Sprout',
  sand: 'Palmtree',
  piers: 'Anchor',
  gpxPath: 'Footprints',
};

/** Display label per layer. */
export const LAYER_LABEL: Record<LayerKey, string> = {
  base: 'Base',
  buildings: 'Buildings',
  roads: 'Roads',
  water: 'Water',
  grass: 'Grass',
  sand: 'Sand',
  piers: 'Piers',
  gpxPath: 'GPX Path',
};

/**
 * Returns the default color for a layer in the given theme.
 */
export function defaultColor(key: LayerKey, theme: Theme): string {
  return (theme === 'dark' ? DARK_COLORS : LIGHT_COLORS)[key];
}

/**
 * Returns a full default `Layers` record seeded from the palette.
 */
export function defaultLayers(theme: Theme): Layers {
  const src = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const result = {} as Layers;
  for (const key of Object.keys(src) as LayerKey[]) {
    result[key] = {
      color: src[key],
      visible: true,
      includeInExport: true,
      heightOffsetMm: DEFAULT_HEIGHT_OFFSET_MM[key],
    };
  }
  return result;
}
