import type { FallbackProps } from 'react-error-boundary';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): JSX.Element {
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-bg-0 p-8"
    >
      <div className="surface max-w-md p-6 space-y-4">
        <div className="label">Something broke</div>
        <h2 className="text-xl font-display tracking-tight">We hit a snag.</h2>
        <pre className="text-xs font-mono text-ink-1 whitespace-pre-wrap break-words">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="focus-ring rounded-sm border border-line-hot px-3 py-2 text-sm hover:bg-bg-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
