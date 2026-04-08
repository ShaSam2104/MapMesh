import { AppShell } from '@/components/layout/AppShell';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useTheme } from '@/hooks/useTheme';

export function App(): JSX.Element {
  useTheme();
  useGeolocation();
  return <AppShell />;
}
