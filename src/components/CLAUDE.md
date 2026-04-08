# `src/components/` conventions

## Rules

1. **Components are prop-driven and state-consuming only.** They read via zustand selectors and emit intent via store actions. They do not call functions from `src/lib/data/*` or `src/lib/manifold/*` directly — that is the job of `src/hooks/useGenerateMesh.ts`.
2. **No direct library imports for heavy things.** Importing `three`, `@react-three/fiber`, `react-map-gl`, `@turf/turf` is fine. Importing `manifold-3d` from a component is a red flag.
3. **No DOM mutation.** No `document.*`, no `map.on(...)`. All side effects go through hooks or `src/lib/*/browser.ts` files.
4. **Accessibility.** Every interactive element has an accessible name. Keyboard operable (Tab, Space, Enter, arrows on sliders).
5. **Components are pure functions of props + store state.** No module-level mutable state.

## Structure

```
components/
  layout/     AppShell, Header, NavRail, SplitPane, InspectorDrawer
  map/        MapView, SelectionOverlay
  scene/      SceneCanvas, TerrainMesh, FeatureLayer, Buildings, Roads, Water, Grass, Sand, Piers, GpxPath
  controls/   ShapeSelector, SizeSlider, LayerAccordion, LayerRow, LayerBody, ColorSwatch, GpxUploader, ExportPanel, ...
  ui/         Button, Slider, Segmented, Tabs, Tooltip, Drawer
```

## Testing

Every component file has a sibling `*.test.tsx`. R3F scene components use `@react-three/test-renderer`; everything else uses `@testing-library/react`.
