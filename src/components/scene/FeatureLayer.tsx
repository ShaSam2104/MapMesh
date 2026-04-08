import { useStore } from '@/state/store';
import type { LayerKey } from '@/types';

export interface FeatureLayerProps {
  layerKey: LayerKey;
  metalness?: number;
  roughness?: number;
  emissive?: boolean;
  emissiveIntensity?: number;
}

/**
 * Generic renderer for any non-plinth layer. Reads `layerGeometries[key]`
 * from the store and applies the layer's color + visibility.
 */
export function FeatureLayer({
  layerKey,
  metalness = 0,
  roughness = 0.85,
  emissive = false,
  emissiveIntensity = 0,
}: FeatureLayerProps): JSX.Element | null {
  const geometry = useStore((s) => s.mesh.layerGeometries[layerKey]);
  const config = useStore((s) => s.layers[layerKey]);

  if (!geometry || !config.visible) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={config.color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ? config.color : '#000000'}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}
