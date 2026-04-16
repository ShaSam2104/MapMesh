import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextLabelRow } from './TextLabelRow';
import { useStore } from '@/state/store';

function resetLabels() {
  for (const l of [...useStore.getState().textLabels]) {
    useStore.getState().removeTextLabel(l.id);
  }
}

function seedLabel(content: string): string {
  resetLabels();
  useStore.getState().addTextLabel('north');
  const id = useStore.getState().textLabels[0].id;
  useStore.getState().updateTextLabel(id, { content });
  return id;
}

describe('TextLabelRow', () => {
  it('shows the content as the accordion summary', () => {
    const id = seedLabel('HELLO');
    render(<TextLabelRow labelId={id} />);
    // The summary shows up inside the accordion trigger (button).
    expect(
      screen.getByRole('button', { name: /HELLO.*north/i }),
    ).toBeInTheDocument();
  });

  it('updates label content via the textarea', async () => {
    const id = seedLabel('A');
    render(<TextLabelRow labelId={id} />);
    const input = screen.getByLabelText(/Label content/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Z');
    expect(useStore.getState().textLabels[0].content).toBe('Z');
  });

  it('removes the label when the trash button is clicked', async () => {
    const id = seedLabel('WORLD');
    render(<TextLabelRow labelId={id} />);
    await userEvent.click(
      screen.getByRole('button', { name: /Remove label WORLD/i }),
    );
    expect(useStore.getState().textLabels).toHaveLength(0);
  });

  it('updates side when a segmented option is chosen', async () => {
    const id = seedLabel('Label');
    render(<TextLabelRow labelId={id} />);
    await userEvent.click(screen.getByRole('radio', { name: 'W' }));
    expect(useStore.getState().textLabels[0].side).toBe('west');
  });
});
