import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

export interface ColorSwatchProps {
  label: string;
  color: string;
  defaultColor: string;
  onChange: (hex: string) => void;
}

export function ColorSwatch({
  label,
  color,
  defaultColor,
  onChange,
}: ColorSwatchProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative space-y-1">
      <div className="label">{label}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label} color picker`}
          onClick={() => setOpen((o) => !o)}
          className="focus-ring w-10 h-10 rounded-full border border-line-hot"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-xs tabular-nums text-ink-0">{color}</span>
        <button
          type="button"
          aria-label="Reset to default color"
          onClick={() => onChange(defaultColor)}
          className="focus-ring text-xs text-ink-1 hover:text-ink-0 ml-auto"
        >
          Reset
        </button>
      </div>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-10 mt-1 surface p-2"
          role="dialog"
          aria-label={`${label} picker`}
        >
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
