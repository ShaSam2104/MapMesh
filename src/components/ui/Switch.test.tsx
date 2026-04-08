import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders with a role=switch and reflects checked state', () => {
    render(<Switch label="Visible" checked={true} onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: 'Visible' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles on click', async () => {
    const onChange = vi.fn();
    render(<Switch label="Visible" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Visible' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
