import { useStore } from '@/state/store';

/**
 * Renders the plinth (base layer). The plinth is the watertight prism
 * produced by `buildWatertightPlinth` — it *is* the base, so we only render
 * that one mesh here. A separate terrain plane would extend beyond non-square
 * shapes (hex / circle) and look like a slab hanging around the plinth.
 */
export function TerrainMesh(): JSX.Element | null {
  const config = useStore((s) => s.layers.base);
  const plinthGeometry = useStore((s) => s.mesh.plinthGeometry);

  if (!plinthGeometry || !config.visible) return null;

  return (
    <mesh geometry={plinthGeometry}>
      <meshStandardMaterial color={config.color} roughness={0.7} />
    </mesh>
  );
}
