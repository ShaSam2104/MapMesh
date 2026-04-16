import { describe, expect, it } from 'vitest';
import opentype from 'opentype.js';
import {
  buildTextGeometry,
  pathCommandsToShapePath,
} from './buildTextGeometry';

/**
 * Generates a minimal OTF buffer with one triangle glyph mapped to 'A'
 * so we can exercise the full parse → geometry pipeline without
 * checking in a real font binary. opentype.js's Font constructor
 * handles all the boring table serialisation for us.
 */
function makeTinyFontBuffer(): ArrayBuffer {
  const notdef = new opentype.Glyph({
    name: '.notdef',
    advanceWidth: 650,
    path: new opentype.Path(),
  });
  const aPath = new opentype.Path();
  aPath.moveTo(100, 0);
  aPath.lineTo(900, 0);
  aPath.lineTo(500, 800);
  aPath.close();
  const aGlyph = new opentype.Glyph({
    name: 'A',
    unicode: 65,
    advanceWidth: 1000,
    path: aPath,
  });
  const font = new opentype.Font({
    familyName: 'TinyTest',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 1024,
    descender: -256,
    glyphs: [notdef, aGlyph],
  });
  return font.toArrayBuffer();
}

describe('pathCommandsToShapePath', () => {
  it('converts a triangle with y-flip', () => {
    const sp = pathCommandsToShapePath([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 5, y: 8 },
      { type: 'Z' },
    ]);
    const shapes = sp.toShapes(true);
    expect(shapes.length).toBeGreaterThanOrEqual(1);
  });

  it('handles Q (quadratic) and C (cubic) commands without throwing', () => {
    const sp = pathCommandsToShapePath([
      { type: 'M', x: 0, y: 0 },
      { type: 'Q', x1: 5, y1: 0, x: 10, y: 0 },
      { type: 'C', x1: 12, y1: 0, x2: 12, y2: 5, x: 10, y: 5 },
      { type: 'L', x: 0, y: 5 },
      { type: 'Z' },
    ]);
    expect(sp).toBeTruthy();
  });

  it('discards Z commands silently', () => {
    const sp = pathCommandsToShapePath([{ type: 'Z' }]);
    expect(sp).toBeTruthy();
  });
});

describe('buildTextGeometry', () => {
  it('returns an empty result for empty content', () => {
    const buf = new ArrayBuffer(0);
    const { geometry, widthMm, heightMm } = buildTextGeometry('', buf, {
      letterHeightMm: 10,
      extrusionMm: 1,
    });
    expect(widthMm).toBe(0);
    expect(heightMm).toBe(0);
    expect(geometry.attributes.position?.count ?? 0).toBe(0);
  });

  it('returns an empty result for zero letter height', () => {
    const buf = makeTinyFontBuffer();
    const { widthMm } = buildTextGeometry('A', buf, {
      letterHeightMm: 0,
      extrusionMm: 1,
    });
    expect(widthMm).toBe(0);
  });

  it('returns an empty result when opentype.parse throws', () => {
    const bad = new ArrayBuffer(8);
    const { geometry, widthMm } = buildTextGeometry('A', bad, {
      letterHeightMm: 10,
      extrusionMm: 1,
    });
    expect(widthMm).toBe(0);
    expect(geometry.attributes.position?.count ?? 0).toBe(0);
  });

  it('extrudes a glyph from a tiny runtime-built font', () => {
    const buf = makeTinyFontBuffer();
    const result = buildTextGeometry('A', buf, {
      letterHeightMm: 10,
      extrusionMm: 2,
    });
    expect(result.widthMm).toBeGreaterThan(0);
    expect(result.heightMm).toBeGreaterThan(0);
    expect(result.geometry.attributes.position.count).toBeGreaterThan(0);
    result.geometry.computeBoundingBox();
    const bbox = result.geometry.boundingBox!;
    // Z span should match extrusionMm (2 mm).
    expect(bbox.max.z - bbox.min.z).toBeCloseTo(2, 3);
  });

  it('scales bounding-box height with letterHeightMm', () => {
    const buf = makeTinyFontBuffer();
    const small = buildTextGeometry('A', buf, {
      letterHeightMm: 5,
      extrusionMm: 1,
    });
    const big = buildTextGeometry('A', buf, {
      letterHeightMm: 20,
      extrusionMm: 1,
    });
    // Approximate 4× scaling from 5 → 20 mm letter height.
    expect(big.heightMm / small.heightMm).toBeCloseTo(4, 1);
  });
});
