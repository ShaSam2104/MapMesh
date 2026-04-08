/**
 * BufferGeometry → manifold-3d `Mesh` adapter.
 *
 * This is the only place that maps between three.js's typed arrays and
 * manifold-3d's `Mesh` struct. No geometry math lives here — just a pure
 * reshape of `position`, `index`, and optional `normal` attributes.
 *
 * @module lib/manifold/fromBufferGeometry
 */

import type { BufferGeometry } from 'three';
import type { Manifold } from 'manifold-3d';
import { getManifold } from './loader';

/**
 * Constructs a `Manifold` handle from a three.js `BufferGeometry`.
 *
 * The geometry must be indexed (or convertible to indexed). Attributes beyond
 * `position` are dropped — manifold only cares about the shell.
 */
export async function fromBufferGeometry(geo: BufferGeometry): Promise<Manifold> {
  const ns = await getManifold();
  const pos = geo.getAttribute('position');
  if (!pos) throw new Error('BufferGeometry has no position attribute');

  // Use an indexed geometry if present; otherwise synthesize a trivial 0..N-1 index.
  const indexAttr = geo.getIndex();
  const vertProperties = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    vertProperties[i * 3 + 0] = pos.getX(i);
    vertProperties[i * 3 + 1] = pos.getY(i);
    vertProperties[i * 3 + 2] = pos.getZ(i);
  }

  let triVerts: Uint32Array;
  if (indexAttr) {
    triVerts = new Uint32Array(indexAttr.count);
    for (let i = 0; i < indexAttr.count; i++) triVerts[i] = indexAttr.getX(i);
  } else {
    triVerts = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i++) triVerts[i] = i;
  }

  const mesh = new ns.Mesh({
    numProp: 3,
    vertProperties,
    triVerts,
  });
  mesh.merge();
  return new ns.Manifold(mesh);
}
