import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { useStore } from '@/state/store';

describe('ThemeToggle', () => {
  it('renders with an accessible label', () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: /Switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });

  it('toggles the theme in the store on click', async () => {
    useStore.getState().setTheme('dark');
    render(<ThemeToggle />);
    await userEvent.click(
      screen.getByRole('button', { name: /Switch to light theme/i }),
    );
    expect(useStore.getState().theme).toBe('light');
  });
});
