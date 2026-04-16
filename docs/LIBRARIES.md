# Libraries

Every library in MeshMap has a responsibility it owns. If something in the geometry pipeline doesn't have a library row in this table, it doesn't ship.

## Core

| Library | Version (target) | Responsibility |
|---|---|---|
| vite | ^5.4 | bundler / dev server |
| react | ^18.3 | UI framework |
| react-dom | ^18.3 | DOM renderer |
| typescript | ^5.6 | type system |
| tailwindcss | ^3.4 | utility CSS |

## 3D rendering

| Library | Version | Responsibility |
|---|---|---|
| three | ^0.168 | WebGL renderer, geometry primitives |
| @react-three/fiber | ^8.17 | React renderer for three.js |
| @react-three/drei | ^9.114 | OrbitControls, Environment, helpers |
| three-stdlib | ^2.33 | Maintained ESM re-export of `three/examples/jsm`. We import `STLExporter`, `BufferGeometryUtils`, etc. from here — **never from `three/examples/jsm/*` directly**. |

## Geometry reliability (the mandate)

| Library | Version | Responsibility |
|---|---|---|
| manifold-3d | ^2.5 | WASM CSG / manifold mesh library. Constructs and validates the watertight plinth. |
| @jscad/modeling | ^2.12 | JSCAD modeling kernel. Bridge to JSCAD exporters for 3MF. |
| @jscadui/3mf-export | ^0.2 | Emits `.3mf` archives from JSCAD `geom3`. |
| @jscadui/stl-export | ^0.1 | STL emitter (JSCAD). Kept as a validated fallback. |
| fflate | ^0.8 | ZIP backend for 3MF. |

## Geospatial

| Library | Version | Responsibility |
|---|---|---|
| @math.gl/web-mercator | ^4.0 | Lightweight lat/lon ↔ world meters. |
| @turf/turf | ^7.1 | GeoJSON ops: bbox, intersect, buffer, centroid, booleanPointInPolygon. |
| osmtogeojson | ^3.0 | Overpass JSON → GeoJSON FeatureCollection with correct multipolygon handling. |
| @tmcw/togeojson | ^6.0 | GPX → GeoJSON. |

## Fonts (raised text labels)

| Library | Version | Responsibility |
|---|---|---|
| opentype.js | ^1.3.4 | Parse OTF/TTF, produce glyph `ShapePath`s that feed straight into `THREE.ExtrudeGeometry`. The single source of truth for glyph outlines — we never hand-write path math. |
| wawoff2 | ^2.0.1 | WASM WOFF2 decompressor. Google Fonts serves WOFF2; opentype.js only understands OTF/TTF, so we pipe through wawoff2 once on first fetch. Loaded lazily via dynamic import so the WASM stays off the critical path until a user actually adds a text label. |
| @types/opentype.js | ^1.3.8 | Dev-only type declarations for opentype.js. |

## UI

| Library | Version | Responsibility |
|---|---|---|
| react-map-gl | ^7.1 (maplibre variant) | Declarative React wrapper around maplibre-gl. |
| maplibre-gl | ^4.7 | Peer dependency of react-map-gl. |
| zustand | ^5.0 | Flat single store. |
| react-colorful | ^5.6 | 2.8 KB color picker. |
| lucide-react | ^0.453 | Icons. |
| framer-motion | ^11.11 | Drawer/tab/reveal animations. |
| react-error-boundary | ^4.1 | Typed error boundary routing errors through consola. |
| @fontsource/fraunces | ^5 | Display font (wordmark + hero only). |
| @fontsource/geist-sans | ^5 | Body & UI font. |
| @fontsource/jetbrains-mono | ^5 | Mono / numerics. |

## Logging

| Library | Version | Responsibility |
|---|---|---|
| consola | ^3.2 | Structured tagged logger, ~10 KB. |

## Dev / testing

| Library | Version | Responsibility |
|---|---|---|
| vite-plugin-wasm | ^3.3 | manifold-3d WASM loading |
| vite-plugin-top-level-await | ^1.4 | manifold-3d needs top-level await |
| vitest | ^2.1 | test runner |
| @vitest/coverage-v8 | ^2.1 | coverage |
| jsdom | ^25 | DOM environment for tests |
| @testing-library/react | ^16 | component testing |
| @testing-library/user-event | ^14 | realistic interactions |
| @testing-library/jest-dom | ^6 | DOM matchers |
| msw | ^2.4 | mock Overpass + Terrarium HTTP in tests |
| @react-three/test-renderer | ^8.2 | headless R3F scene tests |
| @playwright/test | ^1.48 | E2E |
| eslint + @typescript-eslint | ^8 | linting |
| prettier | ^3 | formatting |

## Choices worth explaining

### Why `@jscadui/3mf-export` instead of a well-known three.js 3MF exporter

three.js does not have a first-party 3MF exporter. The JSCAD ecosystem has a stable, actively maintained one. The cost is a single conversion step (`BufferGeometry → geom3`) inside `src/lib/exporters/toJscadGeom3.ts`. Versus the alternative (writing a 3MF ZIP by hand), this is the reliable choice. Triangle winding is unit-tested.

### Why `three-stdlib` instead of `three/examples/jsm/*`

`three/examples/jsm` paths are not stable across three.js versions and are not officially an ESM package. `three-stdlib` is a community-maintained ESM re-export that pins known-good versions and releases semver-compatible updates.

### Why `@math.gl/web-mercator` instead of `proj4`

`@math.gl/web-mercator` is 40 KB, zero dependencies, one-purpose. `proj4` is 200 KB+ and overkill when we only ever do Web Mercator.

### Why `osmtogeojson` instead of hand-parsing `elements[]`

Overpass JSON has three node types and relations with multipolygon stitching. Writing this by hand is a footgun. `osmtogeojson` is the standard library used by every "OSM to something" project — get Features in, Features out, done.

### Why `@tmcw/togeojson` instead of `gpxparser`

`@tmcw/togeojson` is actively maintained, produces clean GeoJSON that feeds straight into turf, and handles Strava's GPX extensions (heart rate, power).

### Why `manifold-3d` instead of three.js CSG libraries

three.js CSG libraries (`three-bvh-csg`, `three-csg-ts`) are JavaScript implementations with known edge-case failures on heightfields. `manifold-3d` is Google's production-grade WASM CSG kernel used in Blender. It guarantees manifold output by construction. The 2.5 MB WASM download is lazy-loaded only on first Generate click.

### Why `opentype.js` + `wawoff2` for text

Text labels on plinth flanges need real-world font glyphs (not bitmap fonts, not a raster). Golden rule #1 forbids custom geometry, which rules out hand-rolled Bezier → polygon tessellators. opentype.js is the canonical JS library for parsing OTF/TTF and already produces `ShapePath` objects whose commands map 1:1 to `THREE.Shape`, so the only "conversion" code we write is a format adapter — not geometry. Google Fonts, however, only delivers WOFF2 from its CSS2 endpoint, which opentype.js cannot read. `wawoff2` is the Google-maintained WASM port of the upstream `woff2` decoder and is the smallest dependency that lets us accept arbitrary Google Fonts families without shipping thousands of pre-converted TTFs in the bundle.

See [`docs/FONTS.md`](FONTS.md) for the full pipeline and the `googleFontsListFull.json` snapshot refresh procedure.

## Upgrade notes

- **three** ↔ **@react-three/fiber**: React 18 + R3F 8 is the proven combo. Avoid R3F 9 / React 19 on this scaffold.
- **manifold-3d**: terse API; `docs/` captures our usage patterns; smoke-tests protect upgrades.
- **maplibre-gl 5+**: breaking changes to style spec; do not upgrade without testing both dark/light theme.
