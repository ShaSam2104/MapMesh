/**
 * 3MF exporter — wraps `@jscadui/3mf-export`.
 *
 * Pipeline:
 *   three.js BufferGeometry
 *     → flat vertices + indices (pure reshape, no math)
 *     → @jscadui/3mf-export `to3dmodel`  (emits `3D/3dmodel.model` XML)
 *     → bundled with the package's static [Content_Types].xml + _rels/.rels
 *     → fflate.zipSync                   (ZIP → 3MF archive)
 *     → Blob
 *
 * The package's upstream API takes raw vertex/index arrays rather than JSCAD
 * `geom3` objects, so the conversion is trivial reshape — triangle winding is
 * preserved 1:1 from the source BufferGeometry.
 *
 * @module lib/exporters/export3MF
 */

import type { BufferGeometry } from 'three';
import {
  to3dmodel,
  fileForContentTypes,
  fileForRelThumbnail,
} from '@jscadui/3mf-export';
import * as fflate from 'fflate';
import { tagged } from '@/lib/log/logger';

const log = tagged('export-3mf');

/** Identity 3×4 transform (row-major), required by the 3mf-export `items` entry. */
const IDENTITY_TRANSFORM: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

/**
 * Converts a BufferGeometry to the flat `{ vertices, indices }` shape expected
 * by `@jscadui/3mf-export`. Vertices are a flat xyz number array; indices are a
 * flat triangle number array. Non-indexed geometries are unrolled 0..N-1.
 */
function toFlatMesh(geo: BufferGeometry): {
  vertices: number[];
  indices: number[];
} {
  const pos = geo.getAttribute('position');
  if (!pos) throw new Error('BufferGeometry has no position attribute');
  const vertices: number[] = new Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    vertices[i * 3 + 0] = pos.getX(i);
    vertices[i * 3 + 1] = pos.getY(i);
    vertices[i * 3 + 2] = pos.getZ(i);
  }
  const indexAttr = geo.getIndex();
  const indices: number[] = [];
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i++) indices.push(indexAttr.getX(i));
  } else {
    for (let i = 0; i < pos.count; i++) indices.push(i);
  }
  return { vertices, indices };
}

/**
 * Serializes a single geometry to a binary 3MF blob. Units are millimeters.
 */
export async function export3MF(geometry: BufferGeometry): Promise<Blob> {
  const { vertices, indices } = toFlatMesh(geometry);

  const modelXml: string = to3dmodel({
    simple: [{ id: '1', vertices, indices, transforms: IDENTITY_TRANSFORM }],
    unit: 'millimeter',
    title: 'MeshMap export',
    author: 'MeshMap',
    application: 'MeshMap',
  });

  // Build the ZIP entry map. The package ships the two boilerplate XML files;
  // we only need to add the generated 3dmodel entry. NB: fflate's `fltn`
  // identifies files by `instanceof u8` where `u8 = Uint8Array` *from fflate's
  // own realm*. Under Vitest's module realms this can diverge from the global
  // `Uint8Array` (manifesting as every byte becoming a nested "directory"),
  // so we go through `fflate.strToU8` which allocates the instance with
  // fflate's constructor.
  const files: fflate.Zippable = {
    [fileForContentTypes.name]: fflate.strToU8(fileForContentTypes.content),
    [fileForRelThumbnail.name]: fflate.strToU8(fileForRelThumbnail.content),
    '3D/3dmodel.model': fflate.strToU8(modelXml),
  };

  const zipped = fflate.zipSync(files, { level: 6 });
  const buffer: ArrayBuffer = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
  log.info('3MF ready', {
    bytes: buffer.byteLength,
    vertices: vertices.length / 3,
    triangles: indices.length / 3,
  });
  return new Blob([buffer], { type: 'model/3mf' });
}
