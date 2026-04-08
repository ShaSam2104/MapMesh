import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { exportSTL } from './exportSTL';

describe('exportSTL', () => {
  it('produces a non-empty binary STL blob from a unit cube', async () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blob = exportSTL(box);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('model/stl');
  });

  it('binary STL header reports the correct triangle count', async () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blob = exportSTL(box);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // 80-byte header, then little-endian uint32 triangle count at offset 80.
    const view = new DataView(buf.buffer);
    const triCount = view.getUint32(80, true);
    // A unit cube has 12 triangles
    expect(triCount).toBe(12);
  });
});
