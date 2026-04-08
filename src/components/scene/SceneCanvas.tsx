import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useStore } from '@/state/store';
import { TerrainMesh } from './TerrainMesh';
import { Buildings } from './Buildings';
import { Roads } from './Roads';
import { Water } from './Water';
import { Grass } from './Grass';
import { Sand } from './Sand';
import { Piers } from './Piers';
import { GpxPath } from './GpxPath';
import { GridFloor } from './GridFloor';
import { EmptyState } from './EmptyState';

/**
 * 3D scene.
 *
 * The render scale compresses the ~2000 world-unit (meter) plinth span to a
 * ~200-unit on-screen size, which fits comfortably in the default camera
 * view. Geometry in `src/lib/geometry/*` is authored in meter units.
 */
const RENDER_SCALE = 0.1;

/** Theme-aware canvas background color. Uses the same tokens as the UI. */
const BG_DARK = '#0b0c0e';
const BG_LIGHT = '#F7F5F1';

export function SceneCanvas(): JSX.Element {
  const status = useStore((s) => s.mesh.status);
  const theme = useStore((s) => s.theme);
  const plinthTopZ = useStore((s) => s.mesh.plinthTopZ ?? 0);
  const hasMesh = status === 'ready';

  return (
    <div className="h-full w-full bg-bg-0 relative">
      <Canvas
        camera={{ position: [180, 180, 200], fov: 40, near: 0.1, far: 5000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[theme === 'dark' ? BG_DARK : BG_LIGHT]} />
        <ambientLight intensity={theme === 'dark' ? 0.35 : 0.55} />
        <directionalLight
          position={[200, 200, 300]}
          intensity={theme === 'dark' ? 1.1 : 1.3}
          castShadow={false}
        />
        <Environment preset={theme === 'dark' ? 'city' : 'apartment'} />
        <group scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
          <TerrainMesh />
          {/* Layer geometries are authored in "z=0 = terrain top" local
              coordinates. The plinth top sits at `plinthTopZ` (meters) so we
              lift the whole layer group up so roads / buildings / GPX rest
              on the plinth surface instead of being buried inside it. */}
          <group position={[0, 0, plinthTopZ]}>
            <Buildings />
            <Roads />
            <Water />
            <Grass />
            <Sand />
            <Piers />
            <GpxPath />
          </group>
        </group>
        {/* GridFloor is only a visual scaffold for the empty / pre-generate state.
            Once a mesh is ready, we hide it so it doesn't create the illusion
            of a street map sitting underneath the plinth. */}
        {!hasMesh && <GridFloor theme={theme} />}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={40}
          maxDistance={800}
        />
      </Canvas>
      {status === 'idle' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <EmptyState />
        </div>
      )}
    </div>
  );
}
