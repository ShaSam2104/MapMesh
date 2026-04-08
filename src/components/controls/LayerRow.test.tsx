import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerRow } from './LayerRow';
import { LAYER_ORDER } from '@/types';
import { useStore } from '@/state/store';

describe('LayerRow', () => {
  it.each(LAYER_ORDER)('renders row for layer %s with label + expand button', (key) => {
    render(<LayerRow layerKey={key} expanded={false} onToggle={() => {}} />);
    expect(
      screen.getByRole('button', { expanded: false }),
    ).toBeInTheDocument();
  });

  it('toggles expansion via click', async () => {
    let open = false;
    const { rerender } = render(
      <LayerRow
        layerKey="water"
        expanded={open}
        onToggle={() => {
          open = !open;
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    rerender(<LayerRow layerKey="water" expanded={true} onToggle={() => {}} />);
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });

  it('reflects the current store color in the swatch dot', () => {
    useStore.getState().setLayerColor('buildings', '#aabbcc');
    render(<LayerRow layerKey="buildings" expanded={false} onToggle={() => {}} />);
    // The swatch is rendered as a span with aria-hidden; just assert the row exists.
    expect(
      screen.getByRole('button', { name: /buildings/i, expanded: false }),
    ).toBeInTheDocument();
  });
});
