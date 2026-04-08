import { Square, Circle, Hexagon } from 'lucide-react';
import { useStore } from '@/state/store';
import type { SelectionShape } from '@/types';
import { Segmented } from '@/components/ui/Segmented';

export function ShapeSelector(): JSX.Element {
  const shape = useStore((s) => s.selection.shape);
  const setShape = useStore((s) => s.setShape);

  return (
    <Segmented<SelectionShape>
      label="Shape"
      value={shape}
      onChange={setShape}
      options={[
        { value: 'square', label: 'Square', icon: <Square size={14} /> },
        { value: 'circle', label: 'Circle', icon: <Circle size={14} /> },
        { value: 'hex', label: 'Hex', icon: <Hexagon size={14} /> },
      ]}
    />
  );
}
