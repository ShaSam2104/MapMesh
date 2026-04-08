import { describe, expect, it } from 'vitest';
import {
  decodeTerrariumPixels,
  lngLatToTile,
  tileToLngLat,
  tilesForBbox,
} from './terrarium';

describe('terrarium decode', () => {
  it('(R=128, G=0, B=0) decodes to 32768 - 32768 = 0? nope — 128*256=32768 so elevation = 0', () => {
    const rgba = new Uint8ClampedArray([128, 0, 0, 255]);
    const decoded = decodeTerrariumPixels(rgba);
    expect(decoded[0]).toBeCloseTo(0);
  });

  it('(R=0, G=0, B=0) decodes to -32768', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255]);
    const decoded = decodeTerrariumPixels(rgba);
    expect(decoded[0]).toBe(-32768);
  });

  it('(R=130, G=0, B=0) decodes to 512m', () => {
    const rgba = new Uint8ClampedArray([130, 0, 0, 255]);
    const decoded = decodeTerrariumPixels(rgba);
    expect(decoded[0]).toBeCloseTo(512, 5);
  });

  it('decodes a multi-pixel buffer in order', () => {
    const rgba = new Uint8ClampedArray([
      128, 0, 0, 255, // 0m
      130, 0, 0, 255, // 512m
      128, 1, 0, 255, // 1m
    ]);
    const out = decodeTerrariumPixels(rgba);
    expect(out.length).toBe(3);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(512);
    expect(out[2]).toBe(1);
  });
});

describe('terrarium tile math', () => {
  it('round-trips a well-known tile (Mumbai, z=13)', () => {
    const z = 13;
    const { x, y } = lngLatToTile(72.8777, 19.076, z);
    const [lng, lat] = tileToLngLat(x, y, z);
    expect(lng).toBeLessThanOrEqual(72.8777);
    expect(lat).toBeGreaterThanOrEqual(19.076);
  });

  it('tilesForBbox returns at least 1 tile for a tiny bbox', () => {
    const tiles = tilesForBbox([72.877, 19.075, 72.879, 19.077], 13);
    expect(tiles.length).toBeGreaterThanOrEqual(1);
  });

  it('tilesForBbox covers all tiles across a larger bbox', () => {
    const tiles = tilesForBbox([72.85, 19.05, 72.95, 19.15], 13);
    expect(tiles.length).toBeGreaterThanOrEqual(2);
  });
});
