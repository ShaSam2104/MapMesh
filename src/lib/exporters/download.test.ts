import { describe, expect, it } from 'vitest';
import { exportFilename } from './download';

describe('exportFilename', () => {
  it('formats lat, lng, shape, size, ext', () => {
    expect(exportFilename([72.8777, 19.076], 'square', 2, 'stl')).toBe(
      'meshmap_19.0760_72.8777_square_2km.stl',
    );
  });

  it('handles 3mf extension', () => {
    expect(exportFilename([0, 0], 'hex', 1.5, '3mf')).toBe(
      'meshmap_0.0000_0.0000_hex_1.5km.3mf',
    );
  });
});
