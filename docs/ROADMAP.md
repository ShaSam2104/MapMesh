# Roadmap

## v1 — scaffold (this milestone)

End-to-end standalone web app: select area → preview 3D → export STL / 3MF.

## v2 — Commerce embedding

### Shopify app block
- Package `src/lib/` + `src/components/scene/` as an embedded block for Shopify theme editor.
- Customer selects an area on a product page; the preview renders live; adding to cart attaches the `(bbox, selection, layers, gpx)` spec as a line item property.
- Backend worker replays the same `src/lib/` code server-side to produce the final print file.

### Medusa.js storefront plugin
- Medusa product module with a `meshmap.selection` metadata field.
- Storefront plugin renders the MeshMap preview on the product detail page.
- Checkout flow unchanged; the admin dashboard shows the rendered mesh for fulfillment.

### Embedding contract
- `src/lib/` is framework-free → can be imported into any bundler.
- `<SceneCanvas>` accepts all geometry via props → no store coupling.
- All network calls take plain bboxes and return plain data.
- Zero React hooks below `src/lib/`.

Enforced in [`src/lib/CLAUDE.md`](../src/lib/CLAUDE.md).

## Post-MVP features

- **Road carving** — union roads into the plinth as recessed grooves.
- **Water cutouts** — boolean-subtract water bodies from the top surface.
- **Save / share by URL hash** — encode `(center, zoom, shape, size, layers)` in the URL.
- **Custom polygon selection** — freehand lasso on the map.
- **Multi-tile stitching** — support selections > 3 km (currently ≤ 2×2 tiles at z=13).
- **Color-per-object 3MF** — use the 3MF materials extension so a multi-color printer can print each layer in a different filament.
- **Auto-etch OSM attribution** — carve `© OSM contributors` into a plinth side.
- **Remote log sink** — opt-in Sentry/Logtail integration for bug reports.
- **Print cost estimator** — Bambu / Prusa model → grams of filament → price estimate.
- **Photo-based texture bake** — project Mapbox satellite imagery as a texture onto the top face.
