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
  const setWidthMeters = useStore((s) => s.setLayerWidthMeters);
  const setHeightScale = useStore((s) => s.setLayerHeightScale);
  const reset = useStore((s) => s.resetLayerDefaults);

  const defaultHex = defaultColor(layerKey, theme);
  const isBase = layerKey === 'base';
  const isGpx = layerKey === 'gpxPath';
  const hasWidth =
    layerKey === 'roads' || layerKey === 'piers' || layerKey === 'gpxPath';
  const hasHeightScale = layerKey === 'buildings';

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
            label={isGpx ? 'Height above plinth' : 'Height offset'}
            value={layer.heightOffsetMm}
            onChange={(v) => setOffset(layerKey, v)}
            min={isGpx ? 0 : -2}
            max={isGpx ? 10 : 8}
            step={0.1}
            unit="mm"
          />
          {hasWidth && (
            <Slider
              label="Line width"
              value={layer.widthMeters ?? 0}
              onChange={(v) => setWidthMeters(layerKey, v)}
              min={0.5}
              max={30}
              step={0.5}
              unit="m"
            />
          )}
          {hasHeightScale && (
            <Slider
              label="Building height scale"
              value={layer.heightScale ?? 1}
              onChange={(v) => setHeightScale(layerKey, v)}
              min={0.3}
              max={3}
              step={0.1}
              unit="×"
            />
          )}
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
