import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { ThemeToggle } from '@/components/controls/ThemeToggle';

/**
 * Top-of-app status strip. Shows the coarse mesh status (READY /
 * FETCHING / BUILDING / ERROR) alongside a live phase label + elapsed
 * seconds counter while the pipeline is running, so users never see a
 * blank "BUILDING" for 30+ seconds with no indication that work is
 * still happening.
 */
export function Header(): JSX.Element {
  const status = useStore((s) => s.mesh.status);
  const progress = useStore((s) => s.mesh.progress);

  // Re-tick the elapsed counter ~4x/sec while a phase is active.
  const startedAt = progress?.startedAt ?? null;
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (startedAt == null) {
      setElapsedMs(0);
      return;
    }
    setElapsedMs(Date.now() - startedAt);
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const statusLabel = status === 'idle' ? 'READY' : status.toUpperCase();

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
        {progress ? (
          <span className="label tabular-nums max-w-[360px] truncate">
            {progress.phase}
            {progress.detail ? ` · ${progress.detail}` : ''}
            <span className="ml-2 text-ink-1">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </span>
        ) : (
          <span className="label tabular-nums">{statusLabel}</span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
