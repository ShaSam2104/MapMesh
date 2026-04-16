import { describe, expect, it, beforeEach } from 'vitest';
import { useStore, rawCacheFingerprint } from './store';

describe('store', () => {
  beforeEach(() => {
    // Reset the store to defaults between tests
    const s = useStore.getState();
    s.setShape('square');
    s.setSize(2);
    s.setRotation(0);
    s.setBaseThickness(6);
    s.setExaggeration(1.5);
    // Drop any lingering labels from previous tests
    for (const l of [...s.textLabels]) s.removeTextLabel(l.id);
    s.clearRawCache();
  });

  it('seeds 8 layers with defaults', () => {
    const { layers } = useStore.getState();
    expect(Object.keys(layers)).toHaveLength(8);
    for (const k of Object.keys(layers)) {
      expect(layers[k as keyof typeof layers].visible).toBe(true);
    }
  });

  it('seeds widthMeters on roads / piers / gpxPath', () => {
    const { layers } = useStore.getState();
    expect(layers.roads.widthMeters).toBe(6);
    expect(layers.piers.widthMeters).toBe(4);
    expect(layers.gpxPath.widthMeters).toBe(3);
    expect(layers.water.widthMeters).toBeUndefined();
  });

  it('seeds heightScale on buildings only', () => {
    const { layers } = useStore.getState();
    expect(layers.buildings.heightScale).toBe(1);
    expect(layers.roads.heightScale).toBeUndefined();
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

  it('setLayerWidthMeters clamps and updates', () => {
    useStore.getState().setLayerWidthMeters('roads', 12);
    expect(useStore.getState().layers.roads.widthMeters).toBe(12);
    useStore.getState().setLayerWidthMeters('roads', 999);
    expect(useStore.getState().layers.roads.widthMeters).toBe(60);
    useStore.getState().setLayerWidthMeters('roads', 0);
    expect(useStore.getState().layers.roads.widthMeters).toBe(0.5);
  });

  it('setLayerHeightScale clamps and updates', () => {
    useStore.getState().setLayerHeightScale('buildings', 2);
    expect(useStore.getState().layers.buildings.heightScale).toBe(2);
    useStore.getState().setLayerHeightScale('buildings', 99);
    expect(useStore.getState().layers.buildings.heightScale).toBe(3);
    useStore.getState().setLayerHeightScale('buildings', 0.01);
    expect(useStore.getState().layers.buildings.heightScale).toBe(0.3);
  });

  it('resetLayerDefaults restores seed values including width', () => {
    useStore.getState().setLayerColor('buildings', '#ff0000');
    useStore.getState().toggleLayerExport('buildings');
    useStore.getState().setLayerHeightScale('buildings', 2.5);
    useStore.getState().resetLayerDefaults('buildings');
    const b = useStore.getState().layers.buildings;
    expect(b.color).toBe('#3D4043');
    expect(b.includeInExport).toBe(true);
    expect(b.heightScale).toBe(1);

    useStore.getState().setLayerWidthMeters('roads', 30);
    useStore.getState().resetLayerDefaults('roads');
    expect(useStore.getState().layers.roads.widthMeters).toBe(6);
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

  describe('setMeshProgress', () => {
    it('sets a phase with startedAt timestamp', () => {
      const before = Date.now();
      useStore.getState().setMeshProgress('Fetching elevation tiles', 'AWS');
      const progress = useStore.getState().mesh.progress;
      expect(progress?.phase).toBe('Fetching elevation tiles');
      expect(progress?.detail).toBe('AWS');
      expect(progress?.startedAt).toBeGreaterThanOrEqual(before);
    });

    it('clears the progress payload when called with null', () => {
      useStore.getState().setMeshProgress('Building map layers');
      expect(useStore.getState().mesh.progress).toBeDefined();
      useStore.getState().setMeshProgress(null);
      expect(useStore.getState().mesh.progress).toBeUndefined();
    });

    it('replaces an existing phase with a fresh startedAt', async () => {
      useStore.getState().setMeshProgress('Phase one');
      const first = useStore.getState().mesh.progress?.startedAt;
      // Yield a millisecond so the next Date.now() bumps.
      await new Promise((r) => setTimeout(r, 2));
      useStore.getState().setMeshProgress('Phase two');
      const second = useStore.getState().mesh.progress?.startedAt;
      expect(useStore.getState().mesh.progress?.phase).toBe('Phase two');
      expect(second).toBeGreaterThanOrEqual(first ?? 0);
    });
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

  describe('raw cache', () => {
    it('setRawCache stores the cache object', () => {
      useStore.getState().setRawCache({
        fingerprint: 'fp',
        grid: {},
        classified: {},
        gpxGeojson: null,
      });
      expect(useStore.getState().mesh.rawCache?.fingerprint).toBe('fp');
    });

    it('clearRawCache removes the cache object', () => {
      useStore.getState().setRawCache({
        fingerprint: 'fp',
        grid: {},
        classified: {},
        gpxGeojson: null,
      });
      useStore.getState().clearRawCache();
      expect(useStore.getState().mesh.rawCache).toBeUndefined();
    });

    it('rawCacheFingerprint is deterministic for the same selection', () => {
      const a = rawCacheFingerprint({
        center: [1.2345, 6.7891],
        shape: 'square',
        sizeKm: 2,
        rotationDeg: 0,
        baseThicknessMm: 6,
        exaggeration: 1.5,
      });
      const b = rawCacheFingerprint({
        center: [1.2345, 6.7891],
        shape: 'square',
        sizeKm: 2,
        rotationDeg: 0,
        baseThicknessMm: 20,
        exaggeration: 3,
      });
      // baseThickness/exaggeration are not part of the fingerprint
      expect(a).toBe(b);
    });

    it('rawCacheFingerprint changes when the fetch bbox changes', () => {
      const a = rawCacheFingerprint({
        center: [1, 1],
        shape: 'square',
        sizeKm: 2,
        rotationDeg: 0,
        baseThicknessMm: 6,
        exaggeration: 1.5,
      });
      const b = rawCacheFingerprint({
        center: [1, 1],
        shape: 'square',
        sizeKm: 2.5,
        rotationDeg: 0,
        baseThicknessMm: 6,
        exaggeration: 1.5,
      });
      expect(a).not.toBe(b);
    });
  });

  describe('text labels', () => {
    it('addTextLabel appends a default label', () => {
      useStore.getState().addTextLabel('north');
      const labels = useStore.getState().textLabels;
      expect(labels).toHaveLength(1);
      expect(labels[0]?.side).toBe('north');
      expect(labels[0]?.letterHeightMm).toBe(8);
      expect(labels[0]?.content).toBe('Label');
    });

    it('updateTextLabel patches fields and clamps letter height', () => {
      useStore.getState().addTextLabel('south');
      const id = useStore.getState().textLabels[0].id;
      useStore.getState().updateTextLabel(id, { content: 'HELLO', letterHeightMm: 999 });
      const updated = useStore.getState().textLabels[0];
      expect(updated.content).toBe('HELLO');
      expect(updated.letterHeightMm).toBe(30);
    });

    it('updateTextLabel clamps extrusion depth', () => {
      useStore.getState().addTextLabel('east');
      const id = useStore.getState().textLabels[0].id;
      useStore.getState().updateTextLabel(id, { extrusionMm: 0.01 });
      expect(useStore.getState().textLabels[0].extrusionMm).toBe(0.6);
    });

    it('removeTextLabel drops the label and any cached geometry', () => {
      useStore.getState().addTextLabel();
      const id = useStore.getState().textLabels[0].id;
      useStore.getState().removeTextLabel(id);
      expect(useStore.getState().textLabels).toHaveLength(0);
      expect(useStore.getState().mesh.textLabelGeometries[id]).toBeUndefined();
    });
  });
});
