import { useStore } from '@/state/store';
import { useGenerateMesh } from '@/hooks/useGenerateMesh';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { ShapeSelector } from './ShapeSelector';

export function ShapeTab(): JSX.Element {
  const selection = useStore((s) => s.selection);
  const status = useStore((s) => s.mesh.status);
  const error = useStore((s) => s.mesh.error);
  const setSize = useStore((s) => s.setSize);
  const setRotation = useStore((s) => s.setRotation);
  const setBaseThickness = useStore((s) => s.setBaseThickness);
  const setExaggeration = useStore((s) => s.setExaggeration);
  const { generate } = useGenerateMesh();

  const [lng, lat] = selection.center;
  const busy = status === 'fetching' || status === 'building';

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="label">Centroid</div>
        <div className="font-mono text-xs tabular-nums">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
      </div>

      <ShapeSelector />

      <Slider
        label="Size"
        value={selection.sizeKm}
        onChange={setSize}
        min={0.5}
        max={3}
        step={0.1}
        unit="km"
      />
      <Slider
        label="Rotation"
        value={selection.rotationDeg}
        onChange={setRotation}
        min={0}
        max={360}
        step={1}
        unit="°"
      />
      <Slider
        label="Base thickness"
        value={selection.baseThicknessMm}
        onChange={setBaseThickness}
        min={2}
        max={20}
        step={0.5}
        unit="mm"
      />
      <Slider
        label="Exaggeration"
        value={selection.exaggeration}
        onChange={setExaggeration}
        min={1}
        max={3}
        step={0.1}
        unit="×"
      />

      <Button
        variant="primary"
        onClick={() => {
          void generate();
        }}
        disabled={busy}
        aria-label="Generate mesh"
        className="w-full justify-center"
      >
        {busy ? status.toUpperCase() : 'Generate'}
      </Button>
      {error && (
        <div className="text-xs text-danger font-mono break-words" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
