import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from './store';

describe('store', () => {
  beforeEach(() => {
    // Reset the store to defaults between tests
    const { setShape, setSize, setRotation, setBaseThickness, setExaggeration } = useStore.getState();
    setShape('square');
    setSize(2);
    setRotation(0);
    setBaseThickness(6);
    setExaggeration(1.5);
  });

  it('seeds 8 layers with defaults', () => {
    const { layers } = useStore.getState();
    expect(Object.keys(layers)).toHaveLength(8);
    for (const k of Object.keys(layers)) {
      expect(layers[k as keyof typeof layers].visible).toBe(true);
    }
  });

  it('setLayerColor updates only that layer', () => {
    useStore.getState().setLayerColor('water', '#112233');
    expect(useStore.getState().layers.water.color).toBe('#112233');
    expect(useStore.getState().layers.buildings.color).not.toBe('#112233');
  });

  it('toggleLayerVisible flips the flag', () => {
    const before = useStore.getState().layers.roads.visible;
    useStore.getState().toggleLayerVisible('roads');
    expect(useStore.getState().layers.roads.visible).toBe(!before);
  });

  it('toggleLayerExport flips the flag', () => {
    const before = useStore.getState().layers.grass.includeInExport;
    useStore.getState().toggleLayerExport('grass');
    expect(useStore.getState().layers.grass.includeInExport).toBe(!before);
  });

  it('resetLayerDefaults restores seed values', () => {
    useStore.getState().setLayerColor('buildings', '#ff0000');
    useStore.getState().toggleLayerExport('buildings');
    useStore.getState().resetLayerDefaults('buildings');
    const b = useStore.getState().layers.buildings;
    expect(b.color).toBe('#3D4043');
    expect(b.includeInExport).toBe(true);
  });

  it('setSize clamps to [0.5, 3.0]', () => {
    useStore.getState().setSize(10);
    expect(useStore.getState().selection.sizeKm).toBe(3);
    useStore.getState().setSize(0);
    expect(useStore.getState().selection.sizeKm).toBe(0.5);
  });

  it('setBaseThickness clamps to [2, 20]', () => {
    useStore.getState().setBaseThickness(100);
    expect(useStore.getState().selection.baseThicknessMm).toBe(20);
  });

  it('setMeshStatus transitions through states', () => {
    const { setMeshStatus } = useStore.getState();
    setMeshStatus('fetching');
    expect(useStore.getState().mesh.status).toBe('fetching');
    setMeshStatus('building');
    expect(useStore.getState().mesh.status).toBe('building');
    setMeshStatus('ready');
    expect(useStore.getState().mesh.status).toBe('ready');
  });

  it('setTheme reseeds layer colors to the new theme palette', () => {
    const { setTheme } = useStore.getState();
    setTheme('dark');
    expect(useStore.getState().layers.base.color).toBe('#1A1B1E');
    expect(useStore.getState().layers.buildings.color).toBe('#3D4043');

    setTheme('light');
    // Layer colors now reflect the light palette
    expect(useStore.getState().layers.base.color).toBe('#EFEBE3');
    expect(useStore.getState().layers.buildings.color).toBe('#C9CDD3');
    expect(useStore.getState().theme).toBe('light');
  });

  it('setTheme preserves non-color layer fields (visible / heightOffsetMm)', () => {
    const { setTheme, toggleLayerVisible, setLayerHeightOffset } = useStore.getState();
    setTheme('dark');
    toggleLayerVisible('water'); // false
    setLayerHeightOffset('roads', 0.8);

    setTheme('light');
    expect(useStore.getState().layers.water.visible).toBe(false);
    expect(useStore.getState().layers.roads.heightOffsetMm).toBe(0.8);
  });
});
