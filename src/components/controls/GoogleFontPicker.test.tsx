import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleFontPicker } from './GoogleFontPicker';

describe('GoogleFontPicker', () => {
  it('shows the current value on the trigger', () => {
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={() => {}} />,
    );
    expect(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    ).toBeInTheDocument();
  });

  it('opens the dropdown and lists fonts', async () => {
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={() => {}} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    );
    const listbox = screen.getByRole('listbox', { name: /Font family/i });
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(5);
  });

  it('filters results by the search query', async () => {
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={() => {}} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    );
    const input = screen.getByLabelText(/Search Google Fonts/i);
    await userEvent.type(input, 'mono');
    const listbox = screen.getByRole('listbox', { name: /Font family/i });
    const options = within(listbox).getAllByRole('option');
    // Every remaining entry should contain 'mono' (case-insensitive).
    for (const opt of options) {
      expect(opt.textContent?.toLowerCase()).toContain('mono');
    }
  });

  it('calls onChange with the picked family', async () => {
    const onChange = vi.fn();
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    );
    // The full catalog is ~1929 families sorted alphabetically and the
    // dropdown caps at 100 entries, so "Inter" is well past the first
    // page — search for it explicitly.
    await userEvent.type(
      screen.getByLabelText(/Search Google Fonts/i),
      'Inter',
    );
    const listbox = screen.getByRole('listbox', { name: /Font family/i });
    // Exact accessible name: "Inter sans-serif" (family + category span).
    const inter = within(listbox).getByRole('option', {
      name: /^Inter sans-serif$/i,
    });
    await userEvent.click(inter);
    expect(onChange).toHaveBeenCalledWith('Inter');
  });

  it('finds Racing Sans One (full catalog is shipped)', async () => {
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={() => {}} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    );
    const input = screen.getByLabelText(/Search Google Fonts/i);
    await userEvent.type(input, 'Racing Sans');
    const listbox = screen.getByRole('listbox', { name: /Font family/i });
    expect(
      within(listbox).getByRole('option', { name: /Racing Sans One/i }),
    ).toBeInTheDocument();
  });

  it('offers a free-text fallback when the query has no exact match', async () => {
    const onChange = vi.fn();
    render(
      <GoogleFontPicker label="Font family" value="Roboto" onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Font family: Roboto/i }),
    );
    const input = screen.getByLabelText(/Search Google Fonts/i);
    await userEvent.type(input, 'ZzUnknownFamily');
    const listbox = screen.getByRole('listbox', { name: /Font family/i });
    const useButton = within(listbox).getByRole('option', {
      name: /Use.*ZzUnknownFamily/i,
    });
    await userEvent.click(useButton);
    expect(onChange).toHaveBeenCalledWith('ZzUnknownFamily');
  });
});
