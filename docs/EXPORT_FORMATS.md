# Export Formats

MeshMap exports to **STL** and **3MF** in v1. Both are in **millimeters**. Both are watertight by construction (manifold-3d).

## STL (binary)

- Exporter: `three-stdlib` `STLExporter`.
- Wrapper: `src/lib/exporters/exportSTL.ts`.
- Binary STL header: 80 bytes, followed by `uint32` triangle count, followed by `50 × triCount` bytes of triangles.
- Units: **millimeters**. Slicers interpret STL as "whatever unit you set" by convention — MeshMap writes at 1 unit = 1 mm.
- File naming: `meshmap_{lat}_{lon}_{shape}_{sizeKm}km.stl`.

## 3MF

- Exporter: `@jscad/modeling` + `@jscadui/3mf-export` + `fflate`.
- Wrapper: `src/lib/exporters/export3MF.ts`.
- Conversion: `BufferGeometry → @jscad/modeling geom3` via `src/lib/exporters/toJscadGeom3.ts`. Triangle winding is **preserved** (unit-tested via signed volume of a known cube).
- Units: **millimeters**. The 3MF format is explicit about units; JSCAD's 3MF writer emits `unit="millimeter"`.
- Archive layout (inside the `.3mf` ZIP):
  ```
  [Content_Types].xml
  _rels/.rels
  3D/
    3dmodel.model
    _rels/3dmodel.model.rels
  ```

## Slicer compatibility

| Slicer | STL | 3MF | Notes |
|---|---|---|---|
| PrusaSlicer | ✓ | ✓ | 3MF is preferred (preserves unit metadata) |
| Bambu Studio | ✓ | ✓ | 3MF is preferred |
| OrcaSlicer | ✓ | ✓ | Both work |
| Cura | ✓ | ✓ | Both work |
| Simplify3D | ✓ | — | STL only |

## Recommended print settings

- **Scale**: 1:1 as exported. Plinth base is configurable (default 6 mm).
- **Layer height**: 0.12 mm for detail; 0.2 mm for speed.
- **Walls**: 3 perimeters; buildings have enough thickness from extrusion.
- **Infill**: 15% gyroid is sufficient.
- **Supports**: not required for the default plinth form factor.

## Watertightness verification

Before any export, the plinth Manifold is validated:

```ts
if (manifold.numTri() === 0 || manifold.status() !== Manifold.Status.NoError) {
  throw new Error('watertight plinth invalid');
}
```

If validation fails, the export button is disabled and the error is surfaced to the user through the error boundary.
