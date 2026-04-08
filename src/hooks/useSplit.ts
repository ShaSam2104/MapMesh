/**
 * Persists the Map ↔ 3D split pane ratio to localStorage.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'meshmap_split_ratio';
const DEFAULT = 0.5;

export function useSplit(): [number, (ratio: number) => void] {
  const [ratio, setRatio] = useState<number>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const n = raw == null ? NaN : parseFloat(raw);
      if (Number.isFinite(n) && n > 0.1 && n < 0.9) setRatio(n);
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((next: number) => {
    const clamped = Math.max(0.1, Math.min(0.9, next));
    setRatio(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  return [ratio, update];
}
