import { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import { useStore } from '@/state/store';
import { shapeAsGeoJson } from '@/lib/geo/shapes';

export function SelectionOverlay(): JSX.Element {
  const selection = useStore((s) => s.selection);
  const setCenter = useStore((s) => s.setSelectionCenter);

  const geojson = useMemo(
    () =>
      shapeAsGeoJson(
        selection.shape,
        selection.center,
        selection.sizeKm,
        selection.rotationDeg,
      ),
    [selection.shape, selection.center, selection.sizeKm, selection.rotationDeg],
  );

  const fillStyle: FillLayerSpecification = {
    id: 'selection-fill',
    type: 'fill',
    source: 'selection',
    paint: {
      'fill-color': '#00E5FF',
      'fill-opacity': 0.08,
    },
  };
  const lineStyle: LineLayerSpecification = {
    id: 'selection-line',
    type: 'line',
    source: 'selection',
    paint: {
      'line-color': '#00E5FF',
      'line-width': 1.25,
    },
  };

  return (
    <>
      <Source id="selection" type="geojson" data={geojson}>
        <Layer {...fillStyle} />
        <Layer {...lineStyle} />
      </Source>
      <Marker
        longitude={selection.center[0]}
        latitude={selection.center[1]}
        draggable
        onDragEnd={(e) => setCenter([e.lngLat.lng, e.lngLat.lat])}
      >
        <div
          aria-label="Selection center"
          className="w-3 h-3 rounded-full border border-accent bg-bg-0"
        />
      </Marker>
    </>
  );
}
