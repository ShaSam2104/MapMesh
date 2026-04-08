import { useCallback, useState } from 'react';
import { LAYER_ORDER } from '@/types';
import type { LayerKey } from '@/types';
import { LayerRow } from './LayerRow';

export function LayerAccordion(): JSX.Element {
  const [expanded, setExpanded] = useState<Set<LayerKey>>(new Set(['base']));

  const toggle = useCallback((key: LayerKey) => {
    setExpanded((prev) => {
      // Single-open accordion; Ctrl-click support is a post-MVP polish.
      const next = new Set<LayerKey>();
      if (!prev.has(key)) next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="surface">
      {LAYER_ORDER.map((key) => (
        <LayerRow
          key={key}
          layerKey={key}
          expanded={expanded.has(key)}
          onToggle={() => toggle(key)}
        />
      ))}
    </div>
  );
}
