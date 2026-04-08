export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>): JSX.Element {
  return (
    <div className="space-y-1" role="radiogroup" aria-label={label}>
      <div className="label">{label}</div>
      <div className="flex border border-line rounded-sm overflow-hidden">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={
                'flex-1 py-2 text-xs font-medium focus-ring flex items-center justify-center gap-1 ' +
                (active ? 'bg-bg-2 text-ink-0' : 'text-ink-1 hover:bg-bg-2')
              }
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
