# `src/lib/` conventions

## Hard rules

1. **Pure TypeScript.** No React. No JSX. No hooks.
2. **No zustand.** `src/lib/` functions take plain inputs and return plain outputs.
3. **No DOM-only APIs** (no `document`, `window`, `navigator`) except in files explicitly named `*.browser.ts`. Those files are the only escape hatch and must be explicitly imported.
4. **Every exported function has JSDoc.** Describe inputs, outputs, and any assumptions about units.
5. **Every exported function has a sibling `*.test.ts`.**
6. **Units must be explicit.** Every parameter/return in `lib/geometry`, `lib/manifold`, `lib/exporters` is in **millimeters**. Every parameter in `lib/geo` is in **lng/lat (degrees)** or **meters**, documented.

## Why these rules

- `src/lib/` is the embedding contract for v2 (Shopify / Medusa). Framework-freedom makes it trivially portable.
- Pure functions are trivially testable and parallelizable in workers if we ever need that.
- Unit explicitness prevents the single most common class of bug in geometry code (1000× or 1/1000× scale errors).

## Logging

Every module imports the root logger and creates a tagged child:

```ts
import { logger } from '@/lib/log/logger';
const log = logger.withTag('terrarium');
```

Use `log.time('fetch tiles')` → `done()` for measured sections.

## File organization

```
lib/
  geo/          projection, shapes, bbox
  data/         terrarium, heightSampler, overpass, osmFeatures, osmQueries, gpx
  geometry/     shapes3d, polygonToShape, terrainPlane, plinthPrism, buildings, areaSlab, lineStrip, gpxTube
  manifold/     loader, fromBufferGeometry, toBufferGeometry, buildWatertightPlinth
  exporters/    download, exportSTL, export3MF
  log/          logger, ringBuffer, timing, browser
  palette.ts    default mesh colors
```
