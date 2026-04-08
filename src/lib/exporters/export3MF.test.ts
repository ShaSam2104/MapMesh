// @vitest-environment node
// ^ fflate captures `Uint8Array` at module load; under jsdom, the global
//   `Uint8Array` realm may diverge from fflate's captured reference, causing
//   `instanceof` checks inside fflate's fltn() to fail and every Uint8Array
//   to be treated as a directory. Node env keeps the realm consistent.
import { describe, expect, it } from 'vitest';
import * as fflate from 'fflate';
import * as THREE from 'three';
import { export3MF } from './export3MF';

describe('export3MF', () => {
  it('exports a function', () => {
    expect(typeof export3MF).toBe('function');
  });

  it('returns a non-empty Blob for a unit cube', async () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blob = await export3MF(box);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a ZIP archive containing the 3D/3dmodel.model entry', async () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blob = await export3MF(box);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const unzipped = fflate.unzipSync(buf);
    expect(Object.keys(unzipped)).toContain('3D/3dmodel.model');
    expect(Object.keys(unzipped)).toContain('[Content_Types].xml');
    expect(Object.keys(unzipped)).toContain('_rels/.rels');
    const xml = new TextDecoder().decode(unzipped['3D/3dmodel.model']);
    expect(xml).toContain('<model');
    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain('<vertex');
    expect(xml).toContain('<triangle');
  });
});
