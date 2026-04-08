import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import * as icons from 'lucide-react';
import { useStore } from '@/state/store';
import type { LayerKey } from '@/types';
import { LAYER_ICON, LAYER_LABEL } from '@/lib/palette';
import { LayerBody } from './LayerBody';

export interface LayerRowProps {
  layerKey: LayerKey;
  expanded: boolean;
  onToggle: () => void;
}

export function LayerRow({
  layerKey,
  expanded,
  onToggle,
}: LayerRowProps): JSX.Element {
  const color = useStore((s) => s.layers[layerKey].color);
  const [hover, setHover] = useState(false);

  const iconName = LAYER_ICON[layerKey];
  const Icon: LucideIcon =
    (icons as unknown as Record<string, LucideIcon>)[iconName] ?? icons.Square;

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`layer-body-${layerKey}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="focus-ring w-full flex items-center gap-3 py-3 px-1 text-left"
      >
        <span
          className="w-4 h-4 rounded-full border border-line-hot"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <Icon size={16} strokeWidth={1.5} />
        <span className="flex-1 text-sm">{LAYER_LABEL[layerKey]}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={
            'transition-transform text-ink-1 ' +
            (expanded ? 'rotate-180' : '') +
            (hover ? ' text-ink-0' : '')
          }
        />
      </button>
      {expanded && (
        <div id={`layer-body-${layerKey}`} className="pl-7 pr-1 pb-3">
          <LayerBody layerKey={layerKey} />
        </div>
      )}
    </div>
  );
}
