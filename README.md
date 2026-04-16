# MeshMap

Generate 3D-printable city meshes from any map area, with optional Strava GPX overlay.

MeshMap is a web app that lets you pick an area on a map, previews a premium instrument-style 3D rendering of the terrain + buildings + roads + water + parks + piers, and exports a watertight **STL** or **3MF** file ready for PrusaSlicer or Bambu Studio.

Inspired by [map2model.com](https://map2model.com)'s "select area → preview → export" flow, elevated with a Cartographer's Workbench UI, a GPX path overlay, and raised-text labels on plinth sides.

## Features

- **Select any area** on a maplibre 2D map — square, circle, or hex selection, 0.5–3 km.
- **Instant parameter edits.** Slider changes (base thickness, vertical exaggeration, per-layer widths, building height scale) rebuild the geometry locally from cached raw data — Terrarium + Overpass only re-fetch when the selection itself changes.
- **GPX overlay.** Drop in a Strava track and it drapes over the terrain with auto-recenter.
- **Raised-text labels.** Pick any of the ~1929 Google Fonts families, set letter height / extrusion / side / alignment, and the text lands on a watertight flange extending the plinth.
- **Watertight exports.** STL (single merged solid) or 3MF (per-layer + per-label coloured parts) via manifold-3d + @jscadui/3mf-export.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. On first load, allow geolocation or it will fall back to Mumbai (19.0760, 72.8777).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the built bundle |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single-run (CI) |
| `npm run test:coverage` | Coverage report with thresholds |
| `npm run test:e2e` | Playwright end-to-end tests |

## How it works

```
Selection → Terrarium tiles → Overpass OSM → manifold-3d plinth → R3F preview → STL/3MF export
```

See [`docs/PIPELINE.md`](docs/PIPELINE.md) for the full data flow.

## Reliability

Every geometry operation, boolean, triangulation, and file export is delegated to a well-maintained library. No custom geometry math. See [`docs/LIBRARIES.md`](docs/LIBRARIES.md).

## Attribution

- **Terrain**: [AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen Terrarium format) — ODbL / public domain depending on source.
- **Map data**: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
- **Basemap**: Rasters via the MapLibre demo tiles; dark style via CARTO dark matter.
- **Libraries**: [three.js](https://threejs.org), [react-three-fiber](https://docs.pmnd.rs/react-three-fiber), [manifold-3d](https://github.com/elalish/manifold), [JSCAD](https://github.com/jscad), [MapLibre GL JS](https://maplibre.org), [turf](https://turfjs.org).

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PIPELINE.md`](docs/PIPELINE.md)
- [`docs/LIBRARIES.md`](docs/LIBRARIES.md)
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- [`docs/EXPORT_FORMATS.md`](docs/EXPORT_FORMATS.md)
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md)
- [`docs/TESTING.md`](docs/TESTING.md)
- [`docs/FONTS.md`](docs/FONTS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

## License

MIT — see [`LICENSE`](LICENSE).
