import { describe, expect, it } from 'vitest';
import {
  computeFlangeSpecs,
  MIN_FLANGE_DEPTH_MM,
  FLANGE_DEPTH_PADDING_MM,
} from './flangeSpecs';
import type { TextLabel } from '@/types';

function label(
  side: TextLabel['side'],
  extrusionMm = 1.2,
  overrides: Partial<TextLabel> = {},
): TextLabel {
  return {
    id: `${side}-${Math.random()}`,
    content: 'HELLO',
    fontFamily: 'Roboto',
    fontVariant: 'regular',
    color: '#fff',
    side,
    letterHeightMm: 8,
    extrusionMm,
    alignment: 'center',
    offsetMm: 0,
    ...overrides,
  };
}

describe('computeFlangeSpecs', () => {
  it('returns empty when there are no labels', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [],
    });
    expect(specs).toEqual([]);
  });

  it('emits one spec per side that has labels', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north'), label('west'), label('north')],
    });
    expect(specs.map((s) => s.side).sort()).toEqual(['north', 'west']);
  });

  it('sizes depthMm as max(extrusion+padding, MIN)', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north', 0.6)],
    });
    // 0.6 + 4 = 4.6 → below MIN (6)
    expect(specs[0].depthMm).toBe(MIN_FLANGE_DEPTH_MM);

    const deep = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north', 5)],
    });
    expect(deep[0].depthMm).toBe(5 + FLANGE_DEPTH_PADDING_MM);
  });

  it('takes the deepest extrusion on a side with multiple labels', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north', 1), label('north', 3), label('north', 2)],
    });
    expect(specs).toHaveLength(1);
    // max extrusion 3 → depth = 3 + 4 = 7 ≥ MIN(6)
    expect(specs[0].depthMm).toBe(7);
  });

  it('north flange rect sits above the plinth (y > maxY) unrotated', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2, // half = 1000 m * 0.1 mm/m = 100 mm
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north', 1.2)],
    });
    const spec = specs[0];
    expect(spec.widthMm).toBeCloseTo(200, 3);
    expect(spec.depthMm).toBe(MIN_FLANGE_DEPTH_MM);
    // rect's bottom edge is at y = +100; top edge at y = +100 + 6 = 106
    const ys = spec.rectVerts.map(([, y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(100, 3);
    expect(Math.max(...ys)).toBeCloseTo(106, 3);
    const xs = spec.rectVerts.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-100, 3);
    expect(Math.max(...xs)).toBeCloseTo(100, 3);
    // Outward normal points +Y; tangent points -X (worldUp × normal)
    expect(spec.outwardNormal).toEqual([0, 1, 0]);
    expect(spec.edgeTangent[0]).toBeCloseTo(-1, 6);
    expect(spec.edgeTangent[1]).toBeCloseTo(0, 6);
    // Outer face center on the outer edge at the bbox center
    expect(spec.outerFaceCenter[0]).toBeCloseTo(0, 6);
    expect(spec.outerFaceCenter[1]).toBeCloseTo(106, 6);
    // midZ = (-6 + 3) / 2 = -1.5
    expect(spec.outerFaceCenter[2]).toBeCloseTo(-1.5, 6);
  });

  it('east flange has normal +X and tangent +Y (right-handed)', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('east')],
    });
    const spec = specs[0];
    expect(spec.outwardNormal[0]).toBeCloseTo(1, 6);
    expect(spec.outwardNormal[1]).toBeCloseTo(0, 6);
    expect(spec.edgeTangent[0]).toBeCloseTo(0, 6);
    expect(spec.edgeTangent[1]).toBeCloseTo(1, 6);
  });

  it('south flange has normal -Y and tangent +X (right-handed)', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('south')],
    });
    const spec = specs[0];
    expect(spec.outwardNormal[1]).toBeCloseTo(-1, 6);
    expect(spec.edgeTangent[0]).toBeCloseTo(1, 6);
  });

  it('west flange has normal -X and tangent -Y (right-handed)', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 0,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('west')],
    });
    const spec = specs[0];
    expect(spec.outwardNormal[0]).toBeCloseTo(-1, 6);
    expect(spec.edgeTangent[1]).toBeCloseTo(-1, 6);
  });

  it('rotates rect, normal, and tangent by rotationDeg', () => {
    const specs = computeFlangeSpecs({
      shape: 'square',
      sizeKm: 2,
      rotationDeg: 90,
      baseThicknessMm: 6,
      topZ: 3,
      labels: [label('north')],
    });
    const spec = specs[0];
    // After 90° CCW rotation, +Y becomes -X in world frame (x' = x cos - y sin; y' = x sin + y cos)
    // (0,1) → (-1, 0)
    expect(spec.outwardNormal[0]).toBeCloseTo(-1, 6);
    expect(spec.outwardNormal[1]).toBeCloseTo(0, 6);
    // (-1, 0) rotates to (0, -1)
    expect(spec.edgeTangent[0]).toBeCloseTo(0, 6);
    expect(spec.edgeTangent[1]).toBeCloseTo(-1, 6);
  });
});
