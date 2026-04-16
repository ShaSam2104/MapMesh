/**
 * Text geometry builder.
 *
 * Consumes an OTF/TTF font buffer and a UTF-8 string, produces a flat
 * (XY-plane) extruded `THREE.BufferGeometry` in **print millimeters**.
 *
 * Pipeline:
 *   opentype.parse(buffer)               → Font
 *   font.getPath(content, 0, 0, letterH) → opentype Path (glyph outlines)
 *   path.commands → THREE.ShapePath       → [] of THREE.Shape (hole detection)
 *   [shape]      → THREE.ExtrudeGeometry  → per-glyph 3D prism
 *   mergeGeometries                       → single BufferGeometry
 *
 * We use `THREE.ShapePath` because it already knows how to group
 * contours into outer shapes + holes based on winding order — which is
 * exactly the "path command → shape" adapter we need and explicitly
 * rules out writing custom triangulation math (golden rule #1).
 *
 * Y-axis note: opentype.js emits path commands in a y-down coordinate
 * system (fonts inherited SVG / canvas convention). Three.js extrusion
 * expects y-up and counter-clockwise outer contours. We negate y as we
 * feed each command into the `ShapePath`, which is equivalent to
 * mirroring the glyph across the x-axis — after that, outer contours
 * become CCW in the y-up frame and `toShapes` detects holes correctly.
 *
 * ## Caching
 *
 * Building a text mesh is the most expensive per-rebuild operation in
 * the auto-rebuild path. Two caches make repeated rebuilds (slider
 * drags, text offset edits, etc.) near-instant:
 *
 *   1. **Font parse cache** (`WeakMap<ArrayBuffer, opentype.Font>`) —
 *      so re-parsing a 300 KB OTF is only paid once per page load.
 *   2. **Built-geometry cache** (per-font LRU keyed by content +
 *      letterHeightMm + extrusionMm + curveSegments) — so dragging an
 *      unrelated slider (offset, side, alignment, color, base
 *      thickness, exaggeration) returns the already-built glyph mesh
 *      without touching ExtrudeGeometry at all.
 *
 * **Ownership:** on a cache hit, `buildTextGeometry` returns the
 * **same** BufferGeometry reference the cache holds. Callers must not
 * call `.dispose()` on it — downstream `placeTextOnFlange` clones it
 * before applying transforms, so no caller ever needs to own the
 * returned buffer directly.
 *
 * @module lib/geometry/buildTextGeometry
 */

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import opentype from 'opentype.js';
import type { Path as OpentypePath, PathCommand } from 'opentype.js';
import { tagged } from '@/lib/log/logger';

const log = tagged('text-geometry');

/**
 * Default extrude curve subdivisions. Lower = faster, slightly less
 * smooth glyphs. 4 is still visibly smooth at print scale (text height
 * 3–30 mm) and roughly halves the triangle count vs. the three.js
 * default of 12.
 */
const DEFAULT_CURVE_SEGMENTS = 4;

/** Upper bound on cached geometries per font. Simple insertion-order LRU. */
const MAX_GEOMS_PER_FONT = 64;

export interface BuildTextGeometryOptions {
  /** Letter height in **print mm**. Mapped to the font's em-size. */
  letterHeightMm: number;
  /** Extrusion depth (relief height) in **print mm**. */
  extrusionMm: number;
  /** Extrude curve subdivisions. Higher = smoother glyphs, slower. */
  curveSegments?: number;
}

export interface BuildTextGeometryResult {
  /** Flat XY geometry; depth in +Z. */
  geometry: THREE.BufferGeometry;
  /** Bounding-box width along X in print mm. */
  widthMm: number;
  /** Bounding-box height along Y in print mm. */
  heightMm: number;
}

interface FontCacheEntry {
  /** Parsed font, or `null` if `opentype.parse` threw on this buffer. */
  font: opentype.Font | null;
  /**
   * Per-font built-geometry cache. Keyed by
   * `${letterHeightMm}|${extrusionMm}|${curveSegments}|${content}`.
   * Insertion order doubles as an LRU: on hit we delete+re-set to move
   * the entry to the end of the iteration order; eviction pops the
   * oldest via `keys().next()`.
   */
  built: Map<string, BuildTextGeometryResult>;
}

/**
 * Parsed-font + built-geometry cache. WeakMap-keyed on the ArrayBuffer
 * the caller already holds, so entries are garbage-collected
 * automatically when the font buffer drops out of scope (e.g. after a
 * `fetchFontBuffer` cache flush).
 */
const fontCache = new WeakMap<ArrayBuffer, FontCacheEntry>();

/**
 * Returns the cached `FontCacheEntry` for this buffer, parsing the
 * font on first sight. A parse failure is memoised as `font: null` so
 * we don't re-attempt (and re-log) a broken buffer on every rebuild.
 */
function getFontEntry(fontBuffer: ArrayBuffer): FontCacheEntry {
  const existing = fontCache.get(fontBuffer);
  if (existing) return existing;
  let font: opentype.Font | null;
  try {
    font = opentype.parse(fontBuffer);
  } catch (err) {
    log.error('opentype.parse failed', err);
    font = null;
  }
  const entry: FontCacheEntry = { font, built: new Map() };
  fontCache.set(fontBuffer, entry);
  return entry;
}

/**
 * Touches the LRU slot for a cached built geometry — removing + re-
 * inserting bumps it to the newest position in the Map's insertion
 * order so it is not the next candidate for eviction.
 */
function touchLru(
  built: Map<string, BuildTextGeometryResult>,
  key: string,
  value: BuildTextGeometryResult,
): void {
  built.delete(key);
  built.set(key, value);
}

/**
 * Converts an opentype.js Path's command stream into a `THREE.ShapePath`
 * with y-flipped coordinates. Exposed for unit tests so we can exercise
 * the adapter without a full font round-trip.
 */
export function pathCommandsToShapePath(
  commands: readonly PathCommand[],
): THREE.ShapePath {
  const sp = new THREE.ShapePath();
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        sp.moveTo(cmd.x, -cmd.y);
        break;
      case 'L':
        sp.lineTo(cmd.x, -cmd.y);
        break;
      case 'Q':
        sp.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
        break;
      case 'C':
        sp.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
        break;
      case 'Z':
        // ShapePath does not have an explicit close; the next 'M' starts
        // a fresh subpath. `toShapes` closes subpaths automatically.
        break;
    }
  }
  return sp;
}

/**
 * Builds the extruded text geometry. Returns an empty BufferGeometry +
 * zero dimensions when the font produces no glyph outlines (empty
 * string, whitespace-only, or font parse failure mid-pipeline).
 *
 * The returned geometry is **cache-owned**. Do not call `.dispose()`
 * on it — downstream consumers (e.g. `placeTextOnFlange`) are
 * expected to clone before transforming.
 */
export function buildTextGeometry(
  content: string,
  fontBuffer: ArrayBuffer,
  opts: BuildTextGeometryOptions,
): BuildTextGeometryResult {
  if (!content || opts.letterHeightMm <= 0 || opts.extrusionMm <= 0) {
    return emptyResult();
  }

  const entry = getFontEntry(fontBuffer);
  if (!entry.font) return emptyResult();

  const curveSegments = opts.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const cacheKey = `${opts.letterHeightMm}|${opts.extrusionMm}|${curveSegments}|${content}`;
  const hit = entry.built.get(cacheKey);
  if (hit) {
    touchLru(entry.built, cacheKey, hit);
    return hit;
  }

  // Map letterHeightMm → opentype font size so the em-square height equals
  // letterHeightMm. Real cap-height varies by font (~0.68 em for most
  // Latin faces) but that is the intuitive "drag a slider" meaning the
  // user expects.
  const fontSize = opts.letterHeightMm;
  const path: OpentypePath = entry.font.getPath(content, 0, 0, fontSize);

  const shapePath = pathCommandsToShapePath(path.commands);
  // `toShapes(isCCW=true)` treats CCW contours as outer perimeters. After
  // the y-flip in pathCommandsToShapePath, outer glyph contours end up
  // CCW in the y-up frame, so this is the correct call.
  const shapes = shapePath.toShapes(true);

  const geoms: THREE.BufferGeometry[] = [];
  for (const shape of shapes) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: opts.extrusionMm,
      bevelEnabled: false,
      curveSegments,
    });
    geoms.push(g);
  }

  if (geoms.length === 0) return emptyResult();

  const merged = mergeBufferGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  if (!merged) return emptyResult();

  merged.computeBoundingBox();
  const bbox = merged.boundingBox;
  const widthMm = bbox ? bbox.max.x - bbox.min.x : 0;
  const heightMm = bbox ? bbox.max.y - bbox.min.y : 0;

  const result: BuildTextGeometryResult = {
    geometry: merged,
    widthMm,
    heightMm,
  };

  // LRU evict oldest entry when at capacity.
  if (entry.built.size >= MAX_GEOMS_PER_FONT) {
    const oldestKey = entry.built.keys().next().value;
    if (oldestKey !== undefined) {
      const evicted = entry.built.get(oldestKey);
      evicted?.geometry.dispose();
      entry.built.delete(oldestKey);
    }
  }
  entry.built.set(cacheKey, result);

  log.debug('buildTextGeometry built', {
    content,
    glyphs: shapes.length,
    curveSegments,
    widthMm: Number(widthMm.toFixed(3)),
    heightMm: Number(heightMm.toFixed(3)),
  });

  return result;
}

function emptyResult(): BuildTextGeometryResult {
  return {
    geometry: new THREE.BufferGeometry(),
    widthMm: 0,
    heightMm: 0,
  };
}
