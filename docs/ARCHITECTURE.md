# Architecture

## Module boundaries

```
┌─────────────────────────────────────────────────┐
│  src/components/    React UI (prop-driven)      │
│    layout/ map/ scene/ controls/ ui/            │
└─────────────────────────────────────────────────┘
             │ selectors / actions
             ▼
┌─────────────────────────────────────────────────┐
│  src/state/store.ts  (zustand, flat)            │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  src/hooks/         (orchestration)             │
│    useGenerateMesh, useAutoRebuild,             │
│    useGeolocation, useTheme                     │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  src/lib/    framework-free TypeScript           │
│    geo/ data/ geometry/ manifold/ exporters/    │
│    fonts/ log/ palette.ts                       │
└─────────────────────────────────────────────────┘
```

## Why `src/lib/` is framework-free

Every future embedding target (Shopify app block, Medusa storefront plugin, a Node worker) can import `buildWatertightPlinth`, `exportSTL`, `export3MF` without dragging React/zustand along. It also makes the core trivially testable in isolation.

Enforcement: [`src/lib/CLAUDE.md`](../src/lib/CLAUDE.md) — pure TS, no React, no zustand, no DOM APIs except in files explicitly named `*.browser.ts`.

## Why components do not import from `lib/data` / `lib/manifold`

Components read from the store and emit intent through actions. Anything with side effects (network, WASM, heavy compute) lives in `lib/` and is orchestrated by hooks, never by JSX. This prevents subtle re-fetch / re-compute bugs on every render.

Enforcement: [`src/components/CLAUDE.md`](../src/components/CLAUDE.md).

## State ownership

A single zustand store. Flat shape. The `layers` slice is a `Record<LayerKey, LayerConfig>` so that the Style tab can `.map()` over 8 layers with zero repeated JSX.

The store never stores `HTMLElement`, `Map` instances, or other non-serializable things. It stores plain data + `THREE.BufferGeometry` / `Manifold` handles that are meaningful to the scene + exporters.

## The Pipeline boundary

The generation pipeline is a chain of pure functions in `src/lib/` orchestrated by `src/hooks/useGenerateMesh.ts`. It is split into two phases so slider edits don't re-fetch the network:

1. **`ensureRawData(selection)`** — fetches Terrarium + Overpass (or reads `mesh.rawCache` if the selection fingerprint matches). Returns `{ fingerprint, grid, classified, gpxGeojson }`.
2. **`rebuildFromRaw(raw, selection, layers, gpx, textLabels)`** — pure, synchronous-ish. Runs classify → clip → build layers → compute flange specs → build plinth (with flanges) → resolve font buffers → build + place text glyph geometries → commit. Returns `{ plinthManifold, plinthGeometry, layerGeometries, textLabelGeometries, plinthTopZ }`.

`src/hooks/useAutoRebuild.ts` mounts once at the app root and debounces `rebuild()` on changes to rebuild-affecting fields (base thickness, exaggeration, layer widths/offsets/heightScale, text labels, gpx). Colour / visibility / export toggles are skipped because the scene reads them directly from store selectors.

See [`PIPELINE.md`](PIPELINE.md) for the full diagram, and [`FONTS.md`](FONTS.md) for the text-label branch of the pipeline.

## Shopify / Medusa future-proofing

- `src/components/scene/SceneCanvas.tsx` takes geometry via props.
- A thin `<ConnectedSceneCanvas>` wrapper bridges store → canvas.
- A future Shopify app block imports `buildWatertightPlinth` + `exportSTL` + renders with its own `<SceneCanvas>`.
- See [`ROADMAP.md`](ROADMAP.md).
