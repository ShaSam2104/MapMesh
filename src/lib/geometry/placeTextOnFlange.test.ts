import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { placeTextOnFlange } from './placeTextOnFlange';
import type { FlangeSpec } from './flangeSpecs';

/**
 * Tiny flat "text" geometry: a 20×8 quad sitting in the XY plane with
 * a 1 mm extrusion. Exercises placeTextOnFlange without dragging in
 * the opentype pipeline.
 */
function makeFlatQuad(w: number, h: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, h);
  shape.lineTo(0, h);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

const NORTH_FLANGE: FlangeSpec = {
  side: 'north',
  widthMm: 200,
  depthMm: 6,
  rectVerts: [
    [-100, 100],
    [100, 100],
    [100, 106],
    [-100, 106],
  ],
  outerFaceCenter: [0, 106, -1.5],
  outwardNormal: [0, 1, 0],
  edgeTangent: [-1, 0, 0],
};

const EAST_FLANGE: FlangeSpec = {
  side: 'east',
  widthMm: 200,
  depthMm: 6,
  rectVerts: [
    [100, -100],
    [106, -100],
    [106, 100],
    [100, 100],
  ],
  outerFaceCenter: [106, 0, -1.5],
  outwardNormal: [1, 0, 0],
  edgeTangent: [0, 1, 0],
};

function bboxOf(geom: THREE.BufferGeometry): THREE.Box3 {
  geom.computeBoundingBox();
  return geom.boundingBox!;
}

describe('placeTextOnFlange', () => {
  it('sits on the north outer face with text centered', () => {
    const placed = placeTextOnFlange({
      geometry: makeFlatQuad(20, 8, 1),
      textWidthMm: 20,
      textHeightMm: 8,
      flange: NORTH_FLANGE,
      label: { alignment: 'center', offsetMm: 0 },
    });
    const bbox = bboxOf(placed);
    // The face is at y = 106, the relief extrudes +y to 107.
    expect(bbox.min.y).toBeCloseTo(106, 3);
    expect(bbox.max.y).toBeCloseTo(107, 3);
    // Centered along X → text spans [-10, 10].
    expect(bbox.min.x).toBeCloseTo(-10, 3);
    expect(bbox.max.x).toBeCloseTo(10, 3);
    // Vertically centered on face midZ = -1.5 ± 4.
    expect((bbox.min.z + bbox.max.z) / 2).toBeCloseTo(-1.5, 3);
    expect(bbox.max.z - bbox.min.z).toBeCloseTo(8, 3);
  });

  it('left alignment starts at the flange left edge', () => {
    const placed = placeTextOnFlange({
      geometry: makeFlatQuad(20, 8, 1),
      textWidthMm: 20,
      textHeightMm: 8,
      flange: NORTH_FLANGE,
      label: { alignment: 'left', offsetMm: 0 },
    });
    const bbox = bboxOf(placed);
    // tangent = -X, so "left" end of flange is at +X = +100. Text should
    // start (origin) at +100 along tangent and extend to +100 - 20 = +80.
    // In world coordinates: x starts at 100 (the flange-left corner under
    // the tangent = -X direction) and extends to 80.
    expect(bbox.max.x).toBeCloseTo(100, 3);
    expect(bbox.min.x).toBeCloseTo(80, 3);
  });

  it('right alignment ends at the flange right edge', () => {
    const placed = placeTextOnFlange({
      geometry: makeFlatQuad(20, 8, 1),
      textWidthMm: 20,
      textHeightMm: 8,
      flange: NORTH_FLANGE,
      label: { alignment: 'right', offsetMm: 0 },
    });
    const bbox = bboxOf(placed);
    // tangent = -X, "right" end of flange is at -X = -100.
    // Text spans -100 to -80.
    expect(bbox.min.x).toBeCloseTo(-100, 3);
    expect(bbox.max.x).toBeCloseTo(-80, 3);
  });

  it('east flange text extrudes outward along +X', () => {
    const placed = placeTextOnFlange({
      geometry: makeFlatQuad(20, 8, 1),
      textWidthMm: 20,
      textHeightMm: 8,
      flange: EAST_FLANGE,
      label: { alignment: 'center', offsetMm: 0 },
    });
    const bbox = bboxOf(placed);
    // Face at x=106, extrudes to x=107.
    expect(bbox.min.x).toBeCloseTo(106, 3);
    expect(bbox.max.x).toBeCloseTo(107, 3);
    // tangent = +Y, centered along Y → spans [-10, 10].
    expect(bbox.min.y).toBeCloseTo(-10, 3);
    expect(bbox.max.y).toBeCloseTo(10, 3);
  });

  it('offsetMm shifts along the tangent direction', () => {
    const placed = placeTextOnFlange({
      geometry: makeFlatQuad(20, 8, 1),
      textWidthMm: 20,
      textHeightMm: 8,
      flange: NORTH_FLANGE,
      label: { alignment: 'center', offsetMm: 30 },
    });
    const bbox = bboxOf(placed);
    // tangent = -X, so offset +30 shifts text by -30 in world x.
    expect((bbox.min.x + bbox.max.x) / 2).toBeCloseTo(-30, 3);
  });
});
