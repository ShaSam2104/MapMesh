import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ProgressOverlay } from './ProgressOverlay';
import { useStore } from '@/state/store';

describe('ProgressOverlay', () => {
  beforeEach(() => {
    // Reset mesh state between tests.
    act(() => {
      useStore.getState().setMeshStatus('idle');
      useStore.getState().setMeshProgress(null);
    });
  });

  it('renders nothing when idle and no progress is set', () => {
    render(<ProgressOverlay />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a status region with phase + spinner when progress is set', () => {
    act(() => {
      useStore.getState().setMeshStatus('building');
      useStore.getState().setMeshProgress('Fetching elevation tiles', 'Terrarium');
    });
    render(<ProgressOverlay />);
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('Fetching elevation tiles');
    expect(region).toHaveTextContent('Terrarium');
    // Elapsed seconds are rendered with a trailing "s".
    expect(region).toHaveTextContent(/\d+\.\d+s/);
  });

  it('shows a default phase label when the pipeline is busy without a progress payload', () => {
    act(() => {
      useStore.getState().setMeshStatus('fetching');
    });
    render(<ProgressOverlay />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching');
  });

  it('disappears when progress is cleared and status returns to ready', () => {
    act(() => {
      useStore.getState().setMeshStatus('building');
      useStore.getState().setMeshProgress('Building map layers');
    });
    const { rerender } = render(<ProgressOverlay />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      useStore.getState().setMeshStatus('ready');
      useStore.getState().setMeshProgress(null);
    });
    rerender(<ProgressOverlay />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
