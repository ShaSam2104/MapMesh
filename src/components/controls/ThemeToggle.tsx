import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="focus-ring p-2 text-ink-1 hover:text-ink-0"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
