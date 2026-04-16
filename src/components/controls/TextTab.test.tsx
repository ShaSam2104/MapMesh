import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextTab } from './TextTab';
import { useStore } from '@/state/store';

function resetLabels() {
  for (const l of [...useStore.getState().textLabels]) {
    useStore.getState().removeTextLabel(l.id);
  }
}

describe('TextTab', () => {
  it('shows the empty state when there are no labels', () => {
    resetLabels();
    render(<TextTab />);
    expect(screen.getByText(/No labels yet/i)).toBeInTheDocument();
  });

  it('adds a label when the add button is clicked', async () => {
    resetLabels();
    render(<TextTab />);
    await userEvent.click(
      screen.getByRole('button', { name: /Add text label/i }),
    );
    expect(useStore.getState().textLabels).toHaveLength(1);
  });

  it('renders one row per existing label', () => {
    resetLabels();
    useStore.getState().addTextLabel('north');
    useStore.getState().addTextLabel('west');
    const [a, b] = useStore.getState().textLabels;
    useStore.getState().updateTextLabel(a.id, { content: 'FOO' });
    useStore.getState().updateTextLabel(b.id, { content: 'BAR' });
    render(<TextTab />);
    // Accordion trigger for each row carries the content + side tag.
    expect(
      screen.getByRole('button', { name: /FOO.*north/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /BAR.*west/i }),
    ).toBeInTheDocument();
  });
});
