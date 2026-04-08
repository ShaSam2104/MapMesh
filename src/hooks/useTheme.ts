/**
 * Theme hook — applies `dark`/`light` to `<html>` and persists the choice.
 */

import { useEffect } from 'react';
import { useStore } from '@/state/store';
import type { Theme } from '@/types';

const STORAGE_KEY = 'meshmap_theme';

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    // Initial load from localStorage (once)
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    } catch {
      /* ignore */
    }
  }, [setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return { theme, setTheme };
}
