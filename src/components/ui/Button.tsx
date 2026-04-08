import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export function Button({
  variant = 'ghost',
  className = '',
  children,
  ...props
}: ButtonProps): JSX.Element {
  const base =
    'focus-ring rounded-sm px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-2';
  const styles =
    variant === 'primary'
      ? 'bg-accent text-bg-0 hover:bg-accent-dim disabled:opacity-50'
      : 'border border-line text-ink-0 hover:bg-bg-2 disabled:opacity-50';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
