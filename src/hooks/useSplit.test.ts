import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplit } from './useSplit';

describe('useSplit', () => {
  it('returns the default ratio initially', () => {
    localStorage.removeItem('meshmap_split_ratio');
    const { result } = renderHook(() => useSplit());
    expect(result.current[0]).toBeCloseTo(0.5);
  });

  it('clamps updates to [0.1, 0.9]', () => {
    const { result } = renderHook(() => useSplit());
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(0.9);
    act(() => result.current[1](0));
    expect(result.current[0]).toBe(0.1);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useSplit());
    act(() => result.current[1](0.7));
    expect(localStorage.getItem('meshmap_split_ratio')).toBe('0.7');
  });
});
