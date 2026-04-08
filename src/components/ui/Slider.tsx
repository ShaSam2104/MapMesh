import type { ChangeEvent } from 'react';

export interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
}: SliderProps): JSX.Element {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-xs tabular-nums text-ink-0">
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(parseFloat(e.target.value))
        }
        className="w-full accent-accent focus-ring"
        aria-label={label}
      />
    </label>
  );
}
