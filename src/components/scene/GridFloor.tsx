import { Grid } from '@react-three/drei';
import type { Theme } from '@/types';

/**
 * Minimal finite floor grid used only as a visual scaffold when the scene
 * is empty (pre-generate). Cell sizes are intentionally coarse so it reads
 * as a reference grid — not as streets underneath the model.
 */
export function GridFloor({ theme }: { theme: Theme }): JSX.Element {
  const isDark = theme === 'dark';
  return (
    <Grid
      args={[600, 600]}
      cellSize={50}
      cellColor={isDark ? '#1d2024' : '#d9d3c7'}
      sectionSize={200}
      sectionColor={isDark ? '#2f343a' : '#bfb8a8'}
      fadeDistance={800}
      fadeStrength={2}
      followCamera={false}
      position={[0, -0.01, 0]}
    />
  );
}
