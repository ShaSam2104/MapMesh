export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, checked, onChange }: SwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        'focus-ring relative w-9 h-5 rounded-full transition-colors ' +
        (checked ? 'bg-accent' : 'bg-line-hot')
      }
    >
      <span
        className={
          'absolute top-0.5 w-4 h-4 rounded-full bg-bg-0 transition-transform ' +
          (checked ? 'translate-x-4' : 'translate-x-0.5')
        }
      />
    </button>
  );
}
