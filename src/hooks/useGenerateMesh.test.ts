import { describe, expect, it } from 'vitest';
import { useGenerateMesh } from './useGenerateMesh';
import { renderHook } from '@testing-library/react';

describe('useGenerateMesh', () => {
  // The full pipeline is exercised via Playwright (msw + manifold WASM).
  // Unit coverage here is a smoke test that ensures the hook returns
  // both `generate` and `rebuild` entry points so the split doesn't
  // silently regress into a single callable.
  it('returns a { generate, rebuild } object', () => {
    const { result } = renderHook(() => useGenerateMesh());
    expect(typeof result.current.generate).toBe('function');
    expect(typeof result.current.rebuild).toBe('function');
  });

  it('rebuild() is a no-op when there is no cached raw data', async () => {
    const { result } = renderHook(() => useGenerateMesh());
    await expect(result.current.rebuild()).resolves.toBeUndefined();
  });
});
