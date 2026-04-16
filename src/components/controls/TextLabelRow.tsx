import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useStore } from '@/state/store';
import type { FlangeSide, TextLabel } from '@/types';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { ColorSwatch } from './ColorSwatch';
import { GoogleFontPicker } from './GoogleFontPicker';

export interface TextLabelRowProps {
  labelId: string;
}

const SIDE_OPTIONS: Array<{ value: FlangeSide; label: string }> = [
  { value: 'north', label: 'N' },
  { value: 'east', label: 'E' },
  { value: 'south', label: 'S' },
  { value: 'west', label: 'W' },
];

const ALIGN_OPTIONS: Array<{
  value: TextLabel['alignment'];
  label: string;
}> = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
];

/**
 * Single accordion row for one text label. Mirrors the shape of
 * `LayerRow` + `LayerBody` but for text instead of map layers.
 *
 * The row subscribes to the store by id rather than taking the label
 * object as a prop so controlled inputs stay in sync when the store
 * updates (mirrors how `LayerRow` reads layers by key).
 */
export function TextLabelRow({ labelId }: TextLabelRowProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(true);
  const label = useStore((s) => s.textLabels.find((l) => l.id === labelId));
  const update = useStore((s) => s.updateTextLabel);
  const remove = useStore((s) => s.removeTextLabel);

  if (!label) return null;

  const summary = label.content.trim() || '(empty)';

  return (
    <div className="border border-line rounded-sm bg-bg-1">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={`text-label-body-${label.id}`}
          className="focus-ring flex-1 flex items-center gap-2 px-3 py-2 text-left"
        >
          <span
            className="w-3 h-3 rounded-full border border-line-hot"
            style={{ backgroundColor: label.color }}
            aria-hidden
          />
          <span className="flex-1 truncate text-sm">{summary}</span>
          <span className="text-[10px] uppercase tracking-label text-ink-1">
            {label.side}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={
              'transition-transform text-ink-1 ' + (expanded ? 'rotate-180' : '')
            }
          />
        </button>
        <button
          type="button"
          aria-label={`Remove label ${summary}`}
          onClick={() => remove(label.id)}
          className="focus-ring p-2 text-ink-1 hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div
          id={`text-label-body-${label.id}`}
          className="px-3 pb-3 pt-1 space-y-3"
        >
          <label className="block space-y-1">
            <span className="label">Content</span>
            <textarea
              value={label.content}
              onChange={(e) =>
                update(label.id, { content: e.currentTarget.value })
              }
              rows={2}
              aria-label="Label content"
              className="focus-ring w-full resize-none border border-line rounded-sm px-2 py-1 text-sm font-mono bg-bg-0"
            />
          </label>

          <GoogleFontPicker
            label="Font family"
            value={label.fontFamily}
            onChange={(family) => update(label.id, { fontFamily: family })}
          />

          <ColorSwatch
            label="Color"
            color={label.color}
            defaultColor="#E8E6DF"
            onChange={(hex) => update(label.id, { color: hex })}
          />

          <Segmented
            label="Side"
            value={label.side}
            options={SIDE_OPTIONS}
            onChange={(side) => update(label.id, { side })}
          />

          <Segmented
            label="Alignment"
            value={label.alignment}
            options={ALIGN_OPTIONS}
            onChange={(alignment) => update(label.id, { alignment })}
          />

          <Slider
            label="Letter height"
            value={label.letterHeightMm}
            onChange={(v) => update(label.id, { letterHeightMm: v })}
            min={3}
            max={30}
            step={0.5}
            unit="mm"
          />
          <Slider
            label="Extrusion depth"
            value={label.extrusionMm}
            onChange={(v) => update(label.id, { extrusionMm: v })}
            min={0.6}
            max={5}
            step={0.1}
            unit="mm"
          />
          <Slider
            label="Edge offset"
            value={label.offsetMm}
            onChange={(v) => update(label.id, { offsetMm: v })}
            min={-100}
            max={100}
            step={1}
            unit="mm"
          />
        </div>
      )}
    </div>
  );
}
