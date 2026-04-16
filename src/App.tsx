import { AppShell } from '@/components/layout/AppShell';
import { useAutoRebuild } from '@/hooks/useAutoRebuild';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useTheme } from '@/hooks/useTheme';

export function App(): JSX.Element {
  useTheme();
  useGeolocation();
  // Mount-once: auto-rebuild the mesh when any geometry-affecting
  // parameter changes (debounced), so slider edits feel instant and
  // don't re-hit the Overpass / Terrarium endpoints.
  useAutoRebuild();
  return <AppShell />;
}
