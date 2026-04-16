import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { LayerBody } from './LayerBody';
import { useStore } from '@/state/store';

describe('LayerBody', () => {
  it('renders a line width slider for roads', () => {
    render(<LayerBody layerKey="roads" />);
    expect(
      screen.getByRole('slider', { name: /Line width/i }),
    ).toBeInTheDocument();
  });

  it('renders a line width slider for piers', () => {
    render(<LayerBody layerKey="piers" />);
    expect(
      screen.getByRole('slider', { name: /Line width/i }),
    ).toBeInTheDocument();
  });

  it('renders a building height scale slider for buildings', () => {
    render(<LayerBody layerKey="buildings" />);
    expect(
      screen.getByRole('slider', { name: /Building height scale/i }),
    ).toBeInTheDocument();
  });

  it('does not render a line width slider for water', () => {
    render(<LayerBody layerKey="water" />);
    expect(
      screen.queryByRole('slider', { name: /Line width/i }),
    ).not.toBeInTheDocument();
  });

  it('updates store widthMeters when the roads width slider changes', () => {
    render(<LayerBody layerKey="roads" />);
    const slider = screen.getByRole('slider', {
      name: /Line width/i,
    }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '10' } });
    expect(useStore.getState().layers.roads.widthMeters).toBe(10);
  });

  it('updates store heightScale when the buildings scale slider changes', () => {
    render(<LayerBody layerKey="buildings" />);
    const slider = screen.getByRole('slider', {
      name: /Building height scale/i,
    }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '2' } });
    expect(useStore.getState().layers.buildings.heightScale).toBe(2);
  });
});
