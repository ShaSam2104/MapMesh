import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Manifold } from 'manifold-3d';
import { buildExportParts } from './buildExportParts';
import { defaultLayers } from '@/lib/palette';
import type { MeshState, TextLabel } from '@/types';

/**
 * Minimal fake `Manifold` stand-in: the code only calls
 * `toBufferGeometry(plinth)` on the object, which we don't exercise on
 * the paths under test. For tests that DO cover the plinth branch, we
 * build a tiny stub manifold whose `getMesh()` + related calls return
 * an empty (but valid) geometry so `toBufferGeometry` returns an empty
 * `BufferGeometry`.
 */
function fakePlinthManifold(): Manifold {
  const empty = new THREE.BufferGeometry();
  // `toBufferGeometry` only calls `.getMesh()` and then treats the
  // result like a `Mesh` with `triVerts`, `vertProperties`, etc. Since
  // the tests below never inspect the resulting `parts[0].geometry`
  // contents, we can return a throw-away empty mesh; the exporter
  // wraps whatever `toBufferGeometry` returns into the first part.
  return {
    getMesh: () => ({
      triVerts: new Uint32Array(),
      vertProperties: new Float32Array(),
      numProp: 3,
    }),
    numTri: () => 0,
    boundingBox: () => ({ min: [0, 0, 0], max: [0, 0, 0] }),
    dispose: () => {},
    delete: () => {},
    add: () => {
      throw new Error('not used');
    },
  } as unknown as Manifold;
  void empty;
}

function baseMesh(): MeshState {
  return {
    status: 'ready',
    layerGeometries: {},
    textLabelGeometries: {},
    plinthTopZ: 0,
  };
}

describe('buildExportParts', () => {
  // Deeper assertions against the generated Manifold parts require
  // manifold-3d's WASM, which does not load reliably under jsdom. Those
  // run in the Playwright happy-path suite against the real dev server.
  // Here we only cover the smoke branches reachable without WASM.
  it('exports an async function', () => {
    expect(typeof buildExportParts).toBe('function');
  });

  it('returns an empty array when there is no plinth manifold', async () => {
    const layers = defaultLayers('dark');
    const parts = await buildExportParts({
      mesh: baseMesh(),
      layers,
    });
    expect(parts).toEqual([]);
  });

  it('emits one part per text label and names it with the content', async () => {
    const layers = defaultLayers('dark');
    // Disable layer exports so we only see the plinth + text parts.
    for (const k of Object.keys(layers) as Array<keyof typeof layers>) {
      if (k === 'base') continue;
      layers[k].includeInExport = false;
    }
    const label1: TextLabel = {
      id: 'l1',
      content: 'HELLO',
      fontFamily: 'Roboto',
      fontVariant: 'regular',
      color: '#ff0000',
      side: 'north',
      letterHeightMm: 8,
      extrusionMm: 1.2,
      alignment: 'center',
      offsetMm: 0,
    };
    const label2: TextLabel = {
      ...label1,
      id: 'l2',
      content: 'WORLD',
      color: '#00ff00',
      side: 'west',
    };
    const parts = await buildExportParts({
      mesh: {
        ...baseMesh(),
        plinthManifold: fakePlinthManifold() as unknown,
        textLabelGeometries: {
          l1: new THREE.BufferGeometry(),
          l2: new THREE.BufferGeometry(),
        },
      },
      layers,
      textLabels: [label1, label2],
    });
    const textParts = parts.filter((p) =>
      typeof p.key === 'string' && p.key.startsWith('text:'),
    );
    expect(textParts).toHaveLength(2);
    expect(textParts.map((p) => p.colorHex).sort()).toEqual([
      '#00ff00',
      '#ff0000',
    ]);
    expect(textParts.map((p) => p.name).sort()).toEqual([
      'Text: HELLO',
      'Text: WORLD',
    ]);
  });

  it('skips text labels whose geometry is missing', async () => {
    const layers = defaultLayers('dark');
    for (const k of Object.keys(layers) as Array<keyof typeof layers>) {
      if (k === 'base') continue;
      layers[k].includeInExport = false;
    }
    const label: TextLabel = {
      id: 'orphan',
      content: 'X',
      fontFamily: 'Roboto',
      fontVariant: 'regular',
      color: '#ffffff',
      side: 'north',
      letterHeightMm: 8,
      extrusionMm: 1.2,
      alignment: 'center',
      offsetMm: 0,
    };
    const parts = await buildExportParts({
      mesh: {
        ...baseMesh(),
        plinthManifold: fakePlinthManifold() as unknown,
        textLabelGeometries: {},
      },
      layers,
      textLabels: [label],
    });
    const textParts = parts.filter((p) =>
      typeof p.key === 'string' && p.key.startsWith('text:'),
    );
    expect(textParts).toEqual([]);
  });
});
