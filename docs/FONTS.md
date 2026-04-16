# Fonts

How MeshMap turns arbitrary Google Fonts families into raised-letter geometry on plinth flanges.

See [`docs/PIPELINE.md`](PIPELINE.md) for the high-level pipeline and [`docs/LIBRARIES.md`](LIBRARIES.md) for dependency rationale.

## Why Google Fonts

- **Licensing.** The entire Google Fonts catalogue ships under permissive licences (OFL / Apache 2.0) compatible with embedding glyph outlines in user-generated 3D-printable files.
- **Stable delivery.** The CSS2 endpoint (`https://fonts.googleapis.com/css2?family=…`) is a long-lived, unauthenticated API. No API key, no quota churn.
- **Discoverability.** Users already know the catalogue — when they want "Racing Sans One" they know what it looks like without us having to curate a preview.

## Runtime architecture

```
User picks family + variant in TextTab
        │
        ▼
src/lib/fonts/googleFonts.browser.ts
        │
        │  fetchFontBuffer(family, variant)
        │
        │  1. GET https://fonts.googleapis.com/css2?family=<family>
        │     → parse `src: url(https://.../<hash>.woff2) format('woff2')`
        │  2. GET the WOFF2 URL
        │  3. Lazy-import wawoff2 (WASM) on first use
        │     → wawoff2.decompress(woff2Buffer) → OTF ArrayBuffer
        │  4. Cache the Promise by `${family}|${variant}` so concurrent
        │     callers share the in-flight request. Failures are NOT
        │     cached — a transient network blip doesn't poison the slot.
        │
        ▼
src/lib/geometry/buildTextGeometry.ts
        │
        │  opentype.parse(otfBuffer)
        │  font.getPath(content, 0, 0, letterHeightMm)
        │  ShapePath commands → THREE.Shape[]   (format adapter only)
        │  THREE.ExtrudeGeometry({ depth: extrusionMm, bevelEnabled: false })
        │  three-stdlib mergeBufferGeometries(...)
        │
        ▼
Flat XY glyph BufferGeometry with `{ widthMm, heightMm }`
```

Placement onto a plinth flange (`src/lib/geometry/placeTextOnFlange.ts`) is pure `Matrix4` math: `makeBasis(edgeTangent, worldUp, outwardNormal)` + alignment shift + offset + translate to the flange outer-face centre. No custom geometry code — golden rule #1.

## The snapshot (`googleFontsListFull.json`)

`src/lib/fonts/googleFontsListFull.json` is a stripped snapshot of the full Google Fonts catalogue, shipped in the bundle. It exists because:

1. The public metadata endpoint `https://fonts.google.com/metadata/fonts` does not send CORS headers, so we cannot hit it at runtime from the browser.
2. We want the picker to work offline, and we want instant search with no `useEffect` fetch.
3. The full payload is ~2.5 MB of JSON, of which we only need `{ family, variants, category }`. Stripping it brings the shipped file to ~140 KB uncompressed (≈40 KB gzipped).

### Refreshing the snapshot

Whenever Google adds new families or drops old ones, regenerate:

```bash
# 1. Pull the raw upstream metadata (no auth required).
curl -s 'https://fonts.google.com/metadata/fonts' -o /tmp/gfonts.json

# 2. Run the strip script (see below) to write the snapshot.
python3 scripts/build-google-fonts-snapshot.py   # or inline, see below

# 3. Bump GOOGLE_FONTS_REVISION in src/lib/fonts/googleFontsList.ts
#    (it reads `revision` from the JSON — bump inside the JSON).
```

If you prefer not to keep a script file around, run it inline. This is the script we use:

```python
import json

with open('/tmp/gfonts.json') as fp:
    d = json.load(fp)
fams = d.get('familyMetadataList', [])

def norm_category(c):
    c = (c or '').lower().replace(' ', '-')
    return c if c in ('sans-serif', 'serif', 'display', 'handwriting', 'monospace') else 'sans-serif'

def norm_variants(fonts):
    # v1 only consumes "regular"; always ship it so the picker can
    # select the family even if upstream only lists e.g. 700.
    out = ['regular']
    if '700' in fonts: out.append('700')
    return out

out = []
for f in fams:
    fam = f.get('family')
    if not fam: continue
    out.append({
        'family': fam,
        'variants': norm_variants(f.get('fonts', {})),
        'category': norm_category(f.get('category', '')),
    })
out.sort(key=lambda x: x['family'].lower())

with open('src/lib/fonts/googleFontsListFull.json', 'w') as fp:
    json.dump({'revision': '<today>', 'families': out}, fp, separators=(',', ':'))
```

After regenerating, run `npm run test:run` — the test in `src/lib/fonts/googleFontsList.test.ts` asserts:

- the list contains `> 1500` families (guard against accidental truncation),
- every family has at least `"regular"` in its `variants`,
- `Racing Sans One` is present (regression guard for the v1 curated-list mistake).

### Free-text fallback

`src/components/controls/GoogleFontPicker.tsx` shows a `Use "<query>"` option whenever the typed query has no exact match in the snapshot. Clicking it passes the typed string straight through as `fontFamily`. The CSS2 fetch in `googleFonts.browser.ts` will then either succeed (and the label renders) or fail (the label is skipped with a `warn` log). This means:

- **Stale snapshot is survivable.** A brand-new Google Fonts family added upstream after our last snapshot still works if the user knows the exact name.
- **Typos don't poison the mesh.** A typo'd family name fails the CSS2 fetch and is skipped; other labels + the rest of the scene keep working.

## Caching layers

There are two caches on the font path, both in-memory (no localStorage):

| Cache | Where | Key | Lifetime |
|---|---|---|---|
| Font buffer | `googleFonts.browser.ts` module-level `Map` | `${family}\|${variant}` | Tab lifetime. Cleared on full reload. Test hooks: `__resetFontCacheForTests()`. |
| Text geometry | `mesh.textLabelGeometries` in the zustand store | `TextLabel.id` | Until the label is removed or a rebuild replaces it. |

Concurrent calls to `fetchFontBuffer(family, variant)` share the stored `Promise` so an in-flight fetch is never duplicated. On failure the Promise is evicted so the next call retries cleanly.

## Testing notes

- Unit tests **do not** hit the real CSS2 endpoint. `googleFonts.browser.test.ts` uses `__setFetchForTests` + `__setDecompressForTests` DI hooks to swap in fakes.
- `buildTextGeometry.test.ts` generates a tiny runtime font via `new opentype.Font({...})` with a single triangle glyph — no fixture `.otf` file is checked in.
- Full round-trip coverage (real Google Fonts → real manifold WASM → real 3MF) lives in the Playwright happy-path suite, because manifold-3d's WASM does not load reliably under jsdom.
