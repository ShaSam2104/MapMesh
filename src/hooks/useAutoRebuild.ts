/**
 * `useAutoRebuild` — debounced rebuild trigger.
 *
 * Subscribes to every store field that changes the geometry but *not*
 * the fetch bbox (base thickness, exaggeration, per-layer width /
 * height scale / height offset, GPX upload, and the entire text
 * labels list). When any of those change and a raw cache is present,
 * it calls `rebuild()` on a short debounce so slider drags produce
 * one rebuild per gesture instead of one rebuild per mouse event.
 *
 * Color changes deliberately do **not** trigger a rebuild — colors
 * are wired into `<meshStandardMaterial color={...} />` and update
 * instantly without a geometry rebuild. Layer `visible` /
 * `includeInExport` toggles also stay out of the trigger set: they
 * only affect rendering / export and have no effect on geometry.
 *
 * The hook mounts exactly once from `<App />`. Calling it more than
 * once would set up duplicate subscriptions; we deliberately do not
 * export a guard because the single-mount contract is simple enough
 * to enforce by eye in `App.tsx`.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/state/store';
import { tagged } from '@/lib/log/logger';
import type { Layers, Selection, TextLabel, GpxData } from '@/types';
import { useGenerateMesh } from './useGenerateMesh';

const log = tagged('auto-rebuild');

/** Debounce for slider / param edits. */
const PARAM_DEBOUNCE_MS = 150;
/** Debounce for text label edits — slightly longer because text rebuilds
 * pay for a font fetch + opentype parse on every font change. */
const TEXT_DEBOUNCE_MS = 250;

/**
 * Pulls every rebuild-affecting field out of the store into a
 * compact, shallow-comparable shape.
 */
interface RebuildInputs {
  sel: Pick<Selection, 'baseThicknessMm' | 'exaggeration'>;
  layerOffsets: string;
  layerWidths: string;
  layerHeightScale: number | undefined;
  textLabels: readonly TextLabel[];
  gpx: GpxData | null;
}

function extract(s: {
  selection: Selection;
  layers: Layers;
  textLabels: readonly TextLabel[];
  gpx: GpxData | null;
}): RebuildInputs {
  const keys = ['base', 'buildings', 'roads', 'water', 'grass', 'sand', 'piers', 'gpxPath'] as const;
  const offsets = keys.map((k) => `${k}:${s.layers[k].heightOffsetMm}`).join('|');
  const widths = (['roads', 'piers', 'gpxPath'] as const)
    .map((k) => `${k}:${s.layers[k].widthMeters ?? ''}`)
    .join('|');
  return {
    sel: {
      baseThicknessMm: s.selection.baseThicknessMm,
      exaggeration: s.selection.exaggeration,
    },
    layerOffsets: offsets,
    layerWidths: widths,
    layerHeightScale: s.layers.buildings.heightScale,
    textLabels: s.textLabels,
    gpx: s.gpx,
  };
}

function hasChanged(a: RebuildInputs, b: RebuildInputs): { changed: boolean; textOnly: boolean } {
  const paramChanged =
    a.sel.baseThicknessMm !== b.sel.baseThicknessMm ||
    a.sel.exaggeration !== b.sel.exaggeration ||
    a.layerOffsets !== b.layerOffsets ||
    a.layerWidths !== b.layerWidths ||
    a.layerHeightScale !== b.layerHeightScale ||
    a.gpx !== b.gpx;
  const textChanged = a.textLabels !== b.textLabels;
  return {
    changed: paramChanged || textChanged,
    textOnly: !paramChanged && textChanged,
  };
}

/**
 * Mount-once hook. Subscribes to the store and fires `rebuild()` on
 * debounced changes to any geometry-affecting input.
 */
export function useAutoRebuild(): void {
  const { rebuild } = useGenerateMesh();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef = useRef<RebuildInputs | null>(null);

  useEffect(() => {
    lastRef.current = extract(useStore.getState());
    const unsubscribe = useStore.subscribe((state) => {
      const next = extract(state);
      const prev = lastRef.current;
      if (!prev) {
        lastRef.current = next;
        return;
      }
      const { changed, textOnly } = hasChanged(prev, next);
      if (!changed) return;
      lastRef.current = next;
      // Skip if there's no cached raw data (user hasn't clicked
      // Generate yet, or the fetch fingerprint has moved). The
      // `rebuild()` callable also guards this internally; we early-
      // exit here to avoid even scheduling the debounced timer.
      const mesh = state.mesh;
      if (!mesh.rawCache) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = textOnly ? TEXT_DEBOUNCE_MS : PARAM_DEBOUNCE_MS;
      timerRef.current = setTimeout(() => {
        log.debug('auto rebuild firing', { textOnly, delay });
        void rebuild();
      }, delay);
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rebuild]);
}
