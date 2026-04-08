# Testing

Testing is a first-class concern, not an afterthought. Every layer has a test pattern; every PR-equivalent commit adds tests for the code it touches.

## Layers

| Layer | Runner | Library | What it asserts |
|---|---|---|---|
| Pure functions (`src/lib/**`) | Vitest | — | deterministic input → output |
| React components (`src/components/**`) | Vitest + jsdom | `@testing-library/react` + `user-event` | rendering, a11y, keyboard, store integration |
| R3F scenes (`src/components/scene/**`) | Vitest | `@react-three/test-renderer` | scene-graph shape, material props |
| Hooks (`src/hooks/**`) | Vitest | `renderHook` | state transitions |
| Network I/O (`src/lib/data/**`) | Vitest | **MSW** | HTTP mocked with fixtures |
| Integration | Vitest | MSW + fixtures | full `useGenerateMesh` walkthrough |
| E2E happy path | Playwright | — | load → select → generate → download |

## Fixtures

Real captured fixtures live in `tests/fixtures/`:

- `mumbai-terrarium-13.png` — real Terrarium tile.
- `mumbai-overpass.json` — curated small area, ~20 buildings, ~5 roads.
- `sample-strava.gpx` — minimal GPX from Mumbai.
- `expected-plinth-cube.json` — known-good manifold output shape for regression.

## MSW

`tests/msw/handlers.ts` serves the fixtures for any `/terrarium/{z}/{x}/{y}.png` or Overpass POST. No real network in the test suite.

```ts
// tests/setup.ts
import { server } from './msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Coverage gates

- `src/lib/**` ≥ 90%
- `src/hooks/**` ≥ 90%
- `src/components/**` ≥ 75%

Thresholds live in `vitest.config.ts`.

## Running

```bash
npm run test            # watch mode
npm run test:run        # single run (CI)
npm run test:coverage   # with thresholds
npm run test:e2e        # playwright happy path
```

## What gets tested

### `lib/geo/projection.ts`
- `(19.0760, 72.8777) → (0, 0)` when that's the origin
- 1° of longitude at lat 0 → 111320 m ± 1 m
- 1° of longitude at lat 40 → 85395 m ± 1 m (verifies `cos(lat)` scaling)
- Round-trip lngLat → world → lngLat within 1 cm

### `lib/data/terrarium.ts`
- Given a fixture PNG with known RGB pixels, decoded elevation matches `(R*256 + G + B/256) - 32768`
- Bbox → tile-set math across tile boundaries
- 404 detection + zoom step-down

### `lib/geo/shapes.ts`
- Square vertices form a rectangle of the expected bbox
- Circle polygon has 64 verts and `turf.area` matches `π r²` within 1%
- Hexagon polygon has 6 verts and is symmetric about its center

### `lib/manifold/buildWatertightPlinth.ts`
- Flat zero grid + 1 km square → expected dims `1000 × 1000 × baseThickness mm` and valid
- Ramp grid → expected gradient on top face
- `numTri > 0`, `numVert > 0`, `status === NoError`

### `lib/exporters/toJscadGeom3.ts`
- Unit cube BufferGeometry → `geom3` has 12 polygons
- Triangle winding preserved (signed volume > 0)

### `lib/exporters/exportSTL.ts` / `export3MF.ts`
- Unit cube → non-zero blob
- STL binary header + triangle count bytes match expectation
- 3MF ZIP contains `3D/3dmodel.model` entry

### Components
- Every control renders with correct ARIA roles and labels
- Keyboard-operable (Tab, Space, Enter, arrows)
- Store reads/writes work (fresh store per test, no mocks for zustand)

### R3F scene
- `TerrainMesh` with a provided geometry prop renders a single Mesh node with that geometry + the configured material color
- `Buildings` renders N extruded children for N-element input
- `GpxPath` material is emissive cyan with the configured tube params
