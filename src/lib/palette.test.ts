import { describe, expect, it } from 'vitest';
import { LAYER_ICON, LAYER_LABEL, defaultColor, defaultLayers } from './palette';
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

  it('recesses water and raises path / piers', () => {
    const layers = defaultLayers('dark');
    expect(layers.water.heightOffsetMm).toBeLessThan(0);
    expect(layers.piers.heightOffsetMm).toBeGreaterThan(0);
    expect(layers.gpxPath.heightOffsetMm).toBeGreaterThan(0);
  });
});
