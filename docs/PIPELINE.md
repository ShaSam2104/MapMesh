# Generation Pipeline

The critical contract of MeshMap. Implemented as pure functions in `src/lib/`, orchestrated by `src/hooks/useGenerateMesh.ts` — split into two phases (**`ensureRawData`** + **`rebuildFromRaw`**) so that slider edits never re-fetch Overpass or Terrarium.

```
 ┌──────────────┐
 │  Selection   │  {center, shape, sizeKm, rotation}
 └──────┬───────┘
        │
 ┌──────▼────────────────────────────────────────────┐
 │ lib/geo/projection.ts    @math.gl/web-mercator    │
 │ lib/geo/bbox.ts          @turf/turf bbox          │
 │ lib/geo/shapes.ts        THREE.Shape + turf poly  │
 └──────┬────────────────────────────────────────────┘
        │
    ┌───┴───────────────────────────┐
    │                               │
 ┌──▼────────────────┐   ┌──────────▼──────────────────┐
 │ lib/data/         │   │ lib/data/                   │
 │ terrarium.ts      │   │ overpass.ts + osmFeatures   │
 │ (elevation grid)  │   │ (one consolidated query)    │
 └──┬────────────────┘   └──────────┬──────────────────┘
    │                               │
 ┌──▼────────────────────────┐   ┌──▼─────────────────────────┐
 │ lib/geometry/             │   │ lib/geometry/              │
 │ terrainPlane.ts           │   │ buildings.ts               │
 │ (PlaneGeometry displaced) │   │ areaSlab.ts                │
 │                           │   │ lineStrip.ts               │
 └──┬────────────────────────┘   └──┬─────────────────────────┘
    │                               │
    └───────────┬───────────────────┘
                │
 ┌──────────────▼────────────────────────────────────┐
 │ lib/manifold/buildWatertightPlinth.ts             │
 │                                                   │
 │  1. Lazy-init manifold-3d WASM (singleton)        │
 │  2. Build prism from 2D selection via             │
 │     Manifold.extrude(crossSection, height)        │
 │  3. Wrap terrain+walls+base into a Manifold       │
 │  4. Validate: numTri > 0 && status === Valid      │
 │                                                   │
 │ Returns { renderGeometry, manifold }              │
 └──────────────┬────────────────────────────────────┘
                │
       ┌────────┴─────────┐
       │                  │
 ┌─────▼──────┐    ┌──────▼──────────────────────────┐
 │  RENDER    │    │  EXPORT                         │
 │            │    │                                 │
 │  R3F scene │    │  On Download:                   │
 │  consumes  │    │  1. Start with stored Manifold  │
 │  per-layer │    │  2. Union merged buildings      │
 │  Buffer-   │    │  3. Optionally union GPX tube   │
 │  Geometry  │    │  4. → BufferGeometry for STL    │
 │            │    │     or → geom3 for 3MF          │
 │            │    │  5. exportSTL / export3MF       │
 │            │    │  6. download(blob, filename)    │
 └────────────┘    └─────────────────────────────────┘
```

## Why terrain + walls + base go through manifold-3d

Building a watertight plinth from a heightfield is precision-critical boolean work. manifold-3d guarantees manifold output by construction. This is the single point of trust for the reliability mandate.

## Why buildings live outside the plinth manifold until export

Real-time preview needs instant material swaps when the user drags color pickers. Rebuilding a manifold on every color change would be wasteful. At export time, we do the final union once.

## Error handling

- Each step is awaited inside `useGenerateMesh`. On failure, the store transitions to `status: 'error'`, the error message is set, and the UI error boundary renders a graceful fallback.
- Network errors (Terrarium, Overpass) retry up to 2x with backoff.
- Manifold validation failures surface as `"watertight plinth invalid"` with the plinth stats logged at `error` level.

## Status transitions

```
idle → fetching → building → ready
                            ↘
                             error
```

The `fetching` stage covers both Terrarium and Overpass (parallel). `building` covers terrain + plinth + per-layer geometry assembly.

## Two-phase generate: `ensureRawData` + `rebuildFromRaw`

Early versions rebuilt everything on every parameter change, which re-hit Terrarium + Overpass for slider drags — a 2–5 second network round-trip for a one-pixel move. `useGenerateMesh` now splits the work so the network part runs at most once per selection.

```
                         ┌────────────────────────────────────────┐
                         │ Selection fingerprint:                 │
                         │ `${lng}|${lat}|${shape}|${size}|${rot}`│
                         │ (6-decimal precision)                  │
                         └────────────────┬───────────────────────┘
                                          │
              ┌───────────────────────────┴─────────────────────────────┐
              │                                                         │
       fingerprint matches                                      fingerprint differs
       mesh.rawCache?                                           from mesh.rawCache?
              │                                                         │
              │ yes (cache hit)                                          │ no (cache miss)
              ▼                                                         ▼
   ┌─────────────────────────┐                   ┌────────────────────────────────────┐
   │ ensureRawData:          │                   │ ensureRawData (slow path):         │
   │  return cached raw      │                   │  1. Terrarium fetch + decode       │
   │  (no network)           │                   │  2. Overpass one-query fetch       │
   └──────────┬──────────────┘                   │  3. classify + clip                │
              │                                  │  4. store.setRawCache({...})       │
              │                                  └──────────┬─────────────────────────┘
              │                                             │
              └──────────────────────┬──────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────────────────┐
                      │ rebuildFromRaw(raw, selection, layers,   │
                      │                gpx, textLabels)          │
                      │                                          │
                      │  • terrain displacement                  │
                      │  • build buildings / roads / water /     │
                      │    grass / sand / piers / gpxPath        │
                      │    (heightScale, widthMeters applied)    │
                      │  • computeFlangeSpecs(textLabels, bbox)  │
                      │  • buildWatertightPlinth(..., flanges)   │
                      │  • resolve font buffers (cached) → build │
                      │    + place text glyph geometries         │
                      │  • store.setMeshResult({...})            │
                      └──────────────────────────────────────────┘
```

**Cache key.** Only fields that change the OSM / Terrarium bbox invalidate the cache: `center`, `shape`, `sizeKm`, `rotationDeg`. `baseThicknessMm`, `exaggeration`, layer `widthMeters` / `heightScale`, text labels, and colours **do not** invalidate it — they flow straight into `rebuildFromRaw`.

**Auto-rebuild.** `src/hooks/useAutoRebuild.ts` subscribes to the store and debounces `rebuild()` on any change to rebuild-affecting fields:

- **150 ms** debounce for slider-driven params (base thickness, exaggeration, widths, height scale, layer offsets, gpx).
- **250 ms** debounce for text-label edits (font fetch cost).
- Colour / visibility / `includeInExport` toggles are skipped — they never trigger a rebuild because `FeatureLayer` + `TerrainMesh` read them directly from store selectors.

The Generate button still exists and is wired to `generate()`, which calls `ensureRawData` + `rebuildFromRaw` unconditionally. It is the only escape hatch for forcing a fresh fetch (e.g. after picking a new area).

## Plinth flanges + raised text labels

Text labels live on the **outer faces of plinth flanges**, not on the plinth top. A flange is a rectangular tab extending outward from one of the four cardinal sides; it gives each label a flat, watertight canvas.

```
       ┌──── plinth top ────┐
       │                    │
       │     terrain +      │
       │      layers        │
       │                    │          ← TextLabels group (absolute mm)
       └────────────────────┘
         ╰╌╌╌ flange tab ╌╌╌╯          ← extended plinth polygon before extrude
```

Pipeline for text, run inside `rebuildFromRaw` after the raw data phase:

```
 textLabels[] ──▶ computeFlangeSpecs(labels, plinthBbox, rotationDeg)
                    │
                    │  FlangeSpec[]
                    │  { side, widthMm, depthMm, baseThicknessMm,
                    │    outerFaceCenter, outwardNormal, edgeTangent }
                    │
                    ▼
 buildWatertightPlinth({ ..., flanges })
   │  ├─ CrossSection.union([selectionPolygon, ...flangeRects])
   │  └─ Manifold.extrude(cs, baseThicknessMm) ─▶ single watertight prism
   │
   ▼  (same Manifold used at export time — no re-union)
 For each TextLabel:
   1. googleFonts.browser.ts · fetchFontBuffer(family, variant)
        ├─ CSS2 fetch (fonts.googleapis.com/css2?family=...)
        ├─ extract `src: url(...) format('woff2')`
        ├─ fetch WOFF2
        ├─ wawoff2.decompress() → OTF ArrayBuffer
        └─ in-memory Promise cache (per family|variant)
   2. buildTextGeometry.ts
        opentype.parse(otf) → font.getPath(content, 0, 0, letterHeightMm)
        → ShapePath → THREE.Shape[]
        → THREE.ExtrudeGeometry({ depth: extrusionMm, bevelEnabled: false })
   3. placeTextOnFlange.ts
        Matrix4.makeBasis(edgeTangent, worldUp, outwardNormal)
        → alignment shift (L / C / R) + offsetMm along the edge
        → translate to outerFaceCenter
        → BufferGeometry in absolute print mm
   4. setMeshResult({ textLabelGeometries: { [label.id]: geom, ... } })
```

The **plinth stays a single watertight prism** — flanges are polygon extensions applied *before* `extrude`, not separate manifolds unioned afterwards. Text geometries sit on top of that prism as discrete BufferGeometries; they are never booleaned into the plinth, which keeps rebuild time low and lets the 3MF exporter emit one coloured part per label.

See [`docs/FONTS.md`](FONTS.md) for how the Google Fonts snapshot is built and refreshed.
