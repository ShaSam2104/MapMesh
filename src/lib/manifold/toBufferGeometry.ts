/**
 * manifold-3d `Manifold` → three.js `BufferGeometry` adapter.
 *
 * Used by the rendering path so a watertight plinth can be displayed in R3F.
 * No geometry math — a pure reshape.
 *
 * @module lib/manifold/toBufferGeometry
 */

import * as THREE from 'three';
import type { Manifold } from 'manifold-3d';

/**
 * Emits a `BufferGeometry` from a Manifold, with computed normals.
 */
export function toBufferGeometry(manifold: Manifold): THREE.BufferGeometry {
  const mesh = manifold.getMesh();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(mesh.vertProperties, 3),
  );
  geo.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
  geo.computeVertexNormals();
  return geo;
}
