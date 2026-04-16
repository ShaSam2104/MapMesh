import { useStore } from '@/state/store';

/**
 * Renders all raised-text labels as individual coloured meshes.
 *
 * Text geometries are placed on the flange outer face by
 * `placeTextOnFlange`, so they are already in absolute mm world
 * coordinates and sit at the same transform level as `TerrainMesh`
 * — outside the `plinthTopZ` lift group used by per-layer slabs.
 */
export function TextLabels(): JSX.Element | null {
  const labels = useStore((s) => s.textLabels);
  const geometries = useStore((s) => s.mesh.textLabelGeometries);

  if (labels.length === 0) return null;

  return (
    <group>
      {labels.map((label) => {
        const g = geometries[label.id];
        if (!g) return null;
        return (
          <mesh key={label.id} geometry={g}>
            <meshStandardMaterial color={label.color} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}
