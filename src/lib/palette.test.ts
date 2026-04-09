import { describe, expect, it } from 'vitest';
import {
  LAYER_ICON,
  LAYER_LABEL,
  DEFAULT_HEIGHT_OFFSET_MM,
  defaultColor,
  defaultLayers,
} from './palette';
import { LAYER_ORDER } from '@/types';

describe('palette', () => {
  it('has an icon, label, and default colors for every layer', () => {
    for (const key of LAYER_ORDER) {
      expect(LAYER_ICON[key]).toBeTruthy();
      expect(LAYER_LABEL[key]).toBeTruthy();
      expect(defaultColor(key, 'dark')).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(defaultColor(key, 'light')).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('seeds defaultLayers with visible + include-in-export on', () => {
    const layers = defaultLayers('dark');
    for (const key of LAYER_ORDER) {
      expect(layers[key].visible).toBe(true);
      expect(layers[key].includeInExport).toBe(true);
      expect(layers[key].color).toBe(defaultColor(key, 'dark'));
    }
  });

  it('uses the user-locked dark colors', () => {
    expect(defaultColor('buildings', 'dark')).toBe('#3D4043');
    expect(defaultColor('roads', 'dark')).toBe('#121212');
    expect(defaultColor('base', 'dark')).toBe('#1A1B1E');
    expect(defaultColor('gpxPath', 'dark')).toBe('#00E5FF');
  });

  it('seeds heightOffsetMm to 0 mm for area/line layers and a positive mm value for gpxPath', () => {
    const layers = defaultLayers('dark');
    // Area + line layers sit flush on the plinth top.
    expect(layers.water.heightOffsetMm).toBe(0);
    expect(layers.grass.heightOffsetMm).toBe(0);
    expect(layers.sand.heightOffsetMm).toBe(0);
    expect(layers.roads.heightOffsetMm).toBe(0);
    expect(layers.piers.heightOffsetMm).toBe(0);
    // GPX ribbon floats clearly above the surrounding slabs — strictly
    // above the typical 1.2 mm slab thickness so it is always visible.
    expect(layers.gpxPath.heightOffsetMm).toBeGreaterThan(1.2);
  });

  it('exposes the same defaults via DEFAULT_HEIGHT_OFFSET_MM', () => {
    for (const key of LAYER_ORDER) {
      expect(DEFAULT_HEIGHT_OFFSET_MM[key]).toBe(
        defaultLayers('dark')[key].heightOffsetMm,
      );
    }
  });
});
