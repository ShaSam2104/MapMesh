import { ColorSwatch } from './ColorSwatch';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useStore } from '@/state/store';
import type { LayerKey } from '@/types';
import { defaultColor } from '@/lib/palette';

export interface LayerBodyProps {
  layerKey: LayerKey;
}

export function LayerBody({ layerKey }: LayerBodyProps): JSX.Element {
  const layer = useStore((s) => s.layers[layerKey]);
  const theme = useStore((s) => s.theme);
  const setColor = useStore((s) => s.setLayerColor);
  const toggleVisible = useStore((s) => s.toggleLayerVisible);
  const toggleExport = useStore((s) => s.toggleLayerExport);
  const setOffset = useStore((s) => s.setLayerHeightOffset);
  const reset = useStore((s) => s.resetLayerDefaults);

  const defaultHex = defaultColor(layerKey, theme);
  const isBase = layerKey === 'base';
  const isGpx = layerKey === 'gpxPath';

  return (
    <div className="space-y-3 pt-2">
      <ColorSwatch
        label={`${layerKey} color`}
        color={layer.color}
        defaultColor={defaultHex}
        onChange={(c) => setColor(layerKey, c)}
      />
      {!isBase && (
        <>
          <div className="flex items-center justify-between">
            <span className="label">Visible in preview</span>
            <Switch
              label={`${layerKey} visible`}
              checked={layer.visible}
              onChange={() => toggleVisible(layerKey)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="label">Include in export</span>
            <Switch
              label={`${layerKey} include in export`}
              checked={layer.includeInExport}
              onChange={() => toggleExport(layerKey)}
            />
          </div>
          <Slider
            label={isGpx ? 'Height above terrain' : 'Height offset'}
            value={layer.heightOffsetMm}
            onChange={(v) => setOffset(layerKey, v)}
            min={-3}
            max={3}
            step={0.1}
            unit="mm"
          />
        </>
      )}
      <button
        type="button"
        onClick={() => reset(layerKey)}
        className="focus-ring text-xs text-ink-1 hover:text-ink-0"
      >
        Reset to defaults
      </button>
    </div>
  );
}
