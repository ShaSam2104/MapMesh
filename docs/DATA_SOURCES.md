# Data Sources

## AWS Open Data Terrain Tiles (Mapzen Terrarium)

- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Format: PNG where each pixel encodes elevation as `(R*256 + G + B/256) - 32768` meters.
- Default zoom: **z=13** (≈ 19 m/pixel at the equator, sufficient for a 2 km print).
- Fallback: if z=14+ returns 404, step down automatically.
- License: public domain / ODbL depending on the underlying source dataset. Attribution required.
- [Registry page](https://registry.opendata.aws/terrain-tiles/).

Attribution is displayed in the app footer.

## OpenStreetMap (via Overpass API)

- Endpoint: `https://overpass-api.de/api/interpreter`
- Single consolidated query pulls buildings, roads, water, grass/parks, sand/beach, and piers in one round trip.
- Response → `osmtogeojson` → FeatureCollection.
- License: **ODbL**. Attribution `© OpenStreetMap contributors` is required on any derivative map or mesh.
- [OSM copyright](https://www.openstreetmap.org/copyright).

The user's physical prints must include an OSM attribution label (future feature: auto-etch into the plinth side).

## Strava GPX files (user-provided)

- Parsed client-side via `@tmcw/togeojson`.
- **Never uploaded anywhere.** No server. No telemetry.
- We log only the file name and resulting `(pointCount, distanceKm)` at `info` level.
- Privacy policy: stays on the user's machine until they explicitly export.

## MapLibre demo tiles / CARTO dark matter

- Light basemap: [MapLibre demo tiles](https://demotiles.maplibre.org/style.json).
- Dark basemap: CARTO Dark Matter — `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`.
- Attribution: displayed in the map footer.
