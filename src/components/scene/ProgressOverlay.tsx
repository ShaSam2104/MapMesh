import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';

/**
 * Absolute-positioned overlay rendered on top of the R3F canvas while
 * the mesh pipeline is doing any visible work. Its whole job is to
 * reassure the user that something is happening during the long
 * Terrarium + Overpass + manifold + font steps — which otherwise give
 * no visual feedback for 10-30s on a slow link and feel like a hang.
 *
 * Visibility:
 * - Shown whenever `mesh.progress` is set (the pipeline writes an
 *   entry on entry to every slow phase and clears it on success/error).
 * - Also shown on initial status transitions (`fetching` / `building`)
 *   even before the first `setMeshProgress` call lands, so the user
 *   sees a spinner the instant they click Generate.
 *
 * Not mounted inside the R3F scene — it's a plain DOM sibling of the
 * `<Canvas>` so the spinner keeps animating smoothly even when the
 * main thread is busy building geometry.
 */
export function ProgressOverlay(): JSX.Element | null {
  const status = useStore((s) => s.mesh.status);
  const progress = useStore((s) => s.mesh.progress);

  // Live elapsed-seconds counter pinned to the current progress
  // startedAt. Re-initialised on every progress swap so the counter
  // resets to 0 at each new phase instead of continuing to climb.
  const startedAt = progress?.startedAt ?? null;
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (startedAt == null) {
      setElapsedMs(0);
      return;
    }
    setElapsedMs(Date.now() - startedAt);
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const isBusy = status === 'fetching' || status === 'building';
  if (!isBusy && !progress) return null;

  const phase = progress?.phase ?? (status === 'fetching' ? 'Fetching' : 'Building');
  const detail = progress?.detail;
  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="surface px-6 py-5 text-center min-w-[260px]">
        <div className="flex items-center justify-center gap-3">
          <Spinner />
          <span className="label">Generating mesh</span>
        </div>
        <p className="mt-3 font-display text-xl tracking-tight">{phase}</p>
        {detail && (
          <p className="text-xs text-ink-1 mt-1 tabular-nums">{detail}</p>
        )}
        <p className="text-xxs text-ink-1 mt-2 tabular-nums uppercase tracking-label">
          {seconds}s
        </p>
      </div>
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="var(--line)"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M12 3 a9 9 0 0 1 9 9"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
