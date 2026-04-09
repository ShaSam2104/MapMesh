/**
 * BufferGeometry → manifold-3d `Mesh` adapter.
 *
 * This is the only place that maps between three.js's typed arrays and
 * manifold-3d's `Mesh` struct. No geometry math lives here — just a pure
 * reshape of `position` and `index` attributes.
 *
 * This file is a **hot path** for export: `unionExportManifold` calls it
 * once per included layer, and each call must construct a fresh
 * `Manifold` before the boolean union can run. For that reason we fast-
 * path the common case (a plain non-interleaved `Float32Array` position
 * attribute) by copying the underlying typed array directly instead of
 * iterating `getX/getY/getZ` per vertex. On a dense OSM selection with
 * hundreds of thousands of vertices, the fast path is ~10× faster than
 * the per-vertex loop and is the difference between "the page stutters"
 * and "the page freezes for a second".
 *
 * @module lib/manifold/fromBufferGeometry
 */

import type { BufferAttribute, BufferGeometry } from 'three';
import type { Manifold } from 'manifold-3d';
import { getManifold } from './loader';

/**
 * Constructs a `Manifold` handle from a three.js `BufferGeometry`.
 *
 * The geometry must expose a `position` attribute; index is optional.
 * Attributes beyond `position` are dropped — manifold only cares about
 * the shell. `mesh.merge()` is called before the Manifold constructor
 * so coincident vertices collapse, which is what gives manifold its
 * topology-valid guarantee.
 */
export async function fromBufferGeometry(geo: BufferGeometry): Promise<Manifold> {
  const ns = await getManifold();
  const pos = geo.getAttribute('position') as BufferAttribute | undefined;
  if (!pos) throw new Error('BufferGeometry has no position attribute');

  // Fast path: plain non-interleaved Float32Array with itemSize 3 and
  // length === count * 3. This is what every three.js `ExtrudeGeometry`
  // / `BoxGeometry` / `mergeBufferGeometries` result produces.
  // Interleaved buffer attributes would have `array.length > count * 3`
  // because they share the backing buffer with other attributes, so we
  // fall back to the per-vertex loop in that case.
  const posArray = pos.array;
  let vertProperties: Float32Array;
  if (
    pos.itemSize === 3 &&
    posArray instanceof Float32Array &&
    posArray.length === pos.count * 3
  ) {
    vertProperties = new Float32Array(posArray); // single bulk copy
  } else {
    vertProperties = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      vertProperties[i * 3 + 0] = pos.getX(i);
      vertProperties[i * 3 + 1] = pos.getY(i);
      vertProperties[i * 3 + 2] = pos.getZ(i);
    }
  }

  let triVerts: Uint32Array;
  const indexAttr = geo.getIndex();
  if (indexAttr) {
    const idxArray = indexAttr.array;
    if (
      idxArray instanceof Uint32Array &&
      idxArray.length === indexAttr.count
    ) {
      triVerts = new Uint32Array(idxArray); // single bulk copy
    } else {
      // Uint16Array indices (default for small meshes) or anything else —
      // copy with a widening loop.
      triVerts = new Uint32Array(indexAttr.count);
      for (let i = 0; i < indexAttr.count; i++) triVerts[i] = indexAttr.getX(i);
    }
  } else {
    // Non-indexed: synthesize a trivial 0..N-1 index stream so every
    // consecutive triple of vertices is one triangle.
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
