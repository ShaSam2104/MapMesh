import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Slider } from './Slider';

describe('Slider', () => {
  it('renders with label, value, and unit', () => {
    render(<Slider label="Size" value={2} onChange={() => {}} min={0} max={5} unit="km" />);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByText(/2\s*km/)).toBeInTheDocument();
  });

  it('calls onChange when the user moves the slider', () => {
    const onChange = vi.fn();
    render(<Slider label="Size" value={2} onChange={onChange} min={0} max={5} step={1} />);
    const range = screen.getByLabelText('Size') as HTMLInputElement;
    // jsdom does not implement keyboard-driven range input changes, so drive
    // the change event directly — the behavior under test is "value prop ← onChange".
    fireEvent.change(range, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
