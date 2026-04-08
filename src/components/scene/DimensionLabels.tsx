import { useStore } from '@/state/store';

/**
 * Small HUD over the 3D canvas showing print dimensions in mm.
 */
export function DimensionLabels(): JSX.Element | null {
  const dims = useStore((s) => s.mesh.dimsMm);
  if (!dims) return null;
  const fmt = (n: number) => `${Math.round(n)} mm`;
  return (
    <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-mono tabular-nums text-ink-1">
      <span>X {fmt(dims.x)}</span>
      <span>Y {fmt(dims.y)}</span>
      <span>Z {fmt(dims.z)}</span>
    </div>
  );
}
