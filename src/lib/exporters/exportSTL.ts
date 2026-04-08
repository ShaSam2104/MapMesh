/**
 * STL exporter — wraps `three-stdlib`'s `STLExporter`.
 *
 * The primary STL path for MeshMap. Accepts a single merged mesh in mm and
 * returns a `Blob` ready for download.
 *
 * @module lib/exporters/exportSTL
 */

import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { tagged } from '@/lib/log/logger';

const log = tagged('export-stl');

/**
 * Serializes a single geometry to a binary STL blob.
 */
export function exportSTL(geometry: THREE.BufferGeometry): Blob {
  const mesh = new THREE.Mesh(geometry);
  const exporter = new STLExporter();
  const dataView = exporter.parse(mesh, { binary: true });
  const buffer: ArrayBuffer =
    dataView instanceof DataView
      ? (dataView.buffer.slice(
          dataView.byteOffset,
          dataView.byteOffset + dataView.byteLength,
        ) as ArrayBuffer)
      : (new TextEncoder().encode(dataView as string).buffer as ArrayBuffer);
  log.info('STL ready', { bytes: buffer.byteLength });
  return new Blob([buffer], { type: 'model/stl' });
}
