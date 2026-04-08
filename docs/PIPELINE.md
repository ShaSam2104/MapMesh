# Generation Pipeline

The critical contract of MeshMap. Implemented as pure functions in `src/lib/`, orchestrated by `src/hooks/useGenerateMesh.ts`.

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
