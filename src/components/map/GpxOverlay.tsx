import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { useStore } from '@/state/store';

/**
 * Renders the uploaded GPX track on the 2D MapLibre map as an emissive
 * cyan polyline so the user can sanity-check the path against the basemap
 * before generating the 3D mesh. Reads from the store; renders nothing
 * when no GPX is loaded.
 */
export function GpxOverlay(): JSX.Element | null {
  const gpx = useStore((s) => s.gpx);

  const data = useMemo<FeatureCollection<LineString> | null>(() => {
    if (!gpx) return null;
    return {
      type: 'FeatureCollection',
      features: [gpx.geojson],
    };
  }, [gpx]);

  if (!data) return null;

  // The path color matches the 3D `gpxPath` layer (#00E5FF). We render
  // a faint wide casing under the bright line so it stays legible on
  // both the dark and light basemaps.
  const casing: LineLayerSpecification = {
    id: 'gpx-casing',
    type: 'line',
    source: 'gpx',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#000000',
      'line-opacity': 0.35,
      'line-width': 6,
    },
  };
  const stroke: LineLayerSpecification = {
    id: 'gpx-stroke',
    type: 'line',
    source: 'gpx',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#00E5FF',
      'line-width': 3,
    },
  };

  return (
    <Source id="gpx" type="geojson" data={data}>
      <Layer {...casing} />
      <Layer {...stroke} />
    </Source>
  );
}
