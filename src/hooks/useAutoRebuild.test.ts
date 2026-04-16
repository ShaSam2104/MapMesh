import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutoRebuild } from './useAutoRebuild';
import { useStore } from '@/state/store';

// `useAutoRebuild` internally calls `useGenerateMesh`, which calls
// `useCallback` to wire up the two entry points. The test doesn't let
// the real rebuild run because there's no manifold WASM under jsdom.
// Instead we stub `useGenerateMesh` entirely and assert the debounced
// `rebuild()` fn is called exactly once per debounce window.
const rebuildSpy = vi.fn(async () => undefined);
vi.mock('./useGenerateMesh', () => ({
  useGenerateMesh: () => ({
    generate: vi.fn(async () => undefined),
    rebuild: rebuildSpy,
  }),
}));

describe('useAutoRebuild', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rebuildSpy.mockClear();
    // Reset the relevant store bits to a known baseline.
    const s = useStore.getState();
    s.clearRawCache();
    for (const l of [...s.textLabels]) s.removeTextLabel(l.id);
    s.setBaseThickness(6);
    s.setExaggeration(1.5);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not rebuild when there is no raw cache', () => {
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().setBaseThickness(10);
    });
    vi.runAllTimers();
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it('rebuilds once (debounced) when a param changes and cache is present', () => {
    // Seed a cache so the rebuild can fire.
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().setBaseThickness(7);
      useStore.getState().setBaseThickness(8);
      useStore.getState().setBaseThickness(9);
    });
    expect(rebuildSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });

  it('debounces text label edits at the longer text delay', () => {
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().addTextLabel('north');
    });
    // 150 ms (param debounce) is not enough for text-only changes.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(rebuildSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(120); // total 270 > 250 ms text debounce
    });
    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });

  it('does not trigger on pure color changes', () => {
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().setLayerColor('roads', '#ff00ff');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it('does not trigger on visible/export toggles', () => {
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().toggleLayerVisible('buildings');
      useStore.getState().toggleLayerExport('water');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it('triggers on widthMeters changes', () => {
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().setLayerWidthMeters('roads', 10);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers on buildings.heightScale changes', () => {
    useStore.getState().setRawCache({
      fingerprint: 'fp',
      grid: {},
      classified: {},
      gpxGeojson: null,
    });
    renderHook(() => useAutoRebuild());
    act(() => {
      useStore.getState().setLayerHeightScale('buildings', 2);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });
});
