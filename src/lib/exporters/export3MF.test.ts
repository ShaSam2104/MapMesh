// @vitest-environment node
// ^ `three-3mf-exporter` pulls in `jszip`, which is happier under Node
//   than jsdom for binary ArrayBuffer round-trips.
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import * as THREE from 'three';
import { export3MF } from './export3MF';
import type { ExportPart } from './buildExportParts';

function cubePart(
  key: ExportPart['key'],
  name: string,
  colorHex: string,
): ExportPart {
  return {
    key,
    name,
    colorHex,
    geometry: new THREE.BoxGeometry(1, 1, 1),
  };
}

async function unzipModel(blob: Blob): Promise<{
  files: string[];
  modelXml: string;
  projectSettings: string;
}> {
  const buf = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files);
  const modelEntry = zip.file('3D/3dmodel.model');
  if (!modelEntry) throw new Error('3D/3dmodel.model missing from 3MF');
  const modelXml = await modelEntry.async('text');
  const projectEntry = zip.file('Metadata/project_settings.config');
  const projectSettings = projectEntry ? await projectEntry.async('text') : '';
  return { files, modelXml, projectSettings };
}

describe('export3MF', () => {
  it('exports a function', () => {
    expect(typeof export3MF).toBe('function');
  });

  it('throws when the parts array is empty', async () => {
    await expect(export3MF([])).rejects.toThrow(/no parts/i);
  });

  it('returns a non-empty Blob for a single coloured part', async () => {
    const blob = await export3MF([cubePart('base', 'Base', '#1A1B1E')]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a ZIP archive containing the 3D/3dmodel.model entry', async () => {
    const blob = await export3MF([cubePart('base', 'Base', '#1A1B1E')]);
    const { files, modelXml } = await unzipModel(blob);
    expect(files).toContain('3D/3dmodel.model');
    expect(files).toContain('[Content_Types].xml');
    expect(files).toContain('_rels/.rels');
    expect(modelXml).toContain('<model');
    expect(modelXml).toContain('unit="millimeter"');
    expect(modelXml).toContain('<vertex');
    expect(modelXml).toContain('<triangle');
  });

  it('emits one mesh object per part with the part name', async () => {
    const parts: ExportPart[] = [
      cubePart('base', 'Base', '#1A1B1E'),
      cubePart('buildings', 'Buildings', '#3D4043'),
      cubePart('water', 'Water', '#1A3D52'),
    ];
    const blob = await export3MF(parts);
    const { modelXml } = await unzipModel(blob);
    // `three-3mf-exporter` wraps a multi-mesh Group in an extra
    // `<object type="model">` assembly that references each mesh via
    // `<components>`. The mesh objects are the ones with a `<mesh>`
    // child — one per part.
    const meshMatches = modelXml.match(/<mesh\b/g) ?? [];
    expect(meshMatches.length).toBe(parts.length);
    expect(modelXml).toContain('name="Base"');
    expect(modelXml).toContain('name="Buildings"');
    expect(modelXml).toContain('name="Water"');
  });

  it('deduplicates vertices within each object so the mesh is manifold-safe', async () => {
    // A unit cube has 12 triangles; after deduping coincident vertices
    // across all triangles it should collapse to at most 24 unique
    // vertex entries (8 position corners × at most 3 duplicates for
    // hard normal splits — in practice fewer). A broken exporter
    // would emit 12 × 3 = 36 vertex entries (every triangle
    // independent) and Bambu Studio would count every edge as
    // non-manifold, which is the bug this test guards against.
    const blob = await export3MF([cubePart('base', 'Base', '#1A1B1E')]);
    const { modelXml } = await unzipModel(blob);
    const vertexMatches = modelXml.match(/<vertex\b/g) ?? [];
    expect(vertexMatches.length).toBeLessThanOrEqual(24);
    const triangleMatches = modelXml.match(/<triangle\b/g) ?? [];
    expect(triangleMatches.length).toBe(12);
  });

  it('writes per-part filament colors into project_settings.config', async () => {
    const parts: ExportPart[] = [
      cubePart('base', 'Base', '#1A1B1E'),
      cubePart('buildings', 'Buildings', '#3D4043'),
    ];
    const blob = await export3MF(parts);
    const { projectSettings } = await unzipModel(blob);
    expect(projectSettings.toLowerCase()).toContain('1a1b1e');
    expect(projectSettings.toLowerCase()).toContain('3d4043');
  });
});
