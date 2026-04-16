import { useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { centroid as turfCentroid } from '@turf/turf';
import { useStore } from '@/state/store';
import { parseGpx } from '@/lib/data/gpx';
import { tagged } from '@/lib/log/logger';
import { useGenerateMesh } from '@/hooks/useGenerateMesh';
import { Button } from '@/components/ui/Button';

const log = tagged('gpx-upload');

export function GpxUploader(): JSX.Element {
  const gpx = useStore((s) => s.gpx);
  const setGpx = useStore((s) => s.setGpx);
  const setSelectionCenter = useStore((s) => s.setSelectionCenter);
  const setView = useStore((s) => s.setView);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { generate } = useGenerateMesh();

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseGpx(text);
    setGpx({
      geojson: parsed.geojson,
      distanceKm: parsed.distanceKm,
      fileName: file.name,
    });

    // Recenter the map + selection on the GPX centroid so the uploaded track
    // is inside the active selection. Without this the user uploads a route
    // from another city and the preview never updates.
    let recentered = false;
    try {
      const c = turfCentroid(parsed.geojson);
      const [lng, lat] = c.geometry.coordinates as [number, number];
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        setSelectionCenter([lng, lat]);
        setView({ center: [lng, lat], zoom: 14 });
        log.info('gpx recenter', { lng, lat, distanceKm: parsed.distanceKm });
        recentered = true;
      }
    } catch (err) {
      log.warn('gpx centroid failed', err);
    }

    // If the user already has a generated mesh, immediately re-run the
    // pipeline so the freshly-uploaded path appears on the plinth without
    // them having to click Generate again. Skip if there's no mesh yet —
    // we don't want to silently kick off an Overpass call on first upload.
    const meshStatus = useStore.getState().mesh.status;
    if (recentered && meshStatus === 'ready') {
      void generate();
    }
  };

  return (
    <div className="space-y-2">
      <div className="label">GPX file</div>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="sr-only"
        aria-label="Upload GPX file"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <div className="flex items-center gap-2">
        <Button onClick={() => inputRef.current?.click()}>
          <Upload size={14} /> Upload .gpx
        </Button>
        {gpx && (
          <Button aria-label="Remove GPX" onClick={() => setGpx(null)}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>
      {gpx && (
        <div className="text-xs font-mono tabular-nums text-ink-1">
          {gpx.fileName} · {gpx.distanceKm.toFixed(2)} km
        </div>
      )}
    </div>
  );
}
