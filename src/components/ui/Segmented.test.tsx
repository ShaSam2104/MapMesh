import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented } from './Segmented';

describe('Segmented', () => {
  it('renders options with radio roles', () => {
    render(
      <Segmented
        label="Shape"
        value="square"
        onChange={() => {}}
        options={[
          { value: 'square', label: 'Square' },
          { value: 'circle', label: 'Circle' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('calls onChange when a different option is selected', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Shape"
        value="square"
        onChange={onChange}
        options={[
          { value: 'square', label: 'Square' },
          { value: 'circle', label: 'Circle' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: /circle/i }));
    expect(onChange).toHaveBeenCalledWith('circle');
  });

  it('marks the active option with aria-checked', () => {
    render(
      <Segmented
        label="X"
        value="b"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b).toHaveAttribute('aria-checked', 'true');
  });
});
