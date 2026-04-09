# MeshMap — Claude Code Project Context

MeshMap generates 3D-printable city meshes from a map area. See [`README.md`](README.md) for user-facing info.

## Golden rules (non-negotiable)

1. **No custom geometry code.** Every boolean, triangulation, extrusion, or format conversion is delegated to a maintained library. If a gap exists, flag it before writing math yourself.
2. **manifold-3d is the reliability backbone.** The watertight plinth is constructed and validated through `manifold-3d`. See [`src/lib/manifold/buildWatertightPlinth.ts`](src/lib/manifold/buildWatertightPlinth.ts).
3. **Components are prop-driven.** UI components consume state via zustand selectors; they never import from `lib/data/*`, `lib/manifold/*`, or touch `document.*` / `map.on()` directly.
4. **`src/lib/` is framework-free.** Pure TypeScript. No React, no zustand, no DOM-only APIs except in files explicitly named `*.browser.ts`.
5. **Tests ship with code, and tests follow the code — aggressively.** Every source file that exports a function or component has a sibling `.test.ts(x)` file. Missing tests fail CI. **When you change an implementation, you MUST update the sibling tests in the same change.** Do not preserve stale expectations to "keep the test green" — rewrite the test to assert the new correct behavior. Do not work around type errors in tests by adding `any` or `// @ts-expect-error`; rewrite the test to match the new API. If a rename changes `thicknessMm` → `thickness`, every test using the old name must be updated in the same commit, not left with an alias. Tests are a consequence of the implementation, not a constraint on it — when the behavior is wrong and the test is green, the test is wrong too.
6. **Units convention is `1 world unit = 1 print millimeter`.** All geometry in `src/lib/geometry/*`, `src/lib/manifold/*`, the R3F scene, and the STL/3MF exporters is in **print mm**. Real-world meters (from OSM, Terrarium, turf.buffer, projection helpers) are scaled to print mm exactly once at the builder boundary via `PRINT_SCALE_MM_PER_M = 0.1` (1:10000 physical) from [`src/lib/geo/printScale.ts`](src/lib/geo/printScale.ts). A 2 km selection → 200 mm print (fits a Bambu X1 256 mm bed). Layer parameters keep the `Mm` suffix (`heightOffsetMm`, `thicknessMm`, `baseThicknessMm`). The `widthMeters` parameter on `lineStrip` / `gpxTube` is the one documented exception because it is handed straight to `turf.buffer`, which operates in real-world meters.
7. **Target is consumer FDM printing, not resin.** Scale features so they're meaningful at a 0.4 mm nozzle. Thin wall features should be ≥ 0.8 mm in print; very small details get lost. Meshes exported to STL/3MF must be watertight per-volume: the plinth is built via `manifold-3d` (watertight by construction), and every layer geometry is a closed `ExtrudeGeometry` prism (no open-ended tubes).
8. **Logging is observability.** Every pipeline step logs start/end/timing through `src/lib/log/logger.ts` with a module tag.

## Tech stack (summary)

- Vite 5 + React 18 + TypeScript 5
- Tailwind 3 with CSS vars (dark/light via `class="dark"`)
- three.js r168 + @react-three/fiber 8 + @react-three/drei 9 + three-stdlib
- **manifold-3d** (WASM) for watertight mesh construction and validation
- **@jscad/modeling** + **@jscadui/3mf-export** + **fflate** for 3MF export
- **three-stdlib** `STLExporter` for STL export
- **react-map-gl** (maplibre variant) + **maplibre-gl** for the 2D map
- **@math.gl/web-mercator** for projections
- **@turf/turf** for GeoJSON ops (bbox, intersect, buffer, centroid)
- **osmtogeojson** for Overpass JSON → GeoJSON
- **@tmcw/togeojson** for GPX → GeoJSON
- **zustand** (single flat store)
- **consola** + ring buffer for logging

## Libraries ↔ responsibilities

Every geometry responsibility has a library owner.

| Responsibility | Library |
|---|---|
| Map rendering | react-map-gl (maplibre) |
| Lat/lon ↔ meters | @math.gl/web-mercator |
| Bounding box | @turf/turf |
| Selection polygon | THREE.Shape + @turf/turf |
| Terrarium tile decode | native fetch + ImageData |
| Terrain displacement | THREE.PlaneGeometry |
| Watertight plinth | manifold-3d |
| Overpass → GeoJSON | osmtogeojson |
| Building extrusion | THREE.ExtrudeGeometry |
| Road / pier thin strips | turf.buffer + ExtrudeGeometry |
| Feature clipping | turf.intersect |
| GPX parsing | @tmcw/togeojson |
| GPX 3D tube | THREE.TubeGeometry |
| Merging geometries | three-stdlib BufferGeometryUtils |
| STL export | three-stdlib STLExporter |
| 3MF export | @jscad/modeling + @jscadui/3mf-export |

See [`docs/LIBRARIES.md`](docs/LIBRARIES.md) for rationale and versions.

## Commands

```bash
npm run dev           # start dev server
npm run build         # production build
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test          # vitest watch
npm run test:run      # single run
npm run test:coverage # coverage gates
npm run test:e2e      # playwright
```

## Directory map

```
src/
  components/   React UI — prop-driven, no direct lib imports
  hooks/        Thin store/lib wrappers
  lib/          Framework-free TypeScript (the reliability core)
    geo/        projection + shapes + bbox
    data/       terrarium + overpass + gpx fetchers
    geometry/   three.js geometry builders (wired to libraries)
    manifold/   manifold-3d wiring + watertight plinth
    exporters/  STL + 3MF exporters
    log/        consola + ring buffer + timing
  state/        zustand store
docs/           all project docs (see README)
tests/          setup, msw handlers, fixtures, playwright e2e
```

## Coverage targets

- `src/lib/**` ≥ 90%
- `src/hooks/**` ≥ 90%
- `src/components/**` ≥ 75%

## Documentation

All docs live in [`docs/`](docs/). Root stays clean (only `README.md` + this file).

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, boundaries
- [`docs/PIPELINE.md`](docs/PIPELINE.md) — generation data flow
- [`docs/LIBRARIES.md`](docs/LIBRARIES.md) — every library, why chosen
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — Terrarium + OSM attribution
- [`docs/EXPORT_FORMATS.md`](docs/EXPORT_FORMATS.md) — STL, 3MF, slicer compat
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md) — visual tokens, type scale
- [`docs/TESTING.md`](docs/TESTING.md) — test philosophy + fixtures
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Shopify/Medusa v2 plans
