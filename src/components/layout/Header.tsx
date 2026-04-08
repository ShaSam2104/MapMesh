import { useStore } from '@/state/store';
import { ThemeToggle } from '@/components/controls/ThemeToggle';

export function Header(): JSX.Element {
  const status = useStore((s) => s.mesh.status);

  return (
    <header className="h-14 flex items-center justify-between border-b border-line bg-bg-0 px-4">
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
          <path
            d="M6 22 L12 10 L18 20 L24 8"
            stroke="var(--accent)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="8" r="2" fill="var(--accent)" />
        </svg>
        <span className="font-display text-xl tracking-tight">MeshMap</span>
        <span className="label ml-2">Cartographer's Workbench</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="label tabular-nums">
          {status === 'idle' ? 'READY' : status.toUpperCase()}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
