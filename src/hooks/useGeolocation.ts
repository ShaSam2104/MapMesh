/**
 * Asks the browser for geolocation and falls back to Mumbai on denial/error.
 *
 * Reads `useStore.getState().setSelectionCenter` once on mount.
 */

import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { tagged } from '@/lib/log/logger';

const MUMBAI_FALLBACK: [number, number] = [72.8777, 19.076];
const log = tagged('geolocation');

export function useGeolocation(): void {
  const setSelectionCenter = useStore((s) => s.setSelectionCenter);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      log.warn('navigator.geolocation unavailable — using Mumbai fallback');
      setSelectionCenter(MUMBAI_FALLBACK);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        log.info('geolocation granted', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setSelectionCenter([pos.coords.longitude, pos.coords.latitude]);
      },
      (err) => {
        log.warn('geolocation denied — using Mumbai fallback', {
          code: err.code,
          message: err.message,
        });
        setSelectionCenter(MUMBAI_FALLBACK);
      },
      { timeout: 5000, maximumAge: 60_000 },
    );
  }, [setSelectionCenter]);
}
