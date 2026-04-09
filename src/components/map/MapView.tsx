import Map, { NavigationControl, AttributionControl } from 'react-map-gl/maplibre';
import { useStore } from '@/state/store';
import { SelectionOverlay } from './SelectionOverlay';
import { GpxOverlay } from './GpxOverlay';

// Both styles come from CartoDB's free basemap CDN. Positron is the canonical
// light counterpart to Dark Matter — real OSM street data, not the MapLibre
// `demotiles` placeholder (which is a cartoonish world outline with no streets).
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export function MapView(): JSX.Element {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const theme = useStore((s) => s.theme);

  return (
    <div className="h-full w-full relative bg-bg-2">
      {/* Controlled mode — react-map-gl mirrors longitude/latitude/zoom from
          the store, so programmatic recenters (e.g. GPX upload) actually
          move the map. Bare `initialViewState` would only apply on mount. */}
      <Map
        longitude={view.center[0]}
        latitude={view.center[1]}
        zoom={view.zoom}
        mapStyle={theme === 'dark' ? STYLE_DARK : STYLE_LIGHT}
        attributionControl={false}
        onMove={(e) =>
          setView({
            center: [e.viewState.longitude, e.viewState.latitude],
            zoom: e.viewState.zoom,
          })
        }
      >
        <NavigationControl position="bottom-right" />
        <AttributionControl
          compact
          customAttribution="© OpenStreetMap contributors"
        />
        <GpxOverlay />
        <SelectionOverlay />
      </Map>
    </div>
  );
}
